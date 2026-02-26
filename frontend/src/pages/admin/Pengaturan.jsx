import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronDown, FaChevronUp, FaCircle } from 'react-icons/fa';
import { jwtDecode } from 'jwt-decode';
import api, { settingsAPI, userAPI } from '../../services/api';
import { useRefresh } from '../../context/RefreshContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeSelector from '../../components/admin/ThemeSelector';

// Fetcher
const fetcher = url => api.get(url).then(res => res.data);

// Accordion Component
const AccordionSection = ({ id, title, icon, isOpen, onToggle, isDirty, children }) => {
    return (
        <div className="glass rounded-xl overflow-hidden border border-white/5 transition-all duration-300">
            <button
                onClick={onToggle}
                className={`w-full p-4 flex items-center justify-between transition-colors ${isOpen ? 'bg-white/10' : 'hover:bg-white/5'}`}
            >
                <div className="flex items-center gap-3">
                    <span className="text-xl">{icon}</span>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        {title}
                        {isDirty && (
                            <span className="text-red-500 text-xs animate-pulse" title="Perubahan belum disimpan">
                                <FaCircle />
                            </span>
                        )}
                    </h3>
                </div>
                <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <FaChevronDown />
                </div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                        <div className="p-4 border-t border-white/5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

function Pengaturan() {
    const { data: settingsData, error } = useSWR('/settings', fetcher);
    const isLoading = !settingsData && !error;
    const [saving, setSaving] = useState(false);

    // Theme management
    const { currentTheme, setTheme, isLoading: themeLoading } = useTheme();
    const [tenantId, setTenantId] = useState(null);
    const [themeSaving, setThemeSaving] = useState(false);

    // Get tenantId from JWT token
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                setTenantId(decoded.tenantId);
            } catch (error) {
                console.error('[Pengaturan] Failed to decode token:', error);
            }
        }
    }, []);

    // State to track open accordion section
    // Default open: 'profile'
    const [openSection, setOpenSection] = useState('profile');

    const [settings, setSettings] = useState({
        businessName: 'Warkop Santai',
        tagline: 'Ngopi Enak, Harga Merakyat',
        phone: '',
        address: '',
        logo: null,
        // Wi-Fi
        wifiName: '',
        wifiPassword: '',
        // Receipt settings
        receiptHeader: '',
        receiptFooter: 'Terima kasih sudah berkunjung!',
        showLogo: true,
        autoPrint: false,
        // Payment settings
        enableQris: false,
        qrisImage: null,
        bankName: '',
        bankAccount: '',
        bankAccountName: '',
        // eWallet
        ewalletType: '',
        ewalletNumber: '',
        ewalletName: '',
        // Cash Prepayment
        isCashPrepaymentRequired: false,
        // Staff Permissions
        allowStaffEditInventory: false,
        // Tax
        enableTax: false,
        taxPercent: 11,
        notificationSoundUrl: '',
        // Cash Drawer Visibility
        showCashToStaff: true,
        showNonCashToStaff: true
    });

    const [initialSettings, setInitialSettings] = useState(null);

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordSaving, setPasswordSaving] = useState(false);

    // Sync SWR data to local state
    useEffect(() => {
        if (settingsData) {
            const data = { ...settings, ...settingsData };
            setSettings(data);
            setInitialSettings(data);
        }
    }, [settingsData]);

    const { registerRefreshHandler } = useRefresh();

    useEffect(() => {
        return registerRefreshHandler(async () => {
            await mutate('/settings');
        });
    }, [registerRefreshHandler]);

    // Check if section is dirty
    const checkDirty = (keys) => {
        if (!initialSettings) return false;
        return keys.some(key => settings[key] !== initialSettings[key]);
    };

    const handleSave = async () => {
        const toastId = toast.loading('Menyimpan pengaturan...');
        try {
            setSaving(true);
            await settingsAPI.update(settings);
            mutate('/settings'); // Refresh settings cache
            setInitialSettings(settings); // Update initial settings to current
            toast.success('Pengaturan berhasil disimpan!', { id: toastId });
        } catch (err) {
            console.error('Error saving settings:', err);
            toast.error('Gagal menyimpan pengaturan', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setSettings({ ...settings, logo: reader.result });
        };
        reader.readAsDataURL(file);
    };

    const handleQrisUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setSettings({ ...settings, qrisImage: reader.result });
        };
        reader.readAsDataURL(file);
    };

    const handleSoundUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('soundFile', file);

        const toastId = toast.loading('Mengupload suara...');
        try {
            const res = await settingsAPI.uploadSound(formData);

            // Backend returns full URL or relative path depending on env.
            // We store it as is.
            const newUrl = res.data.soundUrl;
            setSettings(prev => {
                const updated = { ...prev, notificationSoundUrl: newUrl };
                // Also update initial settings for this field to avoid dirty flag unless we want to allow saving it ?
                // Usually upload saves immediately, so let's update initial too
                // But wait, user might want to Save All to confirm? 
                // The API uploadSound saves the file but doesn't necessarily update the settings document unless we save the URL.
                // However the previous code didn't save the URL to settings until handleSave? 
                // Ah, previous code: setSettings({...}, notificationSoundUrl: res.data.soundUrl)
                // And then handleSave sends settings.
                // So yes, it counts as a change until saved.
                return updated;
            });

            toast.success('Suara berhasil diupload!', { id: toastId });
        } catch (err) {
            console.error('Error upload sound:', err);
            toast.error('Gagal upload suara', { id: toastId });
        }
    };

    const handleTestSound = () => {
        if (settings.notificationSoundUrl) {
            let soundUrl = settings.notificationSoundUrl;

            // If URL is relative (starts with /), prepend API base URL (minus /api)
            if (soundUrl.startsWith('/')) {
                // Get API URL from env or default
                const apiUrl = import.meta.env.VITE_API_URL || '';
                // Remove '/api' from the end to get base URL
                const baseUrl = apiUrl.replace(/\/api$/, '');
                soundUrl = `${baseUrl}${soundUrl}`;
            }

            console.log('Testing sound URL:', soundUrl);
            new Audio(soundUrl).play().catch(e => {
                console.error('Play error:', e);
                toast.error('Gagal memutar suara: ' + e.message);
            });
        } else {
            toast.error('Belum ada suara notifikasi');
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('Password baru dan konfirmasi tidak cocok');
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            toast.error('Password baru minimal 6 karakter');
            return;
        }

        const toastId = toast.loading('Mengubah password...');
        try {
            setPasswordSaving(true);
            await userAPI.changePassword({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            toast.success('Password berhasil diubah, silakan login ulang', { id: toastId });
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });

            // Optional: Logout logic could go here
            // setTimeout(() => {
            //     localStorage.removeItem('token');
            //     window.location.href = '/login';
            // }, 2000);

        } catch (err) {
            console.error('Change password error:', err);
            toast.error(err.response?.data?.error || 'Gagal mengubah password', { id: toastId });
        } finally {
            setPasswordSaving(false);
        }
    };

    const toggleSection = (id) => {
        setOpenSection(openSection === id ? null : id);
    };

    // Handle theme change
    const handleThemeChange = async (themeName) => {
        if (!tenantId) {
            toast.error('Tenant ID tidak ditemukan');
            return;
        }

        const toastId = toast.loading('Menyimpan tema...');
        try {
            setThemeSaving(true);
            
            // Update theme via API
            await api.put(`/tenants/${tenantId}/theme`, { theme: themeName });
            
            // Update theme in context (this will apply CSS variables)
            const success = await setTheme(themeName);
            
            if (success) {
                toast.success('Tema berhasil disimpan!', { id: toastId });
            } else {
                toast.error('Gagal menerapkan tema', { id: toastId });
            }
        } catch (error) {
            console.error('[Pengaturan] Failed to save theme:', error);
            toast.error(error.response?.data?.error || 'Gagal menyimpan tema', { id: toastId });
        } finally {
            setThemeSaving(false);
        }
    };

    if (isLoading) {
        return (
            <section className="p-4 md:p-6 space-y-6">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            </section>
        );
    }

    return (
        <section className="p-4 md:p-6 space-y-6 pb-24">

            {/* Business Profile */}
            <AccordionSection
                id="profile"
                title="Profil Usaha"
                icon="🏪"
                isOpen={openSection === 'profile'}
                onToggle={() => toggleSection('profile')}
                isDirty={checkDirty(['businessName', 'tagline', 'phone', 'address', 'logo'])}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Logo */}
                    <div className="md:col-span-2">
                        <label className="block text-sm text-gray-400 mb-1">Logo Usaha</label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden">
                                {settings.logo ? (
                                    <img src={settings.logo} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-3xl">☕</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logoInput" />
                                <button
                                    onClick={() => document.getElementById('logoInput').click()}
                                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-sm"
                                >
                                    📷 Upload Logo
                                </button>
                                <p className="text-xs text-gray-400 mt-1">Ukuran rekomendasi: 200x200px (PNG/JPG)</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Nama Usaha</label>
                        <input
                            type="text"
                            value={settings.businessName}
                            onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Tagline</label>
                        <input
                            type="text"
                            value={settings.tagline}
                            onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">No. WhatsApp Pemilik</label>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-2 rounded-lg bg-white/5 text-gray-400">+62</span>
                            <input
                                type="tel"
                                value={settings.phone}
                                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                                className="flex-1 w-full min-w-0 px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                placeholder="81234567890"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Alamat</label>
                        <input
                            type="text"
                            value={settings.address}
                            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                        />
                    </div>
                </div>
            </AccordionSection>

            {/* Theme Settings */}
            <AccordionSection
                id="theme"
                title="Mode Tampilan"
                icon="🎨"
                isOpen={openSection === 'theme'}
                onToggle={() => toggleSection('theme')}
                isDirty={false} // Theme changes are saved immediately
            >
                <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-xl border border-purple-500/20">
                        <p className="text-sm text-gray-400 mb-4">
                            Pilih tema tampilan yang sesuai dengan preferensi Anda. Perubahan akan diterapkan secara langsung.
                        </p>
                        
                        {/* Current Theme Display */}
                        <div className="mb-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                            <p className="text-xs text-gray-400 mb-1">Tema Aktif Saat Ini:</p>
                            <p className="text-lg font-bold text-purple-300">
                                {currentTheme === 'default' ? '🌙 Default (Dark Purple)' : '☕ Light Coffee'}
                            </p>
                        </div>

                        {/* Theme Selector Component */}
                        <ThemeSelector
                            currentTheme={currentTheme}
                            onThemeChange={handleThemeChange}
                            disabled={themeSaving || themeLoading}
                        />
                    </div>
                </div>
            </AccordionSection>

            {/* Wi-Fi Settings */}
            <AccordionSection
                id="wifi"
                title="Informasi Wi-Fi"
                icon="📶"
                isOpen={openSection === 'wifi'}
                onToggle={() => toggleSection('wifi')}
                isDirty={checkDirty(['wifiName', 'wifiPassword'])}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Nama Wi-Fi (SSID)</label>
                        <input
                            type="text"
                            value={settings.wifiName || ''}
                            onChange={(e) => setSettings({ ...settings, wifiName: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                            placeholder="Contoh: Warkop Santai Free"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Password Wi-Fi</label>
                        <input
                            type="text"
                            value={settings.wifiPassword || ''}
                            onChange={(e) => setSettings({ ...settings, wifiPassword: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                            placeholder="Contoh: ngopidulu123"
                        />
                    </div>
                </div>
            </AccordionSection>

            {/* Notification Settings */}
            <AccordionSection
                id="notification"
                title="Pengaturan Notifikasi"
                icon="🔔"
                isOpen={openSection === 'notification'}
                onToggle={() => toggleSection('notification')}
                isDirty={checkDirty(['notificationSoundUrl'])}
            >
                <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-xl">
                        <label className="block text-sm text-gray-400 mb-2">Suara Notifikasi Pesanan Baru</label>
                        <div className="flex flex-wrap items-center gap-4">
                            <input type="file" accept="audio/*" onChange={handleSoundUpload} className="hidden" id="soundInput" />
                            <div className="flex-1 min-w-[200px]">
                                <button
                                    onClick={() => document.getElementById('soundInput').click()}
                                    className="w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                                >
                                    <span>🎵</span>
                                    <span>Upload Suara (.mp3/.wav)</span>
                                </button>
                            </div>
                            {settings.notificationSoundUrl && (
                                <div className="flex-shrink-0">
                                    <button
                                        onClick={handleTestSound}
                                        className="h-full px-4 py-3 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors flex items-center gap-2"
                                    >
                                        <span>▶️</span>
                                        <span>Test Suara</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {settings.notificationSoundUrl ? '✅ File kustom aktif' : 'ℹ️ Menggunakan suara default'}
                        </p>
                    </div>
                </div>
            </AccordionSection>

            {/* Receipt Settings */}
            <AccordionSection
                id="receipt"
                title="Pengaturan Struk"
                icon="🧾"
                isOpen={openSection === 'receipt'}
                onToggle={() => toggleSection('receipt')}
                isDirty={checkDirty(['receiptHeader', 'receiptFooter', 'showLogo', 'autoPrint'])}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Header Struk (Tambahan)</label>
                        <input
                            type="text"
                            value={settings.receiptHeader}
                            onChange={(e) => setSettings({ ...settings, receiptHeader: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                            placeholder="Misal: NPWP: 12.345.678.9-012.345"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Footer Struk</label>
                        <input
                            type="text"
                            value={settings.receiptFooter}
                            onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                        />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                        <div>
                            <p className="font-medium">Tampilkan Logo di Struk</p>
                            <p className="text-sm text-gray-400">Logo akan dicetak di bagian atas struk</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, showLogo: !settings.showLogo })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.showLogo ? 'bg-purple-600' : 'bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.showLogo ? 'ml-6' : 'ml-0.5'}`}></div>
                        </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                        <div>
                            <p className="font-medium">Auto Print Struk</p>
                            <p className="text-sm text-gray-400">Cetak struk otomatis setelah transaksi</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, autoPrint: !settings.autoPrint })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.autoPrint ? 'bg-purple-600' : 'bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.autoPrint ? 'ml-6' : 'ml-0.5'}`}></div>
                        </button>
                    </div>
                </div>
            </AccordionSection>

            {/* Payment & Cashier Settings (Combined) */}
            <AccordionSection
                id="payment"
                title="Pengaturan Pembayaran & Kasir"
                icon="💳"
                isOpen={openSection === 'payment'}
                onToggle={() => toggleSection('payment')}
                isDirty={checkDirty([
                    'enableQris', 'qrisImage', 'bankName', 'bankAccount', 'bankAccountName',
                    'ewalletType', 'ewalletNumber', 'ewalletName',
                    'isCashPrepaymentRequired', 'allowStaffEditInventory', 'showCashToStaff', 'showNonCashToStaff'
                ])}
            >
                <div className="space-y-4">
                    {/* QRIS */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                        <div>
                            <p className="font-medium">Aktifkan QRIS</p>
                            <p className="text-sm text-gray-400">Terima pembayaran via QRIS</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, enableQris: !settings.enableQris })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.enableQris ? 'bg-purple-600' : 'bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.enableQris ? 'ml-6' : 'ml-0.5'}`}></div>
                        </button>
                    </div>

                    {settings.enableQris && (
                        <div className="p-4 bg-white/5 rounded-xl">
                            <label className="block text-sm text-gray-400 mb-2">Upload Gambar QRIS</label>
                            <div className="flex items-center gap-4">
                                {settings.qrisImage && (
                                    <img src={settings.qrisImage} alt="QRIS" className="w-24 h-24 object-contain rounded-lg bg-white" />
                                )}
                                <input type="file" accept="image/*" onChange={handleQrisUpload} className="hidden" id="qrisInput" />
                                <button
                                    onClick={() => document.getElementById('qrisInput').click()}
                                    className="px-4 py-2 rounded-lg bg-white/10"
                                >
                                    📷 Upload QRIS
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Bank Transfer */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Nama Bank</label>
                            <input
                                type="text"
                                value={settings.bankName}
                                onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                placeholder="BCA, Mandiri, dll"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">No. Rekening</label>
                            <input
                                type="text"
                                value={settings.bankAccount}
                                onChange={(e) => setSettings({ ...settings, bankAccount: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Atas Nama</label>
                            <input
                                type="text"
                                value={settings.bankAccountName}
                                onChange={(e) => setSettings({ ...settings, bankAccountName: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                            />
                        </div>
                    </div>

                    {/* eWallet Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-purple-500/20 pt-4 mt-4">
                        <div className="md:col-span-3">
                            <h4 className="font-bold text-sm text-purple-300 mb-2">Dompet Digital (e-Wallet)</h4>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Jenis E-Wallet</label>
                            <input
                                type="text"
                                value={settings.ewalletType || ''}
                                onChange={(e) => setSettings({ ...settings, ewalletType: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                placeholder="Gopay/OVO/Dana"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Nomor HP</label>
                            <input
                                type="text"
                                value={settings.ewalletNumber || ''}
                                onChange={(e) => setSettings({ ...settings, ewalletNumber: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                placeholder="08xxx"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Atas Nama</label>
                            <input
                                type="text"
                                value={settings.ewalletName || ''}
                                onChange={(e) => setSettings({ ...settings, ewalletName: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                            />
                        </div>
                    </div>

                    {/* Cash Prepayment Toggle */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-yellow-500/20 mt-4">
                        <div>
                            <p className="font-medium text-yellow-100">Wajib Bayar Dulu (Tunai)</p>
                            <p className="text-sm text-gray-400">Pembeli wajib bayar di kasir sebelum pesanan diproses di dapur</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, isCashPrepaymentRequired: !settings.isCashPrepaymentRequired })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.isCashPrepaymentRequired ? 'bg-yellow-600' : 'bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.isCashPrepaymentRequired ? 'ml-6' : 'ml-0.5'}`}></div>
                        </button>
                    </div>

                    {/* Staff Permission Toggle */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-blue-500/20 mt-4">
                        <div>
                            <p className="font-medium text-blue-100">Izinkan Staff Menambahkan Bahan & Resep</p>
                            <p className="text-sm text-gray-400">Staff bisa menambah/edit bahan dan resep (Aktivitas akan direkam)</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, allowStaffEditInventory: !settings.allowStaffEditInventory })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.allowStaffEditInventory ? 'bg-blue-600' : 'bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.allowStaffEditInventory ? 'ml-6' : 'ml-0.5'}`}></div>
                        </button>
                    </div>

                    {/* Cash Drawer Visibility Settings */}
                    <div className="mt-8 border-t border-white/10 pt-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <span>💰</span> Pengaturan Kas Digital Kasir
                        </h3>
                        <div className="space-y-4">
                            {/* Show Cash Toggle */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-green-500/20">
                                <div>
                                    <p className="font-medium text-green-100">Tampilkan Saldo Tunai ke Staff</p>
                                    <p className="text-sm text-gray-400">Jika dimatikan, staff tidak bisa melihat total uang tunai di laci</p>
                                </div>
                                <button
                                    onClick={() => setSettings({ ...settings, showCashToStaff: !settings.showCashToStaff })}
                                    className={`w-12 h-6 rounded-full transition-all ${settings.showCashToStaff ? 'bg-green-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.showCashToStaff ? 'ml-6' : 'ml-0.5'}`}></div>
                                </button>
                            </div>

                            {/* Show Non-Cash Toggle */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-purple-500/20">
                                <div>
                                    <p className="font-medium text-purple-100">Tampilkan Saldo Non-Tunai ke Staff</p>
                                    <p className="text-sm text-gray-400">Jika dimatikan, staff tidak bisa melihat total pendapatan non-tunai (QRIS/Transfer)</p>
                                </div>
                                <button
                                    onClick={() => setSettings({ ...settings, showNonCashToStaff: !settings.showNonCashToStaff })}
                                    className={`w-12 h-6 rounded-full transition-all ${settings.showNonCashToStaff ? 'bg-purple-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.showNonCashToStaff ? 'ml-6' : 'ml-0.5'}`}></div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </AccordionSection>

            {/* Tax Settings */}
            <AccordionSection
                id="tax"
                title="Pengaturan Pajak"
                icon="📊"
                isOpen={openSection === 'tax'}
                onToggle={() => toggleSection('tax')}
                isDirty={checkDirty(['enableTax', 'taxPercent'])}
            >
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                        <p className="font-medium">Aktifkan PPN</p>
                        <p className="text-sm text-gray-400">Tambahkan pajak ke total transaksi</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {settings.enableTax && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={settings.taxPercent}
                                    onChange={(e) => setSettings({ ...settings, taxPercent: e.target.value })}
                                    className="w-16 px-2 py-1 rounded-lg bg-white/10 text-white text-center"
                                />
                                <span className="text-gray-400">%</span>
                            </div>
                        )}
                        <button
                            onClick={() => setSettings({ ...settings, enableTax: !settings.enableTax })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.enableTax ? 'bg-purple-600' : 'bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.enableTax ? 'ml-6' : 'ml-0.5'}`}></div>
                        </button>
                    </div>
                </div>
            </AccordionSection>

            {/* Account Security (Change Password) */}
            <AccordionSection
                id="security"
                title="Keamanan Akun"
                icon="🔒"
                isOpen={openSection === 'security'}
                onToggle={() => toggleSection('security')}
                isDirty={false} // Password form has its own state but isn't part of 'settings' object tracking
            >
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Password Saat Ini</label>
                            <input
                                type="password"
                                value={passwordForm.currentPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                placeholder="******"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Password Baru (Min 6 Karakter)</label>
                            <input
                                type="password"
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                placeholder="******"
                                minLength={6}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Konfirmasi Password Baru</label>
                            <input
                                type="password"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                placeholder="******"
                                required
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={passwordSaving}
                            className="px-6 py-2 rounded-lg bg-red-500 hover:bg-red-600 font-medium transition-colors disabled:opacity-50"
                        >
                            {passwordSaving ? '⏳ Menyimpan...' : '🔒 Ubah Password'}
                        </button>
                    </div>
                </form>
            </AccordionSection>

            {/* Save Button Floating or Bottom - Keeping it static at bottom for now, or maybe fixed?
                User asked for accordion. Let's keep it simple at the bottom of the section.
            */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900/80 backdrop-blur-lg border-t border-white/10 md:static md:bg-transparent md:border-t-0 md:p-0 z-10">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-bold text-lg disabled:opacity-50 shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    {saving ? '⏳ Menyimpan...' : '💾 Simpan Semua Pengaturan'}
                </button>
            </div>

        </section>
    );
}

export default Pengaturan;
