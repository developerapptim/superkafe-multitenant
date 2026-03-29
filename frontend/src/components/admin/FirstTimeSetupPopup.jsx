import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api, { settingsAPI, getImageUrl } from '../../services/api';

const FirstTimeSetupPopup = ({ isOpen, onComplete, onSkip }) => {
    const [settings, setSettings] = useState({
        businessName: '',
        phone: '',
        logo: null,
        isCashPrepaymentRequired: false
    });
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            const fetchSettings = async () => {
                try {
                    const res = await api.get('/settings');
                    if (res.data) {
                        setSettings({
                            businessName: res.data.businessName || '',
                            phone: res.data.phone || '',
                            logo: res.data.logo || null,
                            isCashPrepaymentRequired: res.data.isCashPrepaymentRequired || false
                        });
                    }
                } catch (error) {
                    console.error('Failed to load settings', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchSettings();
        }
    }, [isOpen]);

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const toastId = toast.loading('Mengunggah logo...');
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await api.post('/upload/images/general', formData);

            if (response.data && response.data.success) {
                setSettings({ ...settings, logo: response.data.imageUrl });
                toast.success('Logo berhasil diunggah', { id: toastId });
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Gagal mengunggah logo', { id: toastId });
        }
    };

    const handleSave = async () => {
        const toastId = toast.loading('Menyimpan pengaturan...');
        try {
            setSaving(true);
            await settingsAPI.update(settings);
            toast.success('Pengaturan awal berhasil disimpan!', { id: toastId });
            onComplete();
        } catch (err) {
            console.error('Error saving settings:', err);
            toast.error('Gagal menyimpan pengaturan', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="admin-bg-sidebar rounded-2xl w-full max-w-lg border admin-border-accent shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="bg-black/10 p-6 text-center shrink-0 border-b admin-border-accent">
                        <h2 className="text-2xl font-bold admin-text-primary mb-2">Setup Profil Usaha 🏪</h2>
                        <p className="admin-text-primary opacity-80 text-sm">
                            Lengkapi profil usaha Anda agar pelanggan lebih mudah mengenali kafe Anda.
                        </p>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
                        {loading ? (
                            <div className="flex justify-center items-center h-32">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                            </div>
                        ) : (
                            <>
                                {/* Logo Upload */}
                                <div>
                                    <label className="block text-sm admin-text-primary font-medium opacity-90 mb-2">Logo Usaha</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-xl bg-black/20 flex items-center justify-center overflow-hidden border admin-border-accent">
                                            {settings.logo ? (
                                                <img src={getImageUrl(settings.logo)} alt="Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-2xl">☕</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="setupLogoInput" />
                                            <button
                                                onClick={() => document.getElementById('setupLogoInput').click()}
                                                className="px-4 py-2 rounded-lg bg-black/10 hover:bg-black/20 admin-text-primary font-medium text-sm transition-colors border admin-border-accent"
                                            >
                                                📷 Upload Logo
                                            </button>
                                            <p className="text-xs admin-text-primary opacity-60 mt-2">Format disarankan: PNG/JPG (200x200px)</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Business Name */}
                                <div>
                                    <label className="block text-sm admin-text-primary font-medium opacity-90 mb-1">Nama Usaha</label>
                                    <input
                                        type="text"
                                        value={settings.businessName}
                                        onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl admin-input focus:outline-none transition-colors"
                                        placeholder="Contoh: SuperKafe"
                                    />
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-sm admin-text-primary font-medium opacity-90 mb-1">No. WhatsApp Pemilik</label>
                                    <div className="flex items-center gap-2">
                                        <span className="px-4 py-3 rounded-xl bg-black/10 border admin-border-accent admin-text-primary opacity-80 font-medium">+62</span>
                                        <input
                                            type="tel"
                                            value={settings.phone}
                                            onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                                            className="flex-1 min-w-0 px-4 py-3 rounded-xl admin-input focus:outline-none transition-colors"
                                            placeholder="81234567890"
                                        />
                                    </div>
                                </div>

                                {/* Cashier System Settings */}
                                <div>
                                    <label className="block text-sm admin-text-primary font-medium opacity-90 mb-2">Pengaturan Kasir</label>
                                    <div className="flex items-center justify-between p-4 bg-black/5 rounded-xl border admin-border-accent">
                                        <div>
                                            <p className="font-medium admin-text-primary mb-1 leading-tight">Wajib Bayar Dulu (Tunai)</p>
                                            <p className="text-xs admin-text-primary opacity-70 leading-snug">Pesanan baru diproses setelah pelanggan membayar tagihan di kasir.</p>
                                        </div>
                                        <button
                                            onClick={() => setSettings({ ...settings, isCashPrepaymentRequired: !settings.isCashPrepaymentRequired })}
                                            className={`shrink-0 w-12 h-6 rounded-full transition-all ml-4 ${settings.isCashPrepaymentRequired ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}
                                        >
                                            <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.isCashPrepaymentRequired ? 'ml-6' : 'ml-0.5'}`}></div>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 bg-black/10 border-t admin-border-accent flex flex-col gap-3 shrink-0">
                        <button 
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="w-full py-3.5 rounded-xl admin-button-primary font-bold text-base shadow-lg transition-all outline-none disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {saving ? 'Menyimpan...' : 'Simpan & Lanjutkan'}
                        </button>
                        <button 
                            onClick={onSkip}
                            disabled={saving}
                            className="w-full py-2.5 rounded-xl admin-text-primary opacity-60 hover:opacity-100 font-medium text-sm transition-opacity disabled:opacity-30"
                        >
                            Lewati untuk sekarang
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};

export default FirstTimeSetupPopup;
