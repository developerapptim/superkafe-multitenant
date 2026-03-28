import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { jwtDecode } from 'jwt-decode';
import dayjs from 'dayjs';
import { get, set } from 'idb-keyval';
import api from '../../services/api';
import Sidebar from '../../components/Sidebar';
import CommandPalette from '../../components/CommandPalette';
import NotificationBell from '../../components/admin/NotificationBell';
import OrderNotification from '../../components/OrderNotification';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { useRefresh } from '../../context/RefreshContext';
import { ThemeProvider, useTheme } from '../../context/ThemeContext';
import FirstTimeThemePopup from '../../components/admin/FirstTimeThemePopup';
import FirstTimePinPopup from '../../components/admin/FirstTimePinPopup';
import TrialStatusBanner from '../../components/TrialStatusBanner';
import SubscriptionLockScreen from '../../components/SubscriptionLockScreen';
import { useSocket } from '../../context/SocketContext';
import SetupModal from '../../components/admin/SetupModal';

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
    const socket = useSocket();

    // Get User Role and Tenant Info
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = user?.role || 'admin';
    const isStaff = userRole === 'staf';
    const isAdmin = userRole === 'admin';
    const tenantSlug = localStorage.getItem('tenant_slug');
    
    const [hasCompletedSetup, setHasCompletedSetup] = useState(
        localStorage.getItem('has_completed_setup') === 'true'
    );

    useEffect(() => {
        const handleSetupStatus = () => {
            setHasCompletedSetup(localStorage.getItem('has_completed_setup') === 'true');
        };
        window.addEventListener('setup_status_changed', handleSetupStatus);
        return () => window.removeEventListener('setup_status_changed', handleSetupStatus);
    }, []);

    // Subscription state for lock screen & banner
    const [subscriptionData, setSubscriptionData] = useState(null);
    const isUpgradePage = location.pathname.endsWith('/admin/subscription/upgrade');
    const showLockScreen = subscriptionData && !subscriptionData.canAccessFeatures && !isUpgradePage;

    // Fetch subscription status on mount
    useEffect(() => {
        const fetchSubscription = async () => {
            if (!tenantSlug) return;
            try {
                const res = await api.get(`/tenants/${tenantSlug}/trial-status`);
                if (res.data.success) {
                    setSubscriptionData(res.data.data);
                    await set(`sub_${tenantSlug}`, res.data.data);
                    if (!res.data.data.canAccessFeatures) {
                        localStorage.setItem('subscription_expired', 'true');
                    } else {
                        localStorage.removeItem('subscription_expired');
                    }
                }
            } catch (err) {
                console.error('[AdminLayout] Failed to fetch subscription:', err.message);
                // Fallback to offline cached data
                const cached = await get(`sub_${tenantSlug}`);
                if (cached) {
                    console.log('[AdminLayout] Loaded subscription from offline cache');
                    setSubscriptionData(cached);
                }
            }
        };

        fetchSubscription();

        // Auto-refresh subscription state when user returns to the tab
        // Crucial for refreshing state after paying on Duitku's payment page
        window.addEventListener('focus', fetchSubscription);
        return () => window.removeEventListener('focus', fetchSubscription);
    }, [tenantSlug]);

    // Listen for real-time subscription updates via Socket.io
    useEffect(() => {
        if (!socket) return;

        const handleSubscriptionUpdate = (data) => {
            console.log('[AdminLayout] ⚡ subscription:updated received', data);
            setSubscriptionData(data);
            if (data.canAccessFeatures) {
                toast.success('🎉 Langganan diperpanjang! Akses dipulihkan.');
            }
        };

        socket.on('subscription:updated', handleSubscriptionUpdate);
        return () => socket.off('subscription:updated', handleSubscriptionUpdate);
    }, [socket]);

    // Global listener for expiration (from api.js interceptor or indexedDB offline guard)
    useEffect(() => {
        const handleForceExpired = () => {
            console.warn('[AdminLayout] Forced expiration event received!');
            setSubscriptionData(prev => ({
                ...prev,
                canAccessFeatures: false,
                status: 'expired'
            }));
        };

        window.addEventListener('subscription-expired', handleForceExpired);

        // Also check if flagged in local storage from offline guard or other tabs
        const checkStorage = () => {
            if (localStorage.getItem('subscription_expired') === 'true') {
                handleForceExpired();
            }
        };
        window.addEventListener('storage', checkStorage);
        checkStorage(); // check on mount

        return () => {
            window.removeEventListener('subscription-expired', handleForceExpired);
            window.removeEventListener('storage', checkStorage);
        };
    }, []);

    const [tenantInfo, setTenantInfo] = useState(() => {
        let initialTheme = 'default';
        let tenantId = null;
        let hasPin = true; // default true so we don't show popup unnecessarily

        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token');
            const tenantData = localStorage.getItem('tenant');

            if (token) {
                try {
                    const decoded = jwtDecode(token);
                    tenantId = decoded.tenantId;
                    if (decoded.hasPin === false) {
                        hasPin = false;
                    }

                    if (tenantData) {
                        try {
                            const tenant = JSON.parse(tenantData);
                            initialTheme = tenant.selectedTheme || 'default';
                            console.log('[AdminLayout] Loaded theme from localStorage synchronously:', initialTheme);
                        } catch (parseError) {
                            console.error('[AdminLayout] Failed to parse tenant data:', parseError);
                        }
                    }
                } catch (error) {
                    console.error('[AdminLayout] Failed to decode token:', error);
                }
            }

            // Synchronously inject theme to prevent FOUC on main layout wrapper
            document.documentElement.setAttribute('data-theme', initialTheme);
        }

        return {
            tenantId,
            initialTheme,
            hasPin
        };
    });

    // First-time PIN setup popup state
    const [showPinPopup, setShowPinPopup] = useState(() => {
        const hasSetupPinLocal = localStorage.getItem('has_setup_pin') === 'true';
        return (userRole === 'admin') &&
            tenantInfo.tenantId &&
            tenantInfo.hasPin === false &&
            !hasSetupPinLocal;
    });

    const handlePinSetupComplete = () => {
        localStorage.setItem('has_setup_pin', 'true');
        setShowPinPopup(false);
    };

    // First-time theme popup state
    const [showThemePopup, setShowThemePopup] = useState(false);
    const [hasSeenThemePopup, setHasSeenThemePopup] = useState(true); // Default to true to avoid flash

    // Check if user should see first-time theme popup
    useEffect(() => {
        const checkThemePopup = async () => {
            if (!tenantInfo.tenantId) return;

            try {
                const response = await api.get(`/tenants/${tenantInfo.tenantId}/theme`);
                const hasSeenPopup = response.data.hasSeenThemePopup;

                setHasSeenThemePopup(hasSeenPopup);

                // Show theme popup if user hasn't seen it yet and PIN popup is not showing
                if (!hasSeenPopup && !showPinPopup) {
                    setShowThemePopup(true);
                }
            } catch (error) {
                console.error('[AdminLayout] Failed to check theme popup status:', error);
                // Default to not showing popup on error
                setHasSeenThemePopup(true);
            }
        };

        checkThemePopup();
    }, [tenantInfo.tenantId, showPinPopup]);

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

    // Reset scroll and fix focus on route change
    useEffect(() => {
        const mainScrollContainer = document.getElementById('main-scroll-container');
        if (mainScrollContainer) {
            mainScrollContainer.scrollTop = 0;
            // Focus the main container so arrow keys/page down work immediately without clicking
            mainScrollContainer.focus({ preventScroll: true });
        }
    }, [location.pathname]);

    const [showShiftModal, setShowShiftModal] = useState(false);
    const [showActiveShiftWarning, setShowActiveShiftWarning] = useState(false);
    const [shiftData, setShiftData] = useState({ startCash: '' });
    const { data: currentShift, mutate: mutateShift } = useSWR('/shifts/current', fetcher);

    // Effects to check shift status
    useEffect(() => {
        // Admin bypass: never block admin users
        if (isAdmin) {
            setShowShiftModal(false);
            setShowActiveShiftWarning(false);
            return;
        }

        if (isStaff) {
            if (currentShift === null) {
                // No active shift at all — show "Open Shift" modal
                setShowActiveShiftWarning(false);
                setShowShiftModal(true);
            } else if (currentShift && currentShift.userId && currentShift.userId !== user?.id) {
                // Another staff's shift is active — show warning, block access
                setShowShiftModal(false);
                setShowActiveShiftWarning(true);
            } else {
                // Current user's own shift is active — everything is fine
                setShowShiftModal(false);
                setShowActiveShiftWarning(false);
            }
        } else {
            setShowShiftModal(false);
            setShowActiveShiftWarning(false);
        }
    }, [isStaff, isAdmin, currentShift, user?.id]);

    // 15-Hour Shift Warning
    useEffect(() => {
        if (!currentShift || !currentShift.startTime) return;

        // Check if we've already shown this warning in the current session
        const warningKey = `shift_warning_shown_${currentShift._id}`;
        if (sessionStorage.getItem(warningKey)) return;

        const startTime = dayjs(currentShift.startTime);
        const now = dayjs();
        const hoursPassed = now.diff(startTime, 'hour');

        if (hoursPassed >= 15) {
            toast('Sesi Anda sudah berjalan lebih dari 15 jam. Jangan lupa tutup shift untuk merekap laporan hari ini!', {
                icon: '⏰',
                duration: 6000,
                style: {
                    borderRadius: '10px',
                    background: '#333',
                    color: '#fff',
                },
            });
            sessionStorage.setItem(warningKey, 'true');
        }
    }, [currentShift]);

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

    // No longer need Tour Guide

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
                                className="w-8 h-8 rounded bg-transparent object-cover transition-transform shrink-0"
                            />
                            {/* Page Title */}
                            <div className="flex-1 flex items-center gap-2 overflow-hidden">
                                <h1 className="text-white font-semibold text-lg truncate">
                                    {(() => {
                                        const basePath = location.pathname.substring(location.pathname.indexOf('/admin'));
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
                                            '/admin/marketing': '📢 Marketing & Promo',
                                            '/admin/subscription/upgrade': '🚀 Upgrade Paket'
                                        };
                                        return titles[basePath] || 'Admin Panel';
                                    })()}
                                </h1>
                                <TrialStatusBanner subscriptionData={subscriptionData} />
                            </div>
                            <div className="mr-2 flex items-center gap-2">
                                {isAdmin && !hasCompletedSetup && (
                                    <div className="relative flex items-center">
                                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                                        <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 mr-1">
                                            Setup !
                                        </span>
                                    </div>
                                )}
                                <NotificationBell />
                            </div>

                            {/* Monitor Mode Badge - Mobile Only */}
                            {userRole === 'admin' && location.pathname === '/admin/kasir' && (
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
                                        const basePath = location.pathname.substring(location.pathname.indexOf('/admin'));
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
                                            '/admin/marketing': '📢 Marketing & Promo',
                                            '/admin/subscription/upgrade': '🚀 Upgrade Paket'
                                        };
                                        return titles[basePath] || 'Admin Panel';
                                    })()}
                                </h2>
                                <TrialStatusBanner subscriptionData={subscriptionData} />
                            </div>
                            <div className="flex items-center gap-4">
                                {isAdmin && !hasCompletedSetup && (
                                    <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full cursor-pointer hover:bg-red-500/20 transition-all" onClick={() => navigate(tenantSlug ? `/${tenantSlug}/admin/dashboard` : '/admin/dashboard')}>
                                        <div className="relative">
                                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                                        </div>
                                        <span className="text-xs font-bold text-red-400">Setup Belum Selesai</span>
                                    </div>
                                )}
                                <NotificationBell />
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    <span className="text-xs text-gray-300 font-medium">{user.name || 'Admin'}</span>
                                </div>
                            </div>
                        </header>

                        {/* Main Content */}
                        <main
                            className="flex-1 overflow-y-auto overflow-x-hidden relative admin-bg-main outline-none custom-scrollbar"
                            id="main-scroll-container"
                            tabIndex="-1"
                        >
                            <PullToRefresh
                                onRefresh={triggerRefresh}
                                className="min-h-full w-full"
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

                    {/* Active Shift Warning Modal for Staff */}
                    {showActiveShiftWarning && currentShift && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                            <div className="admin-bg-sidebar p-8 rounded-2xl w-full max-w-md border admin-border-accent shadow-2xl">
                                <div className="text-center mb-6">
                                    <div className="text-5xl mb-3">⚠️</div>
                                    <h2 className="text-2xl font-bold text-white">Shift Sedang Aktif</h2>
                                    <p className="text-gray-400 mt-3">
                                        Shift atas nama <span className="text-yellow-400 font-bold">{currentShift.cashierName || 'Staff lain'}</span> masih berjalan.
                                    </p>
                                    <p className="text-gray-500 mt-2 text-sm">
                                        Harap selesaikan shift sebelumnya terlebih dahulu sebelum memulai shift baru.
                                    </p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-lg transition-all"
                                >
                                    🔙 Kembali ke Login
                                </button>
                            </div>
                        </div>
                    )}

                    {/* First-Time PIN Setup Popup */}
                    <FirstTimePinPopup
                        isOpen={showPinPopup}
                        onSuccess={handlePinSetupComplete}
                        onSkip={handlePinSetupComplete}
                    />

                    {/* First-Time Theme Selection Popup */}
                    <FirstTimeThemePopup
                        isOpen={showThemePopup}
                        onThemeSelect={handleThemeSelect}
                        onSkip={handleSkipThemeSelection}
                    />

                    {/* Setup Modal untuk Pengguna Baru */}
                    <SetupModal />

                    {/* Subscription Lock Screen — blocks all access when expired */}
                    {showLockScreen && (
                        <SubscriptionLockScreen tenantSlug={tenantSlug} />
                    )}
                </div>
            </div>
        </ThemeProvider>
    );
}

export default AdminLayout;
