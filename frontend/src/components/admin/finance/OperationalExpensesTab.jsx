
import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import api, { expensesAPI } from '../../../services/api';
import SmartText from '../../SmartText';
import CustomSelect from '../../CustomSelect';
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

    const [showModal, setShowModal] = useState(false);

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState({
        show: false,
        id: null,
        loading: false
    });

    const [formData, setFormData] = useState({
        category: 'Operasional',
        amount: '',
        description: '',
        paymentMethod: 'Tunai',
        date: new Date().toISOString().split('T')[0]
    });

    const categories = ['Belanja Bahan', 'Gaji Pegawai', 'Operasional', 'Marketing', 'Listrik/Air', 'Sewa', 'Lainnya'];

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await expensesAPI.create({
                ...formData,
                amount: Number(formData.amount)
            });
            toast.success('Pengeluaran berhasil dicatat');
            mutate('/expenses');
            setShowModal(false);
            setFormData({
                category: 'Operasional',
                amount: '',
                description: '',
                paymentMethod: 'Tunai',
                date: new Date().toISOString().split('T')[0]
            });
        } catch (err) {
            console.error(err);
            toast.error('Gagal menyimpan pengeluaran');
        }
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
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg hover:shadow-red-500/20"
                >
                    <span>➕</span> Catat Pengeluaran Baru
                </button>
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
                                            <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300 border border-white/5">
                                                {item.paymentMethod}
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

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="glass rounded-2xl p-6 w-full max-w-md border border-purple-500/30 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold">📤 Catat Pengeluaran</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Kategori</label>
                                <CustomSelect
                                    value={formData.category}
                                    options={categories.map(c => ({ value: c, label: c }))}
                                    onChange={(val) => setFormData({ ...formData, category: val })}
                                    placeholder="Pilih Kategori"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Jumlah (Rp) *</label>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-purple-500/30 text-white text-xl font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                    placeholder="0"
                                    required
                                    min="0"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Tanggal</label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Metode Pembayaran</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, paymentMethod: 'Tunai' })}
                                        className={`flex-1 py-2 rounded-lg font-medium transition-all border ${formData.paymentMethod === 'Tunai' ? 'bg-green-500/20 text-green-300 border-green-500' : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/10'}`}
                                    >
                                        💵 Tunai
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, paymentMethod: 'Transfer' })}
                                        className={`flex-1 py-2 rounded-lg font-medium transition-all border ${formData.paymentMethod === 'Transfer' ? 'bg-blue-500/20 text-blue-300 border-blue-500' : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/10'}`}
                                    >
                                        💳 Transfer
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Keterangan</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500 resize-none h-20"
                                    placeholder="Catatan tambahan (opsional)"
                                />
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full py-3 rounded-lg font-bold bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02]"
                                >
                                    💾 Simpan Pengeluaran
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
        </div>
    );
}

export default OperationalExpensesTab;
