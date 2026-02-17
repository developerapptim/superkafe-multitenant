import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from './CustomSelect';
import toast from 'react-hot-toast';
import api from '../services/api';

const UnifiedExpenseModal = ({ isOpen, onClose, onSuccess, defaultCategory }) => {
    const [formData, setFormData] = useState({
        amount: '',
        category: defaultCategory || 'Belanja Bahan',
        paymentMethod: 'cash_drawer',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });
    const [loading, setLoading] = useState(false);

    // Grouped Categories
    const categoryOptions = [
        { label: '--- Biaya Operasional (OpEx) ---', value: '', disabled: true },
        { label: 'Belanja Bahan', value: 'Belanja Bahan' },
        { label: 'Listrik & Air', value: 'Listrik' },
        { label: 'Gaji Pegawai', value: 'Gaji' },
        { label: 'Sewa Tempat', value: 'Sewa' },
        { label: 'Maintenance / Perbaikan', value: 'Maintenance' },
        { label: 'Pemasaran / Iklan', value: 'Pemasaran' },
        { label: 'Lainnya (OpEx)', value: 'Lainnya' },
        { label: '--- Non-Operasional ---', value: '', disabled: true },
        { label: 'Tarik Tunai (Pribadi/Owner)', value: 'Tarik Tunai' },
        { label: 'Setor ke Bank', value: 'Setor Bank' },
        { label: 'Kasbon Karyawan', value: 'Kasbon' },
        { label: 'Lainnya (Non-OpEx)', value: 'Lainnya (Non-OpEx)' }
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.amount || Number(formData.amount) <= 0) {
            toast.error('Jumlah harus valid');
            return;
        }

        setLoading(true);
        try {
            await api.post('/finance/unified-expense', {
                ...formData,
                amount: Number(formData.amount)
            });
            toast.success('Pengeluaran berhasil dicatat!');
            onSuccess && onSuccess();
            onClose();
            // Reset form
            setFormData({
                amount: '',
                category: 'Belanja Bahan',
                paymentMethod: 'cash_drawer',
                description: '',
                date: new Date().toISOString().split('T')[0]
            });
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Gagal menyimpan data');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-[#1E1B4B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                💸 Catat Pengeluaran
                            </h3>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Tips/Info */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
                                <p>ℹ️ <b>Sistem Terpadu:</b> Data akan otomatis masuk ke Laporan Laba Rugi atau mengurangi Kas Laci sesuai kategori & metode bayar.</p>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Jumlah Pengeluaran (Rp)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">Rp</span>
                                    <input
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xl font-bold text-white placeholder-gray-600 transition-all"
                                        placeholder="0"
                                        autoFocus
                                        min="1"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Kategori Pengeluaran</label>
                                <CustomSelect
                                    value={formData.category}
                                    onChange={(val) => setFormData({ ...formData, category: val })}
                                    options={categoryOptions}
                                    placeholder="Pilih Kategori"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Sumber Dana / Metode Bayar</label>
                                <div className="grid grid-cols-1 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, paymentMethod: 'cash_drawer' })}
                                        className={`p-3 rounded-xl border flex items-center justify-start gap-3 transition-all ${formData.paymentMethod === 'cash_drawer'
                                            ? 'bg-green-500/20 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                                            : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <span className="text-xl">💵</span>
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Tunai (Kas Laci)</div>
                                            <div className="text-[10px] opacity-70">Uang diambil dari laci kasir saat ini.</div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, paymentMethod: 'cash_main' })}
                                        className={`p-3 rounded-xl border flex items-center justify-start gap-3 transition-all ${formData.paymentMethod === 'cash_main'
                                            ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                                            : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <span className="text-xl">🏢</span>
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Tunai (Kas Utama/Kantor)</div>
                                            <div className="text-[10px] opacity-70">Uang perusahaan di luar laci. (Tidak mengurangi shift)</div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, paymentMethod: 'transfer' })}
                                        className={`p-3 rounded-xl border flex items-center justify-start gap-3 transition-all ${formData.paymentMethod === 'transfer'
                                            ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                                            : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        <span className="text-xl">💳</span>
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Transfer / Bank</div>
                                            <div className="text-[10px] opacity-70">Pembayaran via rekening bank.</div>
                                        </div>
                                    </button>
                                </div>
                                {formData.paymentMethod === 'cash_drawer' && (
                                    <p className="text-[10px] text-green-500/80 mt-1.5 ml-1">
                                        * Saldo kas di laci akan berkurang otomatis.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Keterangan (Opsional)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 focus:border-purple-500 focus:outline-none h-20 resize-none text-sm"
                                    placeholder="Contoh: Beli token listrik di Indomaret..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/25 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? 'Memproses...' : '✅ Simpan Pengeluaran'}
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default UnifiedExpenseModal;
