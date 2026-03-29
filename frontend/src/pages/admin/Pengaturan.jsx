import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronDown, FaChevronUp, FaCircle } from 'react-icons/fa';
import { jwtDecode } from 'jwt-decode';
import api, { settingsAPI, userAPI, API_BASE_URL, getImageUrl } from '../../services/api';
import { useRefresh } from '../../context/RefreshContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeSelector from '../../components/admin/ThemeSelector';
import usePlatform from '../../hooks/usePlatform';
import { useNavigate, useOutletContext } from 'react-router-dom';

// Import admin theme generated CSS classes
import '../../styles/admin-theme.css';

import PinModal from '../../components/admin/PinModal';

// Fetcher
const fetcher = url => api.get(url).then(res => res.data);

// Accordion Component
const AccordionSection = ({ id, title, icon, isOpen, onToggle, isDirty, children }) => {
    return (
        <div className="admin-card rounded-xl overflow-hidden transition-all duration-300">
            <button
                onClick={onToggle}
                className={`w-full p-4 flex items-center justify-between transition-colors ${isOpen ? 'bg-black/10' : 'hover:bg-black/5'}`}
            >
                <div className="flex items-center gap-3">
                    <span className="text-xl admin-text-primary">{icon}</span>
                    <h3 className="font-bold text-lg flex items-center gap-2 admin-text-primary">
                        {title}
                        {isDirty && (
                            <span className="text-red-500 text-xs animate-pulse" title="Perubahan belum disimpan">
                                <FaCircle />
                            </span>
                        )}
                    </h3>
                </div>
                <div className={`transition-transform duration-300 admin-text-primary ${isOpen ? 'rotate-180' : ''}`}>
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
                        <div className="p-4 border-t admin-border-accent bg-black/5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

function Pengaturan() {
    const { isWeb } = usePlatform();
    const outletContext = useOutletContext();
    const isSidebarCollapsed = outletContext?.isSidebarCollapsed ?? false;
    const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
    const { data: settingsData, error } = useSWR('/settings', fetcher);
    const isLoading = !settingsData && !error;
    const [saving, setSaving] = useState(false);

    // Subscription Status State
    const [subscription, setSubscription] = useState({ loading: true, data: null });

    // Theme management
    const { currentTheme, setTheme, isLoading: themeLoading } = useTheme();
    const [tenantId, setTenantId] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [themeSaving, setThemeSaving] = useState(false);

    // Get tenantId and role from JWT token
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                setTenantId(decoded.tenantId);
                setUserRole(decoded.role || 'staff');
            } catch (error) {
                console.error('[Pengaturan] Failed to decode token:', error);
            }
        }
    }, []);

    // FAQ Management State
    const [faqs, setFaqs] = useState([]);
    const [initialFaqs, setInitialFaqs] = useState([]);

    // Fetch FAQs independently
    useEffect(() => {
        const fetchTenantData = async () => {
            const slug = localStorage.getItem('tenant_slug');
            if (!slug) return;
            try {
                const res = await api.get(`/tenants/${slug}`);
                if (res.data.success && res.data.data.faqs) {
                    setFaqs(res.data.data.faqs);
                    setInitialFaqs(res.data.data.faqs);
                }
            } catch (error) {
                console.error('Error fetching tenant data for faqs:', error);
            }
        };
        fetchTenantData();
    }, []);

    // Fetch Subscription Detail on Mount
    useEffect(() => {
        const fetchSubStatus = async () => {
            try {
                const tenantSlug = localStorage.getItem('tenant_slug');
                if (!tenantSlug) return;
                const response = await api.get(`/tenants/${tenantSlug}/trial-status`);
                if (response.data.success) {
                    setSubscription({ loading: false, data: response.data.data });
                }
            } catch (error) {
                console.error('Error fetching subscription in settings:', error);
                setSubscription({ loading: false, data: null });
            }
        };
        fetchSubStatus();
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
        customerTheme: 'default',
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

    // PIN Security State - using direct API call instead of SWR for reliability
    const [pinStatus, setPinStatus] = useState({ isPinSecurityEnabled: false, hasPinInstalled: false });
    const [pinLoading, setPinLoading] = useState(false);
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pinModalMode, setPinModalMode] = useState('set'); // 'set' or 'change'
    
    // Add navigate 
    const navigate = useNavigate();
    const tenantSlug = localStorage.getItem('tenant_slug');

    // Fetch PIN status on mount
    const fetchPinStatus = async () => {
        try {
            const res = await api.get('/auth/pin-status');
            if (res.data && res.data.success) {
                setPinStatus({
                    isPinSecurityEnabled: res.data.isPinSecurityEnabled || false,
                    hasPinInstalled: res.data.hasPinInstalled || false
                });
            }
        } catch (err) {
            console.warn('PIN status fetch failed:', err.message);
        }
    };

    useEffect(() => {
        fetchPinStatus();
    }, []);

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

    const handleSaveFaqs = async () => {
        if (!tenantId) {
            toast.error('Tenant ID tidak ditemukan');
            return;
        }
        const toastId = toast.loading('Menyimpan FAQ...');
        try {
            const res = await api.put(`/tenants/${tenantId}/faqs`, { faqs });
            if (res.data.success) {
                toast.success('FAQ berhasil disimpan!', { id: toastId });
                setInitialFaqs(faqs);
            }
        } catch (error) {
            console.error('Error saving FAQs:', error);
            toast.error('Gagal menyimpan FAQ', { id: toastId });
        }
    };

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

    const handleQrisUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const toastId = toast.loading('Mengunggah QRIS...');
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await api.post('/upload/images/general', formData);

            if (response.data && response.data.success) {
                setSettings({ ...settings, qrisImage: response.data.imageUrl });
                toast.success('QRIS berhasil diunggah', { id: toastId });
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Gagal mengunggah QRIS', { id: toastId });
        }
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
                const apiUrl = API_BASE_URL || '';
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

    const handleTogglePinSecurity = async () => {
        const isEnable = !pinStatus.isPinSecurityEnabled;

        // Jika mau mengaktifkan tapi belum pernah set PIN
        if (isEnable && !pinStatus.hasPinInstalled) {
            setPinModalMode('set');
            setIsPinModalOpen(true);
            return;
        }

        const toastId = toast.loading('Menyimpan pengaturan PIN...');
        try {
            setPinLoading(true);
            const res = await api.post('/auth/toggle-pin-security', { isEnabled: isEnable });
            if (res.data?.success) {
                setPinStatus(prev => ({ ...prev, isPinSecurityEnabled: isEnable }));
            }
            toast.success(isEnable ? 'Keamanan PIN diaktifkan' : 'Keamanan PIN dinonaktifkan', { id: toastId });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal mengubah pengaturan PIN', { id: toastId });
        } finally {
            setPinLoading(false);
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
                <div id="tour-profil-usaha" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Logo */}
                    <div className="md:col-span-2">
                        <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Logo Usaha</label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden shadow-sm">
                                {settings.logo ? (
                                    <img src={getImageUrl(settings.logo)} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-3xl">☕</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logoInput" />
                                <button
                                    onClick={() => document.getElementById('logoInput').click()}
                                    className="px-4 py-2 rounded-lg admin-button-primary shadow-sm text-sm"
                                >
                                    📷 Upload Logo
                                </button>
                                <p className="text-xs opacity-60 admin-text-primary mt-2">Ukuran rekomendasi: 200x200px (PNG/JPG)</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Nama Usaha</label>
                        <input
                            type="text"
                            value={settings.businessName}
                            onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg admin-input"
                        />
                    </div>
                    <div>
                        <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Tagline</label>
                        <input
                            type="text"
                            value={settings.tagline}
                            onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg admin-input"
                        />
                    </div>
                    <div>
                        <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">No. WhatsApp Pemilik</label>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-2 rounded-lg bg-black/10 admin-text-primary opacity-80">+62</span>
                            <input
                                type="tel"
                                value={settings.phone}
                                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                                className="flex-1 w-full min-w-0 px-4 py-2 rounded-lg admin-input"
                                placeholder="81234567890"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Alamat</label>
                        <input
                            type="text"
                            value={settings.address}
                            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg admin-input"
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
                isDirty={checkDirty(['customerTheme'])} // Admin theme is saved immediately, but customerTheme is deferred
            >
                <div className="space-y-4">
                    <div className="p-4 bg-black/5 rounded-xl border admin-border-accent">
                        <p className="text-sm opacity-80 admin-text-primary mb-4">
                            Pilih tema tampilan yang sesuai dengan preferensi Anda. Perubahan akan diterapkan secara langsung.
                        </p>

                        {/* Current Theme Display */}
                        <div className="mb-4 p-3 bg-black/10 rounded-lg border admin-border-accent">
                            <p className="text-xs opacity-60 admin-text-primary mb-1">Tema Aktif Saat Ini:</p>
                            <p className="text-lg font-bold admin-text-primary opacity-90">
                                {currentTheme === 'default' ? '🌙 Default (Dark Purple)' : '☕ Light Coffee'}
                            </p>
                        </div>

                        {/* Theme Selector Component */}
                        <ThemeSelector
                            currentTheme={currentTheme}
                            onThemeChange={handleThemeChange}
                            disabled={themeSaving || themeLoading}
                            disablePreview={true}
                        />
                    </div>

                    {/* Customer Theme Selector */}
                    <div className="p-4 bg-black/5 rounded-xl border admin-border-accent mt-4">
                        <h4 className="font-bold admin-text-primary mb-2">Tema Tampilan Customer</h4>
                        <p className="text-sm opacity-80 admin-text-primary mb-4">
                            Pilih tema yang akan dilihat oleh pelanggan Anda saat mereka memindai kode QR atau membuka website menu. Perubahan akan tersimpan saat Anda menekan tombol "Simpan Pengaturan".
                        </p>
                        <ThemeSelector
                            currentTheme={settings.customerTheme || 'default'}
                            onThemeChange={(theme) => setSettings({ ...settings, customerTheme: theme })}
                            disabled={saving}
                            disablePreview={true}
                            isCustomerSelector={true}
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
                        <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Nama Wi-Fi (SSID)</label>
                        <input
                            type="text"
                            value={settings.wifiName || ''}
                            onChange={(e) => setSettings({ ...settings, wifiName: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg admin-input"
                            placeholder="Contoh: Warkop Santai Free"
                        />
                    </div>
                    <div>
                        <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Password Wi-Fi</label>
                        <input
                            type="text"
                            value={settings.wifiPassword || ''}
                            onChange={(e) => setSettings({ ...settings, wifiPassword: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg admin-input"
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
                <div id="tour-notifikasi" className="space-y-4">
                    <div className="p-4 bg-black/5 rounded-xl border admin-border-accent">
                        <label className="block text-sm opacity-80 admin-text-primary font-medium mb-2">Suara Notifikasi Pesanan Baru</label>
                        <div className="flex flex-wrap items-center gap-4">
                            <input type="file" accept="audio/*" onChange={handleSoundUpload} className="hidden" id="soundInput" />
                            <div className="flex-1 min-w-[200px]">
                                <button
                                    onClick={() => document.getElementById('soundInput').click()}
                                    className="w-full px-4 py-3 rounded-lg bg-black/10 hover:bg-black/20 admin-text-primary transition-colors flex items-center justify-center gap-2"
                                >
                                    <span>🎵</span>
                                    <span className="opacity-90">Upload Suara (.mp3/.wav)</span>
                                </button>
                            </div>
                            {settings.notificationSoundUrl && (
                                <div className="flex-shrink-0">
                                    <button
                                        onClick={handleTestSound}
                                        className="h-full px-4 py-3 rounded-lg bg-green-500/20 text-green-600 hover:bg-green-500/30 transition-colors flex items-center gap-2 font-medium"
                                    >
                                        <span>▶️</span>
                                        <span>Test Suara</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <p className="text-xs opacity-60 admin-text-primary mt-3">
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
                        <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Header Struk (Tambahan)</label>
                        <input
                            type="text"
                            value={settings.receiptHeader}
                            onChange={(e) => setSettings({ ...settings, receiptHeader: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg admin-input"
                            placeholder="Misal: NPWP: 12.345.678.9-012.345"
                        />
                    </div>
                    <div>
                        <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Footer Struk</label>
                        <input
                            type="text"
                            value={settings.receiptFooter}
                            onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg admin-input"
                        />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-black/5 rounded-xl border admin-border-accent">
                        <div>
                            <p className="font-medium admin-text-primary">Tampilkan Logo di Struk</p>
                            <p className="text-sm opacity-70 admin-text-primary">Logo akan dicetak di bagian atas struk</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, showLogo: !settings.showLogo })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.showLogo ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.showLogo ? 'ml-6' : 'ml-0.5'}`}></div>
                        </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-black/5 rounded-xl border admin-border-accent">
                        <div>
                            <p className="font-medium admin-text-primary">Auto Print Struk</p>
                            <p className="text-sm opacity-70 admin-text-primary">Cetak struk otomatis setelah transaksi</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, autoPrint: !settings.autoPrint })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.autoPrint ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}
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
                    <div className="flex items-center justify-between p-4 bg-black/5 rounded-xl border admin-border-accent">
                        <div>
                            <p className="font-medium admin-text-primary">Aktifkan QRIS</p>
                            <p className="text-sm opacity-70 admin-text-primary">Terima pembayaran via QRIS</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, enableQris: !settings.enableQris })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.enableQris ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.enableQris ? 'ml-6' : 'ml-0.5'}`}></div>
                        </button>
                    </div>

                    {settings.enableQris && (
                        <div className="p-4 bg-black/5 rounded-xl border admin-border-accent">
                            <label className="block text-sm opacity-80 admin-text-primary font-medium mb-2">Upload Gambar QRIS</label>
                            <div className="flex items-center gap-4">
                                {settings.qrisImage && (
                                    <img src={getImageUrl(settings.qrisImage)} alt="QRIS" className="w-24 h-24 object-contain rounded-lg bg-white p-1 border border-gray-200" />
                                )}
                                <input type="file" accept="image/*" onChange={handleQrisUpload} className="hidden" id="qrisInput" />
                                <button
                                    onClick={() => document.getElementById('qrisInput').click()}
                                    className="px-4 py-2 rounded-lg bg-black/10 hover:bg-black/20 admin-text-primary transition-colors font-medium border border-transparent hover:border-black/10"
                                >
                                    📷 Upload QRIS
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Bank Transfer */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Nama Bank</label>
                            <input
                                type="text"
                                value={settings.bankName}
                                onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg admin-input"
                                placeholder="BCA, Mandiri, dll"
                            />
                        </div>
                        <div>
                            <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">No. Rekening</label>
                            <input
                                type="text"
                                value={settings.bankAccount}
                                onChange={(e) => setSettings({ ...settings, bankAccount: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg admin-input"
                            />
                        </div>
                        <div>
                            <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Atas Nama</label>
                            <input
                                type="text"
                                value={settings.bankAccountName}
                                onChange={(e) => setSettings({ ...settings, bankAccountName: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg admin-input"
                            />
                        </div>
                    </div>

                    {/* eWallet Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t admin-border-accent pt-4 mt-4">
                        <div className="md:col-span-3">
                            <h4 className="font-bold text-sm admin-text-primary mb-2 opacity-90">Dompet Digital (e-Wallet)</h4>
                        </div>
                        <div>
                            <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Jenis E-Wallet</label>
                            <input
                                type="text"
                                value={settings.ewalletType || ''}
                                onChange={(e) => setSettings({ ...settings, ewalletType: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg admin-input"
                                placeholder="Gopay/OVO/Dana"
                            />
                        </div>
                        <div>
                            <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Nomor HP</label>
                            <input
                                type="text"
                                value={settings.ewalletNumber || ''}
                                onChange={(e) => setSettings({ ...settings, ewalletNumber: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg admin-input"
                                placeholder="08xxx"
                            />
                        </div>
                        <div>
                            <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Atas Nama</label>
                            <input
                                type="text"
                                value={settings.ewalletName || ''}
                                onChange={(e) => setSettings({ ...settings, ewalletName: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg admin-input"
                            />
                        </div>
                    </div>

                    {/* Cash Prepayment Toggle */}
                    <div id="tour-pembayaran-kasir" className="flex items-center justify-between p-4 bg-black/5 rounded-xl border border-orange-500/30 mt-4">
                        <div>
                            <p className="font-medium text-orange-600 dark:text-orange-400">Wajib Bayar Dulu (Tunai)</p>
                            <p className="text-sm opacity-70 admin-text-primary">Pembeli wajib bayar di kasir sebelum pesanan diproses di dapur</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, isCashPrepaymentRequired: !settings.isCashPrepaymentRequired })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.isCashPrepaymentRequired ? 'bg-orange-500' : 'bg-gray-400 dark:bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.isCashPrepaymentRequired ? 'ml-6' : 'ml-0.5'}`}></div>
                        </button>
                    </div>

                    {/* Staff Permission Toggle */}
                    <div className="flex items-center justify-between p-4 bg-black/5 rounded-xl border border-blue-500/30 mt-4">
                        <div>
                            <p className="font-medium text-blue-600 dark:text-blue-400">Izinkan Staff Menambahkan Bahan & Resep</p>
                            <p className="text-sm opacity-70 admin-text-primary">Staff bisa menambah/edit bahan dan resep (Aktivitas akan direkam)</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, allowStaffEditInventory: !settings.allowStaffEditInventory })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.allowStaffEditInventory ? 'bg-blue-500' : 'bg-gray-400 dark:bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.allowStaffEditInventory ? 'ml-6' : 'ml-0.5'}`}></div>
                        </button>
                    </div>

                    {/* Cash Drawer Visibility Settings */}
                    <div className="mt-8 border-t admin-border-accent pt-6">
                        <h3 className="font-bold mb-4 flex items-center gap-2 admin-text-primary">
                            <span>💰</span> Pengaturan Kas Digital Kasir
                        </h3>
                        <div className="space-y-4">
                            {/* Show Cash Toggle */}
                            <div className="flex items-center justify-between p-4 bg-black/5 rounded-xl border border-green-500/30">
                                <div>
                                    <p className="font-medium text-green-600 dark:text-green-400">Tampilkan Saldo Tunai ke Staff</p>
                                    <p className="text-sm opacity-70 admin-text-primary">Jika dimatikan, staff tidak bisa melihat total uang tunai di laci</p>
                                </div>
                                <button
                                    onClick={() => setSettings({ ...settings, showCashToStaff: !settings.showCashToStaff })}
                                    className={`w-12 h-6 rounded-full transition-all ${settings.showCashToStaff ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.showCashToStaff ? 'ml-6' : 'ml-0.5'}`}></div>
                                </button>
                            </div>

                            {/* Show Non-Cash Toggle */}
                            <div className="flex items-center justify-between p-4 bg-black/5 rounded-xl border admin-border-accent">
                                <div>
                                    <p className="font-medium admin-text-primary">Tampilkan Saldo Non-Tunai ke Staff</p>
                                    <p className="text-sm opacity-70 admin-text-primary">Jika dimatikan, staff tidak bisa melihat total pendapatan non-tunai (QRIS/Transfer)</p>
                                </div>
                                <button
                                    onClick={() => setSettings({ ...settings, showNonCashToStaff: !settings.showNonCashToStaff })}
                                    className={`w-12 h-6 rounded-full transition-all ${settings.showNonCashToStaff ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}
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
                <div className="flex items-center justify-between p-4 bg-black/5 rounded-xl border admin-border-accent">
                    <div>
                        <p className="font-medium admin-text-primary">Aktifkan PPN</p>
                        <p className="text-sm opacity-70 admin-text-primary">Tambahkan pajak ke total transaksi</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {settings.enableTax && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={settings.taxPercent}
                                    onChange={(e) => setSettings({ ...settings, taxPercent: e.target.value })}
                                    className="w-16 px-2 py-1 rounded-lg bg-black/10 text-center admin-text-primary admin-input"
                                />
                                <span className="opacity-70 admin-text-primary">%</span>
                            </div>
                        )}
                        <button
                            onClick={() => setSettings({ ...settings, enableTax: !settings.enableTax })}
                            className={`w-12 h-6 rounded-full transition-all ${settings.enableTax ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 rounded-full bg-white transition-all ${settings.enableTax ? 'ml-6' : 'ml-0.5'}`}></div>
                        </button>
                    </div>
                </div>
            </AccordionSection>

            {/* Manage FAQ */}
            <AccordionSection
                id="faq"
                title="Kelola FAQ (Tanya Jawab)"
                icon="❓"
                isOpen={openSection === 'faq'}
                onToggle={() => toggleSection('faq')}
                isDirty={JSON.stringify(faqs) !== JSON.stringify(initialFaqs)}
            >
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-sm opacity-80 admin-text-primary">
                            Pertanyaan & jawaban ini akan ditampilkan di halaman Bantuan pelanggan Anda.
                        </p>
                        <button
                            onClick={() => setFaqs([...faqs, { question: '', answer: '', isActive: true }])}
                            className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-600 hover:bg-green-500/30 transition-colors flex items-center gap-2 text-sm font-bold"
                        >
                            <span>➕</span> Tambah FAQ
                        </button>
                    </div>

                    <div className="space-y-3">
                        {faqs.map((faq, index) => (
                            <div key={index} className="p-4 bg-black/5 rounded-xl border admin-border-accent relative group">
                                <div className="absolute top-2 right-2 flex gap-2">
                                    <button
                                        onClick={() => {
                                            const newFaqs = [...faqs];
                                            newFaqs[index].isActive = !newFaqs[index].isActive;
                                            setFaqs(newFaqs);
                                        }}
                                        className={`p-1.5 rounded-lg text-xs ${faq.isActive ? 'bg-blue-500/20 text-blue-500 hover:bg-blue-500/30' : 'bg-gray-500/20 text-gray-500 hover:bg-gray-500/30'} transition-colors`}
                                        title={faq.isActive ? "Sembunyikan" : "Tampilkan"}
                                    >
                                        {faq.isActive ? '👁️' : '🙈'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            const newFaqs = faqs.filter((_, i) => i !== index);
                                            setFaqs(newFaqs);
                                        }}
                                        className="p-1.5 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors text-xs"
                                        title="Hapus"
                                    >
                                        🗑️
                                    </button>
                                </div>
                                <div className="space-y-3 pr-16">
                                    <div>
                                        <label className="block text-xs opacity-80 admin-text-primary font-medium mb-1">Pertanyaan</label>
                                        <input
                                            type="text"
                                            value={faq.question}
                                            onChange={(e) => {
                                                const newFaqs = [...faqs];
                                                newFaqs[index].question = e.target.value;
                                                setFaqs(newFaqs);
                                            }}
                                            className="w-full px-3 py-1.5 rounded-lg admin-input text-sm"
                                            placeholder="Contoh: Apakah bisa bayar pakai QRIS?"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs opacity-80 admin-text-primary font-medium mb-1">Jawaban</label>
                                        <textarea
                                            value={faq.answer}
                                            onChange={(e) => {
                                                const newFaqs = [...faqs];
                                                newFaqs[index].answer = e.target.value;
                                                setFaqs(newFaqs);
                                            }}
                                            className="w-full px-3 py-1.5 rounded-lg admin-input text-sm resize-none"
                                            rows="2"
                                            placeholder="Tuliskan jawaban dari pertanyaan di atas..."
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {faqs.length === 0 && (
                            <div className="text-center p-6 bg-black/5 rounded-xl border admin-border-accent border-dashed">
                                <p className="opacity-60 admin-text-primary">Belum ada FAQ. Klik "Tambah FAQ" untuk membuat pertanyaan baru.</p>
                            </div>
                        )}
                    </div>

                    {JSON.stringify(faqs) !== JSON.stringify(initialFaqs) && (
                        <div className="flex justify-end mt-4 pt-4 border-t admin-border-accent">
                            <button
                                onClick={handleSaveFaqs}
                                className="px-6 py-2 rounded-lg bg-purple-500 text-white font-bold hover:bg-purple-600 transition-colors shadow-lg shadow-purple-500/20"
                            >
                                Simpan Perubahan FAQ
                            </button>
                        </div>
                    )}
                </div>
            </AccordionSection>

            {/* Subscription & Billing Section */}
            {isWeb && (
                <AccordionSection
                    id="subscription"
                    title="Langganan & Tagihan"
                    icon="🎟️"
                    isOpen={openSection === 'subscription'}
                    onToggle={() => toggleSection('subscription')}
                    isDirty={false}
                >
                    <SubscriptionSection subscription={subscription} />
                </AccordionSection>
            )}

            {/* Account Security (Change Password & PIN) */}
            <AccordionSection
                id="security"
                title="Keamanan Akun"
                icon="🔒"
                isOpen={openSection === 'security'}
                onToggle={() => toggleSection('security')}
                isDirty={false} 
            >
                <div className="space-y-8">
                    {/* ==== INFORMASI AKUN ==== */}
                    <div className="p-5 bg-black/5 rounded-xl border admin-border-accent">
                        <h4 className="font-bold admin-text-primary mb-4 flex items-center gap-2">
                            <span>ℹ️</span> Informasi Akun Dasar
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <p className="text-sm opacity-60 admin-text-primary mb-1">Nama / Email</p>
                                <p className="font-medium admin-text-primary truncate">
                                    {userInfo?.name || 'Admin'} / {userInfo?.email || 'Tidak tersedia'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm opacity-60 admin-text-primary mb-1">Jenis Login</p>
                                <p className="font-medium admin-text-primary">
                                    {userInfo?.authProvider === 'google' ? 'Google OAuth' : 'Email & Password'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm opacity-60 admin-text-primary mb-1">Alamat Tenant Slug</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="font-medium admin-text-primary bg-black/10 px-3 py-1 rounded-md border admin-border-accent text-sm">
                                        /{tenantSlug || 'Tidak ada'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ==== UBAH PASSWORD ==== */}
                    <div>
                        <h4 className="font-bold admin-text-primary mb-4 flex items-center gap-2">
                            <span>🔑</span> Ubah Password Dashboard
                        </h4>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Password Saat Ini</label>
                            <input
                                type="password"
                                value={passwordForm.currentPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg admin-input"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Password Baru</label>
                            <input
                                type="password"
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg admin-input"
                                minLength="6"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm opacity-80 admin-text-primary font-medium mb-1">Konfirmasi Password Baru</label>
                            <input
                                type="password"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg admin-input"
                                minLength="6"
                                required
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={passwordSaving}
                            className={`px-6 py-2 rounded-lg admin-button-primary shadow-sm font-medium flex items-center gap-2 ${passwordSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {passwordSaving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                <>
                                    <span>🔒</span>
                                    <span>Ubah Password</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
                </div>

                {/* ==== KEAMANAN PIN (KHUSUS ADMIN) ==== */}
                {userRole === 'admin' && (
                    <div className="border-t admin-border-accent pt-6">
                        <h4 className="font-bold admin-text-primary mb-4 flex items-center gap-2">
                            <span>🛡️</span> Keamanan Login Google (PIN)
                        </h4>
                        
                        <div className="flex items-center justify-between p-4 bg-black/5 rounded-xl border border-amber-500/30">
                            <div>
                                <p className="font-medium text-amber-600 dark:text-amber-400">Wajibkan PIN Saat Login Google</p>
                                <p className="text-sm opacity-70 admin-text-primary">Tambahkan lapisan keamanan 6-digit PIN setelah login dengan Google Account.</p>
                            </div>
                            <button
                                onClick={handleTogglePinSecurity}
                                disabled={pinLoading}
                                className={`w-12 h-6 rounded-full transition-all flex-shrink-0 disabled:opacity-50 ${pinStatus.isPinSecurityEnabled ? 'bg-amber-500' : 'bg-gray-400 dark:bg-gray-600'}`}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white transition-all ${pinStatus.isPinSecurityEnabled ? 'ml-6' : 'ml-0.5'}`}></div>
                            </button>
                        </div>

                        {/* Tombol Setel/Ubah PIN */}
                        <div className="mt-4 flex flex-wrap gap-3">
                            {!pinStatus.hasPinInstalled ? (
                                <button
                                    onClick={() => {
                                        setPinModalMode('set');
                                        setIsPinModalOpen(true);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-bold border border-amber-500/30 transition-all flex items-center gap-2 text-sm"
                                >
                                    <span>🆕</span> Setel PIN Keamanan
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        setPinModalMode('change');
                                        setIsPinModalOpen(true);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-bold border border-blue-500/30 transition-all flex items-center gap-2 text-sm"
                                >
                                    <span>🔄</span> Ubah PIN Keamanan
                                </button>
                            )}
                        </div>
                    </div>
                )}
                </div>
            </AccordionSection>

            <PinModal 
                isOpen={isPinModalOpen} 
                onClose={() => setIsPinModalOpen(false)} 
                mode={pinModalMode} 
                onSuccess={fetchPinStatus}
            />



            <div className={`fixed bottom-0 right-0 p-4 bg-gray-900/80 backdrop-blur-lg border-t border-white/10 md:static md:bg-transparent md:border-t-0 md:p-0 z-10 transition-all duration-300 ${isSidebarCollapsed ? 'left-0' : 'left-20'}`}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-bold text-lg disabled:opacity-50 shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    {saving ? '⏳ Menyimpan...' : '💾 Simpan Semua Pengaturan'}
                </button>
            </div>

        </section >
    );
}

// ===== Extracted Subscription Section (platform-aware) =====
const SubscriptionSection = ({ subscription }) => {
    const { isNative, isWeb } = usePlatform();
    const tenantSlug = localStorage.getItem('tenant_slug');

    const statusLabels = {
        trial: { label: 'Masa Trial', color: 'text-yellow-400' },
        active: { label: 'Aktif (Berbayar)', color: 'text-green-400' },
        paid: { label: 'Aktif (Berbayar)', color: 'text-green-400' },
        grace: { label: 'Masa Tenggang', color: 'text-orange-400' },
        expired: { label: 'Kedaluwarsa', color: 'text-red-400' },
        suspended: { label: 'Ditangguhkan', color: 'text-red-400' },
    };

    if (subscription.loading) {
        return (
            <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    if (!subscription.data) {
        return (
            <div className="p-4 text-center rounded-xl border admin-border-accent bg-red-500/10 text-red-400">
                <p>Gagal memuat status langganan. Membutuhkan koneksi API yang stabil.</p>
            </div>
        );
    }

    const d = subscription.data;
    const info = statusLabels[d.status] || statusLabels.expired;

    return (
        <div className="space-y-4">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-black/5 p-4 rounded-xl border admin-border-accent">
                    <p className="text-sm opacity-70 admin-text-primary mb-1">Status Saat Ini</p>
                    <p className={`font-bold text-lg ${info.color}`}>{info.label}</p>
                </div>
                <div className="bg-black/5 p-4 rounded-xl border admin-border-accent">
                    <p className="text-sm opacity-70 admin-text-primary mb-1">Paket Aktif</p>
                    <p className="font-bold text-lg text-purple-400">
                        {d.planName || 'Trial'}
                    </p>
                </div>
                <div className="bg-black/5 p-4 rounded-xl border admin-border-accent">
                    <p className="text-sm opacity-70 admin-text-primary mb-1">Masa Berlaku Hingga</p>
                    <p className="font-bold text-lg admin-text-primary">
                        {new Date(d.expiresAt || d.trialExpiresAt).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'long', year: 'numeric'
                        })}
                    </p>
                </div>
            </div>

            {/* Grace Period Warning */}
            {d.isGracePeriod && (
                <div className="bg-orange-500/10 p-4 rounded-xl border border-orange-500/30 text-orange-400">
                    <h4 className="font-bold mb-1">⚠️ Masa Tenggang Aktif</h4>
                    <p className="text-sm opacity-80 admin-text-primary">
                        Langganan sudah habis. Akses akan dibekukan pada{' '}
                        <strong>{new Date(d.gracePeriodEndsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                    </p>
                </div>
            )}

            {/* CTA — platform-aware */}
            <div className="bg-purple-500/10 p-4 rounded-xl border border-purple-500/30 mt-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h4 className="font-bold text-purple-400 mb-1">Kelola Paket Layanan Anda</h4>
                    <p className="text-sm opacity-80 admin-text-primary whitespace-pre-wrap">
                        {d.daysRemaining > 0
                            ? `Akses aplikasi akan berakhir dalam ${d.daysRemaining} hari.\nUpgrade atau perpanjang sekarang untuk menghindari gangguan operasional.`
                            : 'Akses administrasi kedaluwarsa. Segera upgrade untuk memulihkan layanan.'}
                    </p>
                </div>
                {isWeb ? (
                    <button
                        onClick={() => window.location.href = `/${tenantSlug}/admin/subscription/upgrade`}
                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 transition-all w-full md:w-auto text-center border-none"
                    >
                        Upgrade / Perpanjang Paket
                    </button>
                ) : (
                    <p className="text-xs text-purple-300/80 text-center md:text-right">
                        Perpanjang via browser:<br />
                        <span className="font-mono text-purple-400">superkafe.com/{tenantSlug}/admin/subscription/upgrade</span>
                    </p>
                )}
            </div>

            {/* Subscription History */}
            {d.subscriptionHistory && d.subscriptionHistory.length > 0 && (
                <div className="bg-black/5 p-4 rounded-xl border admin-border-accent mt-4">
                    <h4 className="font-bold admin-text-primary text-sm mb-3 opacity-80">Riwayat Pembayaran</h4>
                    <div className="space-y-2">
                        {d.subscriptionHistory.map((h, i) => (
                            <div key={i} className="flex justify-between items-center text-xs p-3 rounded-lg bg-black/10">
                                <div>
                                    <p className="font-semibold admin-text-primary capitalize">{h.plan}</p>
                                    <p className="opacity-50 admin-text-primary mt-0.5">
                                        {new Date(h.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <span className="font-bold text-green-400">
                                    Rp {h.amount?.toLocaleString('id-ID')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Pengaturan;
