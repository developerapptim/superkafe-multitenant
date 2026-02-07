import { createContext, useContext, useState, useEffect } from 'react';
import { Outlet, NavLink, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import { settingsAPI } from '../../services/api';

import CartContext from '../../context/CartContext';

// Cart Context removed (imported)
// export const useCart removed (imported)

function CustomerLayout() {
    const [searchParams] = useSearchParams();
    const urlTableId = searchParams.get('meja');

    // Smart Table Detection: Priority = URL param > localStorage
    const [tableId, setTableId] = useState(() => {
        // If URL has meja param, use it and save to localStorage
        if (urlTableId) {
            localStorage.setItem('scannedTable', urlTableId);
            return urlTableId;
        }
        // Otherwise check localStorage
        return localStorage.getItem('scannedTable') || null;
    });

    // Is table locked (came from QR scan)?
    const isTableLocked = !!urlTableId || !!localStorage.getItem('scannedTable');

    // Update localStorage when URL changes
    useEffect(() => {
        if (urlTableId) {
            localStorage.setItem('scannedTable', urlTableId);
            setTableId(urlTableId);
        }
    }, [urlTableId]);

    // Function to clear scanned table (for take away switch)
    const clearScannedTable = () => {
        localStorage.removeItem('scannedTable');
        setTableId(null);
    };

    const [cart, setCart] = useState([]);
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('appSettings');
        return saved ? JSON.parse(saved) : {
            businessName: 'SuperKafe',
            tagline: 'Sistem Manajemen Kafe Modern',
            logo: 'https://res.cloudinary.com/dhjqb65mf/image/upload/v1770018588/Picsart_26-02-02_15-46-53-772_vw9xc3.png'
        };
    });
    const [loadingSettings, setLoadingSettings] = useState(!settings.businessName);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await settingsAPI.get();
            if (res.data) {
                const newSettings = {
                    ...res.data,
                    businessName: res.data.name || res.data.businessName || 'SuperKafe',
                    tagline: res.data.tagline || 'Sistem Manajemen Kafe Modern',
                    logo: res.data.logo || 'https://res.cloudinary.com/dhjqb65mf/image/upload/v1770018588/Picsart_26-02-02_15-46-53-772_vw9xc3.png'
                };
                setSettings(newSettings);
                localStorage.setItem('appSettings', JSON.stringify(newSettings));
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        } finally {
            setLoadingSettings(false);
        }
    };

    // Cart functions
    const addToCart = (item) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, { ...item, qty: 1 }];
        });
    };

    const removeFromCart = (itemId) => {
        setCart(prev => prev.filter(i => i.id !== itemId));
    };

    const updateQty = (itemId, qty) => {
        if (qty <= 0) {
            removeFromCart(itemId);
            return;
        }
        setCart(prev => prev.map(i => i.id === itemId ? { ...i, qty } : i));
    };

    const updateNote = (itemId, note) => {
        setCart(prev => prev.map(i => i.id === itemId ? { ...i, note } : i));
    };

    const clearCart = () => setCart([]);

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

    const cartValue = {
        cart,
        tableId,
        isTableLocked,
        clearScannedTable,
        addToCart,
        removeFromCart,
        updateQty,
        updateNote,
        clearCart,
        cartTotal,
        cartCount
    };

    return (
        <CartContext.Provider value={cartValue}>
            <div className="min-h-screen bg-gradient-to-b from-[#1E1B4B] via-[#0F0A1F] to-[#1E1B4B] text-white pb-20">
                {/* Header */}
                <header className="sticky top-0 z-40 bg-[#1E1B4B]/90 backdrop-blur-lg border-b border-purple-500/20">
                    <div className="max-w-md mx-auto md:max-w-7xl px-4 md:px-8 py-3">
                        <div className="flex items-center h-16">
                            {loadingSettings && !settings.businessName ? (
                                /* Skeleton Loading */
                                <div className="flex items-center gap-3 animate-pulse">
                                    <div className="w-10 h-10 rounded-xl bg-white/10"></div>
                                    <div>
                                        <div className="h-4 w-32 bg-white/10 rounded mb-1"></div>
                                        <div className="h-3 w-24 bg-white/10 rounded"></div>
                                    </div>
                                </div>
                            ) : (
                                /* Actual Branding */
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center overflow-hidden shadow-lg shadow-purple-500/20">
                                        {settings.logo ? (
                                            <img src={settings.logo} alt="Logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xl">☕</span>
                                        )}
                                    </div>
                                    <div>
                                        <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                                            {settings.businessName || 'Loading...'}
                                        </h1>
                                        <p className="text-xs text-gray-400">{settings.tagline || '...'}</p>
                                    </div>
                                </div>
                            )}

                            {/* Desktop Navigation (Right) */}
                            <nav className="hidden md:flex items-center gap-8 ml-auto mr-8">
                                <NavLink
                                    to={`/${tableId ? `?meja=${tableId}` : ''}`}
                                    end
                                    className="relative py-2 group outline-none"
                                >
                                    {({ isActive }) => (
                                        <>
                                            <motion.span
                                                className={`text-sm font-medium transition-colors relative z-10 ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}
                                                whileHover={{ scale: 1.05 }}
                                            >
                                                Beranda
                                            </motion.span>

                                            {isActive && (
                                                <motion.div
                                                    layoutId="desktopNavUnderline"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] rounded-full"
                                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                />
                                            )}
                                        </>
                                    )}
                                </NavLink>

                                <NavLink
                                    to={`/keranjang${tableId ? `?meja=${tableId}` : ''}`}
                                    className="relative py-2 group flex items-center gap-2 outline-none"
                                >
                                    {({ isActive }) => (
                                        <>
                                            <motion.span
                                                className={`text-sm font-medium transition-colors relative z-10 ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}
                                                whileHover={{ scale: 1.05 }}
                                            >
                                                Keranjang
                                            </motion.span>

                                            <AnimatePresence>
                                                {cartCount > 0 && (
                                                    <motion.span
                                                        key="desktop-cart-badge"
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        exit={{ scale: 0 }}
                                                        className="w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold relative z-10 shadow-lg shadow-red-500/30"
                                                    >
                                                        {cartCount}
                                                    </motion.span>
                                                )}
                                            </AnimatePresence>

                                            {isActive && (
                                                <motion.div
                                                    layoutId="desktopNavUnderline"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] rounded-full"
                                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                />
                                            )}
                                        </>
                                    )}
                                </NavLink>

                                <NavLink
                                    to={`/pesanan${tableId ? `?meja=${tableId}` : ''}`}
                                    className="relative py-2 group outline-none"
                                >
                                    {({ isActive }) => (
                                        <>
                                            <motion.span
                                                className={`text-sm font-medium transition-colors relative z-10 ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}
                                                whileHover={{ scale: 1.05 }}
                                            >
                                                Pesanan
                                            </motion.span>

                                            {isActive && (
                                                <motion.div
                                                    layoutId="desktopNavUnderline"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] rounded-full"
                                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                />
                                            )}
                                        </>
                                    )}
                                </NavLink>

                                <NavLink
                                    to={`/bantuan${tableId ? `?meja=${tableId}` : ''}`}
                                    className="relative py-2 group outline-none"
                                >
                                    {({ isActive }) => (
                                        <>
                                            <motion.span
                                                className={`text-sm font-medium transition-colors relative z-10 ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}
                                                whileHover={{ scale: 1.05 }}
                                            >
                                                Bantuan
                                            </motion.span>

                                            {isActive && (
                                                <motion.div
                                                    layoutId="desktopNavUnderline"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] rounded-full"
                                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                />
                                            )}
                                        </>
                                    )}
                                </NavLink>
                            </nav>

                            {/* Table Badge and Login */}
                            <div className="flex items-center gap-4 ml-auto md:ml-0">
                                {tableId && (
                                    <div className="hidden md:block px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-sm border border-purple-500/30">
                                        🪑 Meja {tableId}
                                    </div>
                                )}

                                {/* Staff Login Button (Subtle/Glassmorphism) */}
                                <NavLink
                                    to="/login"
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/20 hover:text-white/80 transition-all backdrop-blur-sm border border-transparent hover:border-white/20"
                                    title="Staff Login"
                                >
                                    🔒
                                </NavLink>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-md mx-auto md:max-w-7xl px-4 md:px-8">
                    <Outlet context={{ tableId, settings, isTableLocked, clearScannedTable }} />

                    {/* Branding */}
                    <div className="text-center py-6 mt-8 border-t border-gray-800">
                        <a
                            href="https://wa.me/081999378385?text=Halo,%20saya%20tertarik%20dengan%20aplikasi%20kasir"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block hover:opacity-80 transition-opacity group"
                        >
                            <p className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wider">Powered by LockApp.id</p>
                            <p className="text-xs font-medium text-gray-500 group-hover:text-purple-400 transition-colors">
                                🚀 Dapatkan Aplikasi Serupa
                            </p>
                        </a>
                    </div>
                </main>

                {/* Bottom Navigation (Mobile Only) */}
                <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 md:hidden">
                    <div className="max-w-md mx-auto md:max-w-7xl px-4 md:px-8 flex">
                        <NavLink
                            to={`/${tableId ? `?meja=${tableId}` : ''}`}
                            end
                            className="flex-1 relative group outline-none"
                        >
                            {({ isActive }) => (
                                <div className={`flex flex-col items-center py-3 transition-colors ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                                    {isActive && (
                                        <motion.div
                                            layoutId="navHighlight"
                                            className="absolute inset-0 bg-blue-500/20 blur-sm rounded-xl"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <motion.span
                                        className="text-xl mb-1 relative z-10"
                                        whileTap={{ scale: 0.8 }}
                                        animate={{ scale: isActive ? 1.1 : 1 }}
                                    >
                                        🏠
                                    </motion.span>
                                    <span className="text-xs relative z-10">Beranda</span>
                                </div>
                            )}
                        </NavLink>

                        <NavLink
                            to={`/keranjang${tableId ? `?meja=${tableId}` : ''}`}
                            className="flex-1 relative group outline-none"
                        >
                            {({ isActive }) => (
                                <div className={`flex flex-col items-center py-3 transition-colors ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                                    {isActive && (
                                        <motion.div
                                            layoutId="navHighlight"
                                            className="absolute inset-0 bg-blue-500/20 blur-sm rounded-xl"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <div className="relative z-10">
                                        <motion.div
                                            className="text-xl mb-1 flex justify-center"
                                            whileTap={{ scale: 0.8 }}
                                            animate={{ scale: isActive ? 1.1 : 1 }}
                                        >
                                            🛒
                                        </motion.div>
                                        <AnimatePresence>
                                            {cartCount > 0 && (
                                                <motion.span
                                                    key={cartCount}
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    exit={{ scale: 0 }}
                                                    className="absolute -top-1 -right-2 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold border-2 border-[#1E1B4B]"
                                                >
                                                    {cartCount}
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <span className="text-xs relative z-10">Keranjang</span>
                                </div>
                            )}
                        </NavLink>

                        <NavLink
                            to={`/pesanan${tableId ? `?meja=${tableId}` : ''}`}
                            className="flex-1 relative group outline-none"
                        >
                            {({ isActive }) => (
                                <div className={`flex flex-col items-center py-3 transition-colors ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                                    {isActive && (
                                        <motion.div
                                            layoutId="navHighlight"
                                            className="absolute inset-0 bg-blue-500/20 blur-sm rounded-xl"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <motion.span
                                        className="text-xl mb-1 relative z-10"
                                        whileTap={{ scale: 0.8 }}
                                        animate={{ scale: isActive ? 1.1 : 1 }}
                                    >
                                        📋
                                    </motion.span>
                                    <span className="text-xs relative z-10">Pesanan</span>
                                </div>
                            )}
                        </NavLink>

                        <NavLink
                            to={`/bantuan${tableId ? `?meja=${tableId}` : ''}`}
                            className="flex-1 relative group outline-none"
                        >
                            {({ isActive }) => (
                                <div className={`flex flex-col items-center py-3 transition-colors ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                                    {isActive && (
                                        <motion.div
                                            layoutId="navHighlight"
                                            className="absolute inset-0 bg-blue-500/20 blur-sm rounded-xl"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <motion.span
                                        className="text-xl mb-1 relative z-10"
                                        whileTap={{ scale: 0.8 }}
                                        animate={{ scale: isActive ? 1.1 : 1 }}
                                    >
                                        ❓
                                    </motion.span>
                                    <span className="text-xs relative z-10">Bantuan</span>
                                </div>
                            )}
                        </NavLink>
                    </div>
                </nav>
            </div>
        </CartContext.Provider>
    );
}

export default CustomerLayout;
