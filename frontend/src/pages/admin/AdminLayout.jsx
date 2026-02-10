import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import api from '../../services/api';
import Sidebar from '../../components/Sidebar';
import CommandPalette from '../../components/CommandPalette';
import NotificationBell from '../../components/admin/NotificationBell';

// Fetcher
const fetcher = url => api.get(url).then(res => res.data);

function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const constraintsRef = useRef(null);

    const [showCmd, setShowCmd] = useState(false);

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

    // Get User Role
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isStaff = user.role === 'staf';

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
        navigate('/login');
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

    return (
        <div
            id="adminPage"
            className="flex h-screen overflow-hidden bg-gray-900"
            ref={constraintsRef}
            style={{
                background: 'linear-gradient(135deg, #1E1B4B 0%, #0F0A1F 50%, #1E1B4B 100%)',
            }}
        >
            {/* Sidebar Wrapper */}
            <div className={`${isSidebarCollapsed ? 'w-0 lg:w-20' : 'w-20 lg:w-64'} flex-shrink-0 h-full transition-all duration-300 relative`}>
                <Sidebar onLogout={handleLogout} isCollapsed={isSidebarCollapsed} toggleSidebar={toggleSidebar} />
            </div>

            {/* Main Content Area (with Mini Header on Mobile) */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mini Header Bar (Mobile Only, When Sidebar Collapsed) */}
                <div
                    onClick={toggleSidebar}
                    className="flex lg:hidden h-14 items-center px-4 gap-3 border-b border-purple-500/30 bg-[#151235] transition-all duration-300 cursor-pointer hover:bg-white/5"
                >
                    {/* Toggle Logo */}
                    <img
                        src={settings.logo}
                        alt="Logo"
                        className="w-8 h-8 rounded bg-transparent object-cover transition-transform shrink-0"
                    />
                    {/* Page Title */}
                    <h1 className="text-white font-semibold text-lg truncate flex-1">
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
                <header className="hidden lg:flex h-16 items-center justify-between px-6 bg-[#151235] border-b border-purple-500/30">
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
                    <div className="flex items-center gap-4">
                        <NotificationBell />
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-xs text-gray-300 font-medium">{user.name || 'Admin'}</span>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-4 content-container relative">
                    <div className="max-w-[1600px] mx-auto pb-24">
                        <Outlet context={{ isSidebarCollapsed }} />
                    </div>
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
                    <div className="bg-[#1E1B4B] p-8 rounded-2xl w-full max-w-md border border-purple-500/30 shadow-2xl">
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
                                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-purple-500/30 text-white text-lg focus:outline-none focus:border-purple-500 transition-colors"
                                    placeholder="0"
                                    required
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-lg hover:shadow-lg hover:shadow-purple-500/25 transition-all transform hover:-translate-y-1"
                            >
                                🚀 Mulai Shift
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminLayout;
