import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import toast from 'react-hot-toast';
import api, { voucherAPI, bannerAPI } from '../../services/api';
import { useRefresh } from '../../context/RefreshContext';

const fetcher = url => api.get(url).then(res => res.data);

// Helper format currency
const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(value || 0);
};

// Helper format tanggal
const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
};

const INITIAL_FORM = {
    code: '', discount_type: 'percent', discount_value: '',
    min_purchase: '', max_discount: '', quota: '', valid_until: ''
};

function Marketing() {
    const [activeTab, setActiveTab] = useState('voucher');

    // SWR Data Fetching
    const { data: vouchersData } = useSWR('/vouchers', fetcher);
    const { data: bannersData } = useSWR('/banners', fetcher);

    // Derived state
    const vouchers = useMemo(() => Array.isArray(vouchersData) ? vouchersData : [], [vouchersData]);
    const banners = useMemo(() => Array.isArray(bannersData) ? bannersData : [], [bannersData]);
    const loadingVouchers = !vouchersData;
    const loadingBanners = !bannersData;

    const { registerRefreshHandler } = useRefresh();

    useEffect(() => {
        return registerRefreshHandler(async () => {
            await Promise.all([
                mutate('/vouchers'),
                mutate('/banners')
            ]);
        });
    }, [registerRefreshHandler]);

    // ========== VOUCHER STATE ==========
    const [showVoucherModal, setShowVoucherModal] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState(null);
    const [voucherForm, setVoucherForm] = useState(INITIAL_FORM);

    // ========== BANNER STATE ==========
    const [bannerTitle, setBannerTitle] = useState('');
    const [bannerFile, setBannerFile] = useState(null);
    const [bannerPreview, setBannerPreview] = useState(null);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    // ========== VOUCHER HANDLERS ==========
    const openCreateVoucher = () => {
        setEditingVoucher(null);
        setVoucherForm(INITIAL_FORM);
        setShowVoucherModal(true);
    };

    const openEditVoucher = (v) => {
        setEditingVoucher(v);
        setVoucherForm({
            code: v.code,
            discount_type: v.discount_type,
            discount_value: String(v.discount_value),
            min_purchase: String(v.min_purchase || ''),
            max_discount: String(v.max_discount || ''),
            quota: String(v.quota || ''),
            valid_until: v.valid_until ? new Date(v.valid_until).toISOString().split('T')[0] : ''
        });
        setShowVoucherModal(true);
    };

    const handleSaveVoucher = async (e) => {
        e.preventDefault();
        const toastId = toast.loading(editingVoucher ? 'Mengupdate voucher...' : 'Membuat voucher...');
        try {
            const payload = {
                ...voucherForm,
                discount_value: Number(voucherForm.discount_value),
                min_purchase: Number(voucherForm.min_purchase) || 0,
                max_discount: Number(voucherForm.max_discount) || 0,
                quota: Number(voucherForm.quota) || 0,
            };

            if (editingVoucher) {
                await voucherAPI.update(editingVoucher._id, payload);
                toast.success('Voucher berhasil diupdate!', { id: toastId });
            } else {
                await voucherAPI.create(payload);
                toast.success('Voucher berhasil dibuat!', { id: toastId });
            }
            setShowVoucherModal(false);
            mutate('/vouchers');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal menyimpan voucher', { id: toastId });
        }
    };

    const handleToggleVoucher = async (id) => {
        try {
            await voucherAPI.toggle(id);
            mutate('/vouchers');
        } catch (err) {
            toast.error('Gagal mengubah status voucher');
        }
    };

    const handleDeleteVoucher = async (id) => {
        if (!confirm('Hapus voucher ini?')) return;
        try {
            await voucherAPI.delete(id);
            toast.success('Voucher dihapus');
            mutate('/vouchers');
        } catch (err) {
            toast.error('Gagal menghapus voucher');
        }
    };

    // ========== BANNER HANDLERS ==========
    const handleBannerFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setBannerFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setBannerPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleUploadBanner = async (e) => {
        e.preventDefault();
        if (!bannerFile) { toast.error('Pilih gambar banner!'); return; }

        const toastId = toast.loading('Mengupload banner...');
        setUploadingBanner(true);
        try {
            const formData = new FormData();
            formData.append('image', bannerFile);
            formData.append('title', bannerTitle);

            await bannerAPI.create(formData);
            toast.success('Banner berhasil diupload!', { id: toastId });
            setBannerFile(null);
            setBannerPreview(null);
            setBannerTitle('');
            mutate('/banners');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Gagal upload banner', { id: toastId });
        } finally { setUploadingBanner(false); }
    };

    const handleDeleteBanner = async (id) => {
        if (!confirm('Hapus banner ini?')) return;
        try {
            await bannerAPI.delete(id);
            toast.success('Banner dihapus');
            mutate('/banners');
        } catch (err) {
            toast.error('Gagal menghapus banner');
        }
    };

    // ========== RENDER ==========
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">📢 Pusat Marketing</h1>
                    <p className="text-gray-400 text-sm mt-1">Kelola voucher, banner, dan strategi promosi</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-purple-500/20 w-fit">
                {[
                    { key: 'voucher', label: '🎟️ Voucher', count: vouchers.length },
                    { key: 'banner', label: '🖼️ Banner', count: banners.length },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === tab.key
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        {tab.label}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20' : 'bg-white/10'}`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* TAB 1: VOUCHER */}
            {activeTab === 'voucher' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* Action Bar */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white">Daftar Voucher</h2>
                        <button
                            onClick={openCreateVoucher}
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                        >
                            + Buat Voucher
                        </button>
                    </div>

                    {/* Voucher Table */}
                    <div className="bg-white/5 rounded-xl border border-purple-500/20 overflow-hidden">
                        {loadingVouchers ? (
                            <div className="p-8 text-center text-gray-400">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mx-auto mb-3"></div>
                                Memuat voucher...
                            </div>
                        ) : vouchers.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="text-5xl mb-3">🎟️</div>
                                <p className="text-gray-400">Belum ada voucher. Buat voucher pertama!</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10 text-gray-400">
                                            <th className="text-left p-4">Kode</th>
                                            <th className="text-left p-4">Tipe</th>
                                            <th className="text-left p-4">Nilai</th>
                                            <th className="text-left p-4">Min. Belanja</th>
                                            <th className="text-left p-4">Kuota</th>
                                            <th className="text-left p-4">Expired</th>
                                            <th className="text-center p-4">Status</th>
                                            <th className="text-center p-4">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {vouchers.map(v => {
                                            const isExpired = new Date() > new Date(v.valid_until);
                                            const isQuotaFull = v.quota > 0 && v.used_count >= v.quota;
                                            return (
                                                <tr key={v._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    <td className="p-4">
                                                        <span className="font-mono font-bold text-purple-300 bg-purple-500/10 px-2 py-1 rounded">
                                                            {v.code}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-gray-300">
                                                        {v.discount_type === 'percent' ? '% Persentase' : 'Rp Nominal'}
                                                    </td>
                                                    <td className="p-4 font-bold text-white">
                                                        {v.discount_type === 'percent'
                                                            ? `${v.discount_value}%`
                                                            : formatCurrency(v.discount_value)
                                                        }
                                                    </td>
                                                    <td className="p-4 text-gray-300">
                                                        {v.min_purchase > 0 ? formatCurrency(v.min_purchase) : '-'}
                                                    </td>
                                                    <td className="p-4 text-gray-300">
                                                        {v.quota > 0 ? `${v.used_count}/${v.quota}` : '∞'}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`text-xs ${isExpired ? 'text-red-400' : 'text-gray-300'}`}>
                                                            {formatDate(v.valid_until)}
                                                            {isExpired && ' (Expired)'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <button
                                                            onClick={() => handleToggleVoucher(v._id)}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${v.is_active ? 'bg-green-500' : 'bg-gray-600'}`}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${v.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                                        </button>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => openEditVoucher(v)}
                                                                className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteVoucher(v._id)}
                                                                className="px-2 py-1 text-xs bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* TAB 2: BANNER */}
            {activeTab === 'banner' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* Upload Form */}
                    <div className="bg-white/5 rounded-xl p-6 border border-purple-500/20">
                        <h3 className="text-lg font-bold text-white mb-4">Upload Banner Promo</h3>
                        <form onSubmit={handleUploadBanner} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Judul Banner (Opsional)</label>
                                <input
                                    type="text"
                                    value={bannerTitle}
                                    onChange={(e) => setBannerTitle(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                                    placeholder="Misal: Promo Akhir Pekan"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Gambar Banner *</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleBannerFileChange}
                                    className="block w-full text-sm text-gray-400
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-full file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-purple-600 file:text-white
                                        hover:file:bg-purple-700"
                                />
                                {bannerPreview && (
                                    <div className="mt-3 relative w-full h-40 rounded-xl overflow-hidden border border-white/20">
                                        <img src={bannerPreview} alt="Preview" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={uploadingBanner || !bannerFile}
                                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl disabled:opacity-50 hover:shadow-lg hover:shadow-purple-500/25 transition-all flex items-center gap-2"
                            >
                                {uploadingBanner ? (
                                    <><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div> Mengupload...</>
                                ) : (
                                    <>📤 Upload Banner</>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Banner List */}
                    <div>
                        <h3 className="text-lg font-bold text-white mb-3">Banner Aktif</h3>
                        {loadingBanners ? (
                            <div className="p-8 text-center text-gray-400">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mx-auto mb-3"></div>
                                Memuat banner...
                            </div>
                        ) : banners.length === 0 ? (
                            <div className="bg-white/5 rounded-xl p-12 text-center border border-purple-500/20">
                                <div className="text-5xl mb-3">🖼️</div>
                                <p className="text-gray-400">Belum ada banner. Upload banner promosi pertama!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {banners.map(b => (
                                    <div key={b._id} className="relative group bg-white/5 rounded-xl overflow-hidden border border-purple-500/20 hover:border-purple-500/40 transition-all">
                                        <img src={b.image_url} alt={b.title || 'Banner'} className="w-full h-40 object-cover" />
                                        <div className="p-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-white truncate">{b.title || 'Tanpa Judul'}</p>
                                                <p className="text-xs text-gray-500">{formatDate(b.createdAt)}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteBanner(b._id)}
                                                className="px-3 py-1.5 text-xs bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/40 transition-colors"
                                            >
                                                🗑️ Hapus
                                            </button>
                                        </div>
                                        {!b.is_active && (
                                            <div className="absolute top-2 right-2 px-2 py-0.5 bg-red-500/80 text-white text-xs rounded-full">
                                                Nonaktif
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* VOUCHER MODAL */}
            {showVoucherModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-gradient-to-br from-[#1E1B4B] to-[#0F0A1F] rounded-2xl p-6 w-full max-w-lg border border-purple-500/30 shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">
                                {editingVoucher ? '✏️ Edit Voucher' : '🎟️ Buat Voucher Baru'}
                            </h3>
                            <button onClick={() => setShowVoucherModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
                        </div>

                        <form onSubmit={handleSaveVoucher} className="space-y-4">
                            {/* Kode Voucher */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Kode Voucher *</label>
                                <input
                                    type="text"
                                    value={voucherForm.code}
                                    onChange={e => setVoucherForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white font-mono text-lg uppercase placeholder-gray-500 focus:border-purple-500 outline-none"
                                    placeholder="HEMAT20"
                                    required
                                />
                            </div>

                            {/* Tipe Diskon */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Tipe Diskon *</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['percent', 'nominal'].map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setVoucherForm(prev => ({ ...prev, discount_type: type }))}
                                            className={`py-2 px-4 rounded-xl border-2 font-bold transition-all ${voucherForm.discount_type === type
                                                ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                                                : 'border-white/10 bg-white/5 text-gray-400 hover:border-purple-500/50'
                                                }`}
                                        >
                                            {type === 'percent' ? '% Persentase' : 'Rp Nominal'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Nilai Diskon */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">
                                    Nilai Diskon * {voucherForm.discount_type === 'percent' ? '(%)' : '(Rp)'}
                                </label>
                                <input
                                    type="number"
                                    value={voucherForm.discount_value}
                                    onChange={e => setVoucherForm(prev => ({ ...prev, discount_value: e.target.value }))}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                                    placeholder={voucherForm.discount_type === 'percent' ? '20' : '10000'}
                                    required
                                />
                            </div>

                            {/* Max Diskon (untuk tipe percent) */}
                            {voucherForm.discount_type === 'percent' && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Maks. Potongan (Rp)</label>
                                    <input
                                        type="number"
                                        value={voucherForm.max_discount}
                                        onChange={e => setVoucherForm(prev => ({ ...prev, max_discount: e.target.value }))}
                                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                                        placeholder="50000"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Kosongkan jika tanpa batas</p>
                                </div>
                            )}

                            {/* Min Belanja */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Min. Belanja (Rp)</label>
                                <input
                                    type="number"
                                    value={voucherForm.min_purchase}
                                    onChange={e => setVoucherForm(prev => ({ ...prev, min_purchase: e.target.value }))}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                                    placeholder="0"
                                />
                            </div>

                            {/* Kuota */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Kuota Penggunaan</label>
                                <input
                                    type="number"
                                    value={voucherForm.quota}
                                    onChange={e => setVoucherForm(prev => ({ ...prev, quota: e.target.value }))}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                                    placeholder="0 = Tanpa Batas"
                                />
                            </div>

                            {/* Tanggal Expired */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Berlaku Sampai *</label>
                                <input
                                    type="date"
                                    value={voucherForm.valid_until}
                                    onChange={e => setVoucherForm(prev => ({ ...prev, valid_until: e.target.value }))}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                                    required
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowVoucherModal(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                                >
                                    {editingVoucher ? 'Update Voucher' : 'Buat Voucher'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default Marketing;
