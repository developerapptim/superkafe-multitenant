import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { jwtDecode } from 'jwt-decode';
import api from '../../services/api';
import Sidebar from '../../components/Sidebar';
import CommandPalette from '../../components/CommandPalette';
import NotificationBell from '../../components/admin/NotificationBell';
import OrderNotification from '../../components/OrderNotification'; // Global Order Notification
import PullToRefresh from 'react-simple-pull-to-refresh';
import { useRefresh } from '../../context/RefreshContext';
import { ThemeProvider, useTheme } from '../../context/ThemeContext';
import FirstTimeThemePopup from '../../components/admin/FirstTimeThemePopup';
import TrialStatusBanner from '../../components/TrialStatusBanner';

// Import admin theme generated CSS classes
import '../../styles/admin-theme.css';

// Fetcher
const fetcher = url => api.get(url).then(res => res.data);

function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const constraintsRef = useRef(null);
    const { triggerRefresh } = useRefresh();

    const [showCmd, setShowCmd] = useState(false);

    // Get User Role and Tenant Info
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isStaff = user.role === 'staf';

    // Extract tenant information from JWT token for ThemeProvider
    const [tenantInfo, setTenantInfo] = useState({ tenantId: null, initialTheme: 'default' });

    // First-time theme popup state
    const [showThemePopup, setShowThemePopup] = useState(false);
    const [hasSeenThemePopup, setHasSeenThemePopup] = useState(true); // Default to true to avoid flash

    useEffect(() => {
        const token = localStorage.getItem('token');
        const tenantData = localStorage.getItem('tenant');

        if (token) {
            try {
                const decoded = jwtDecode(token);
                const tenantId = decoded.tenantId;

                // Try to get initial theme from tenant data in localStorage
                let initialTheme = 'default';
                if (tenantData) {
                    try {
                        const tenant = JSON.parse(tenantData);
                        initialTheme = tenant.selectedTheme || 'default';
                        console.log('[AdminLayout] Loaded theme from localStorage:', initialTheme);
                    } catch (parseError) {
                        console.error('[AdminLayout] Failed to parse tenant data:', parseError);
                    }
                }

                setTenantInfo({
                    tenantId: tenantId || null,
                    initialTheme: initialTheme
                });
            } catch (error) {
                console.error('[AdminLayout] Failed to decode token:', error);
            }
        }
    }, []);

    // Check if user should see first-time theme popup
    useEffect(() => {
        const checkThemePopup = async () => {
            if (!tenantInfo.tenantId) return;

            try {
                const response = await api.get(`/tenants/${tenantInfo.tenantId}/theme`);
                const hasSeenPopup = response.data.hasSeenThemePopup;

                setHasSeenThemePopup(hasSeenPopup);

                // Show popup if user hasn't seen it yet
                if (!hasSeenPopup) {
                    setShowThemePopup(true);
                }
            } catch (error) {
                console.error('[AdminLayout] Failed to check theme popup status:', error);
                // Default to not showing popup on error
                setHasSeenThemePopup(true);
            }
        };

        checkThemePopup();
    }, [tenantInfo.tenantId]);

    // Global Keyboard Shortcut (Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setShowCmd(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const [showShiftModal, setShowShiftModal] = useState(false);
    const [shiftData, setShiftData] = useState({ startCash: '' });
    const { data: currentShift, mutate: mutateShift } = useSWR('/shifts/current', fetcher);

    // Effects to check shift status
    useEffect(() => {
        if (isStaff && currentShift === null) {
            setShowShiftModal(true);
        } else {
            setShowShiftModal(false);
        }
    }, [isStaff, currentShift]);

    const handleOpenShift = async (e) => {
        e.preventDefault();
        try {
            await api.post('/shifts/open', {
                cashierName: user.name,
                userId: user.id,
                startCash: Number(shiftData.startCash)
            });
            toast.success('Shift berhasil dibuka!');
            mutateShift(); // Refresh shift data
            setShowShiftModal(false);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Gagal membuka shift');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        toast.success('Berhasil keluar');
        navigate('/auth/login');
    };

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const toggleSidebar = () => setIsSidebarCollapsed(prev => !prev);

    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('appSettings');
        return saved ? JSON.parse(saved) : {
            logo: 'https://res.cloudinary.com/dhjqb65mf/image/upload/v1770018588/Picsart_26-02-02_15-46-53-772_vw9xc3.png'
        };
    });

    useSWR('/settings', fetcher, {
        onSuccess: (data) => {
            if (data) {
                const newSettings = {
                    ...data,
                    logo: data.logo || 'https://res.cloudinary.com/dhjqb65mf/image/upload/v1770018588/Picsart_26-02-02_15-46-53-772_vw9xc3.png'
                };
                setSettings(newSettings);
                localStorage.setItem('appSettings', JSON.stringify(newSettings));
            }
        }
    });

    // Handle theme selection from first-time popup
    const handleThemeSelect = async (themeName) => {
        if (!tenantInfo.tenantId) return;

        try {
            // Update theme via API and mark popup as seen
            await api.put(`/tenants/${tenantInfo.tenantId}/theme`, {
                theme: themeName,
                markPopupSeen: true
            });

            // Update localStorage tenant data
            const tenantData = localStorage.getItem('tenant');
            if (tenantData) {
                try {
                    const tenant = JSON.parse(tenantData);
                    tenant.selectedTheme = themeName;
                    tenant.hasSeenThemePopup = true;
                    localStorage.setItem('tenant', JSON.stringify(tenant));
                } catch (parseError) {
                    console.error('[AdminLayout] Failed to update tenant data in localStorage:', parseError);
                }
            }

            // Mark popup as seen
            setHasSeenThemePopup(true);
            setShowThemePopup(false);

            toast.success('Tema berhasil disimpan!');

            // Reload page to apply theme
            window.location.reload();
        } catch (error) {
            console.error('[AdminLayout] Failed to save theme:', error);
            toast.error('Gagal menyimpan tema');
        }
    };

    // Handle skip button (use default theme)
    const handleSkipThemeSelection = async () => {
        if (!tenantInfo.tenantId) return;

        try {
            // Mark popup as seen without changing theme
            await api.put(`/tenants/${tenantInfo.tenantId}/theme`, {
                theme: 'default',
                markPopupSeen: true
            });

            setHasSeenThemePopup(true);
            setShowThemePopup(false);
        } catch (error) {
            console.error('[AdminLayout] Failed to mark popup as seen:', error);
            // Still close popup even if API fails
            setHasSeenThemePopup(true);
            setShowThemePopup(false);
        }
    };

    return (
        <ThemeProvider initialTheme={tenantInfo.initialTheme} tenantId={tenantInfo.tenantId}>
            <div
                id="adminPage"
                className="flex flex-col h-screen overflow-hidden admin-gradient-bg admin-text-primary"
                ref={constraintsRef}
            >
                <div className="flex flex-1 overflow-hidden relative">
                    {/* Sidebar Wrapper */}
                    <OrderNotification /> {/* Global Sound/Toast Listener */}
                    <div className={`${isSidebarCollapsed ? 'w-0 lg:w-20' : 'w-20 lg:w-64'} flex-shrink-0 h-full transition-all duration-300 relative`}>
                        <Sidebar onLogout={handleLogout} isCollapsed={isSidebarCollapsed} toggleSidebar={toggleSidebar} />
                    </div>

                    {/* Main Content Area (with Mini Header on Mobile) */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Mini Header Bar (Mobile Only, When Sidebar Collapsed) */}
                        <div
                            onClick={toggleSidebar}
                            className="flex lg:hidden h-14 items-center px-4 gap-3 admin-border-accent border-b admin-bg-sidebar transition-all duration-300 cursor-pointer hover:brightness-110"
                        >
                            {/* Toggle Logo */}
                            <img
                                src={settings.logo}
                                alt="Logo"
                                className="theme-aware-logo w-8 h-8 rounded bg-transparent object-cover transition-transform shrink-0"
                            />
                            {/* Page Title */}
                            <div className="flex-1 flex items-center gap-2 overflow-hidden">
                                <h1 className="text-white font-semibold text-lg truncate">
                                    {(() => {
                                        const path = location.pathname;
                                        const titles = {
                                            '/admin/dashboard': '📊 Dashboard',
                                            '/admin/menu': '🍽️ Manajemen Menu',
                                            '/admin/kasir': '🧾 Kasir (POS)',
                                            '/admin/gramasi': '⚖️ Gramasi & HPP',
                                            '/admin/inventaris': '📦 Inventaris',
                                            '/admin/keuangan': '💰 Keuangan & Kas',
                                            '/admin/pegawai': '👥 Pegawai',
                                            '/admin/meja': '🪑 Meja & Reservasi',
                                            '/admin/laporan': '📈 Laporan & Analitik',
                                            '/admin/shift': '🔐 Laporan Shift',
                                            '/admin/pelanggan': '❤️ Pelanggan & CRM',
                                            '/admin/pengaturan': '⚙️ Pengaturan',
                                            '/admin/data-center': '🗄️ Pusat Data',
                                            '/admin/feedback': '💬 Masukan Pelanggan',
                                        };
                                        return titles[path] || 'Admin Panel';
                                    })()}
                                </h1>
                                <TrialStatusBanner />
                            </div>
                            <div className="mr-2">
                                <NotificationBell />
                            </div>

                            {/* Monitor Mode Badge - Mobile Only */}
                            {(user.role === 'admin' || user.role === 'owner') && location.pathname === '/admin/kasir' && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-medium animate-fade-in select-none whitespace-nowrap shrink-0">
                                    <span>👁️</span>
                                    <span>Pantau</span>
                                </div>
                            )}
                        </div>

                        {/* Desktop Header */}
                        <header className="hidden lg:flex h-16 items-center justify-between px-6 admin-bg-sidebar border-b admin-border-accent relative z-50">
                            <div className="flex items-center gap-3">
                                <h2 className="text-white font-bold text-lg">
                                    {(() => {
                                        const path = location.pathname;
                                        const titles = {
                                            '/admin/dashboard': '📊 Dashboard',
                                            '/admin/menu': '🍽️ Manajemen Menu',
                                            '/admin/kasir': '🧾 Kasir (POS)',
                                            '/admin/gramasi': '⚖️ Gramasi & HPP',
                                            '/admin/inventaris': '📦 Inventaris',
                                            '/admin/keuangan': '💰 Keuangan & Kas',
                                            '/admin/pegawai': '👥 Pegawai',
                                            '/admin/meja': '🪑 Meja & Reservasi',
                                            '/admin/laporan': '📈 Laporan & Analitik',
                                            '/admin/shift': '🔐 Laporan Shift',
                                            '/admin/pelanggan': '❤️ Pelanggan & CRM',
                                            '/admin/pengaturan': '⚙️ Pengaturan',
                                            '/admin/data-center': '🗄️ Pusat Data',
                                            '/admin/feedback': '💬 Masukan Pelanggan',
                                        };
                                        return titles[path] || 'Admin Panel';
                                    })()}
                                </h2>
                                <TrialStatusBanner />
                            </div>
                            <div className="flex items-center gap-4">
                                <NotificationBell />
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    <span className="text-xs text-gray-300 font-medium">{user.name || 'Admin'}</span>
                                </div>
                            </div>
                        </header>

                        {/* Main Content */}
                        <main className="flex-1 overflow-hidden relative admin-bg-main" id="main-scroll-container">
                            <PullToRefresh
                                onRefresh={triggerRefresh}
                                className="h-full w-full overflow-y-auto"
                                pullingContent={
                                    <div className="w-full flex justify-center items-center py-4 bg-transparent text-purple-400">
                                        <span className="animate-bounce">⬇️ Tarik untuk menyegarkan</span>
                                    </div>
                                }
                                refreshingContent={
                                    <div className="w-full flex justify-center items-center py-4 bg-transparent">
                                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
                                    </div>
                                }
                                resistance={2.5}
                            >
                                <div className="p-4 content-container relative min-h-full">
                                    <div className="max-w-[1600px] mx-auto pb-24">
                                        <Outlet context={{ isSidebarCollapsed }} />
                                    </div>
                                </div>
                            </PullToRefresh>
                        </main>
                    </div>

                    <CommandPalette isOpen={showCmd} onClose={() => setShowCmd(false)} />

                    {/* Draggable Search FAB */}
                    <motion.button
                        drag
                        dragConstraints={constraintsRef}
                        dragMomentum={false}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowCmd(true)}
                        className="fixed bottom-48 md:bottom-32 right-8 z-50 p-4 bg-blue-600/20 hover:bg-blue-600/80 text-white/70 hover:text-white rounded-full shadow-lg shadow-blue-500/10 hover:shadow-blue-500/40 border border-white/5 hover:border-white/20 backdrop-blur-sm cursor-grab active:cursor-grabbing transition-colors duration-300 group"
                        title="Cari (Ctrl+K)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </motion.button>

                    {/* Blocking Shift Modal for Staff */}
                    {showShiftModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                            <div className="admin-bg-sidebar p-8 rounded-2xl w-full max-w-md border admin-border-accent shadow-2xl">
                                <div className="text-center mb-6">
                                    <div className="text-4xl mb-2">🔐</div>
                                    <h2 className="text-2xl font-bold text-white">Buka Shift</h2>
                                    <p className="text-gray-400 mt-2">Halo {user.name}, silakan masukkan saldo awal kasir untuk memulai shift.</p>
                                </div>

                                <form onSubmit={handleOpenShift} className="space-y-6">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">Saldo Awal (Rp)</label>
                                        <input
                                            type="number"
                                            value={shiftData.startCash}
                                            onChange={(e) => setShiftData({ startCash: e.target.value })}
                                            className="w-full px-4 py-3 rounded-lg admin-input text-lg focus:outline-none transition-colors"
                                            placeholder="0"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full py-3 rounded-lg admin-button-primary font-bold text-lg hover:shadow-lg transition-all transform hover:-translate-y-1"
                                    >
                                        🚀 Mulai Shift
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* First-Time Theme Selection Popup */}
                    <FirstTimeThemePopup
                        isOpen={showThemePopup}
                        onThemeSelect={handleThemeSelect}
                        onSkip={handleSkipThemeSelection}
                    />
                </div>
            </div>
        </ThemeProvider>
    );
}

export default AdminLayout;
