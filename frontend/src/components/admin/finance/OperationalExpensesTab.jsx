
import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import api, { expensesAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import ConfirmationModal from '../../ConfirmationModal'; // Import Custom Modal

const fetcher = url => api.get(url).then(res => res.data);

function OperationalExpensesTab() {
    const { data: expensesData } = useSWR('/expenses', fetcher);

    // Fix: Handle paginated response { data: [...], pagination: ... }
    const expenses = useMemo(() => {
        if (!expensesData) return [];
        if (Array.isArray(expensesData)) return expensesData;
        if (expensesData.data && Array.isArray(expensesData.data)) return expensesData.data;
        return [];
    }, [expensesData]);



    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState({
        show: false,
        id: null,
        loading: false
    });



    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };



    // Open Delete Confirmation
    const handleDeleteClick = (id) => {
        setDeleteModal({ show: true, id, loading: false });
    };

    // Execute Delete
    const confirmDelete = async () => {
        if (!deleteModal.id) return;

        setDeleteModal(prev => ({ ...prev, loading: true }));
        try {
            await expensesAPI.delete(deleteModal.id);
            toast.success('Pengeluaran dihapus');
            mutate('/expenses');
            setDeleteModal({ show: false, id: null, loading: false });
        } catch (err) {
            console.error(err);
            toast.error('Gagal menghapus');
            setDeleteModal(prev => ({ ...prev, loading: false }));
        }
    };

    const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);

    return (
        <div className="space-y-6">
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="glass px-4 py-2 rounded-lg border border-red-500/30">
                    <p className="text-xs text-gray-400">Total Pengeluaran (Bulan Ini)</p>
                    <p className="text-xl font-bold text-red-400">{formatCurrency(totalExpense)}</p>
                </div>
            </div>

            {/* List */}
            <div className="glass rounded-xl overflow-hidden">
                <div className="p-4 border-b border-purple-500/20">
                    <h3 className="font-bold">📋 Riwayat Pengeluaran</h3>
                </div>
                <div className="divide-y divide-purple-500/10 max-h-[500px] overflow-auto">
                    {expenses.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            <div className="text-4xl mb-2">💸</div>
                            <p>Belum ada daftar pengeluaran.</p>
                        </div>
                    ) : (
                        expenses.map(item => (
                            <div key={item.id || item._id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-xl">
                                        📤
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-white">{item.category}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded border border-white/5 ${item.paymentMethod === 'cash_drawer' ? 'bg-green-500/20 text-green-300' :
                                                    item.paymentMethod === 'cash_main' ? 'bg-orange-500/20 text-orange-300' :
                                                        'bg-blue-500/20 text-blue-300'
                                                }`}>
                                                {item.paymentMethod === 'cash_drawer' ? '💵 Laci' :
                                                    item.paymentMethod === 'cash_main' ? '🏢 Kantor' :
                                                        item.paymentMethod === 'transfer' ? '💳 Transfer' :
                                                            item.paymentMethod}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {formatDate(item.date)} • {item.description || '-'}
                                        </p>
                                        <p className="text-[10px] text-gray-500">
                                            Dibuat oleh: {item.createdBy?.name || 'Admin'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-red-400">
                                        - {formatCurrency(item.amount)}
                                    </span>
                                    <button
                                        onClick={() => handleDeleteClick(item.id || item._id)}
                                        className="p-2 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                                        title="Hapus"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>



            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteModal.show}
                onClose={() => setDeleteModal({ show: false, id: null, loading: false })}
                onConfirm={confirmDelete}
                title="Hapus Pengeluaran?"
                message="Data pengeluaran ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
                confirmText="Ya, Hapus"
                cancelText="Batal"
                isDanger={true}
                isLoading={deleteModal.loading}
            />
        </div >
    );
}

export default OperationalExpensesTab;
