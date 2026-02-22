import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { employeesAPI, menuAPI, customersAPI, inventoryAPI } from '../services/api';
import { useTenant } from './TenantRouter';

const CommandPalette = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { tenantSlug } = useTenant();
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef(null);
    const debounceTimeout = useRef(null);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setSearch('');
            setResults([]);
            setIsSearching(false);
        }
    }, [isOpen]);

    // Handle Esc key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Get User Role
    let user = {};
    try {
        user = JSON.parse(localStorage.getItem('user') || '{}');
    } catch (err) {
        console.error('Error parsing user data:', err);
    }
    const userRole = user?.role || 'staf';
    const userRoleAccess = user?.role_access || [];

    // Base navigation actions (without tenant slug prefix)
    const baseNavActions = [
        { id: 'dashboard', name: 'Dashboard', icon: '📊', url: '/admin/dashboard', access: 'Dashboard', type: 'Navigasi', keywords: ['home', 'utama', 'statistik'] },
        { id: 'menu', name: 'Manajemen Menu', icon: '🍽️', url: '/admin/menu', access: 'Menu', type: 'Navigasi', keywords: ['makanan', 'minuman', 'produk'] },
        { id: 'kasir', name: 'Kasir (POS)', icon: '🧾', url: '/admin/kasir', access: 'POS', type: 'Navigasi', keywords: ['jual', 'bayar', 'transaksi'] },
        { id: 'gramasi', name: 'Gramasi & HPP', icon: '⚖️', url: '/admin/gramasi', access: 'Gramasi', type: 'Navigasi', keywords: ['resep', 'bahan baku'] },
        { id: 'inventaris', name: 'Inventaris', icon: '📦', url: '/admin/inventaris', access: 'Inventori', type: 'Navigasi', keywords: ['stok', 'gudang'] },
        { id: 'keuangan', name: 'Keuangan & Kas', icon: '💰', url: '/admin/keuangan', access: 'Keuangan', roles: ['admin', 'owner'], type: 'Navigasi', keywords: ['laba', 'rugi'] },
        { id: 'pegawai', name: 'Pegawai', icon: '👥', url: '/admin/pegawai', access: 'Pegawai', roles: ['admin', 'owner'], type: 'Navigasi', keywords: ['karyawan', 'staff'] },
        { id: 'meja', name: 'Meja & Reservasi', icon: '🪑', url: '/admin/meja', access: 'Meja', type: 'Navigasi', keywords: ['booking', 'denah'] },
        { id: 'pelanggan', name: 'Pelanggan & Loyalti', icon: '❤️', url: '/admin/pelanggan', access: 'Pelanggan', type: 'Navigasi', keywords: ['member', 'crm'] },
        { id: 'laporan', name: 'Laporan & Analitik', icon: '📈', url: '/admin/laporan', access: 'Laporan', roles: ['admin', 'owner'], type: 'Navigasi', keywords: ['audit', 'export'] },
        { id: 'shift', name: 'Laporan Shift', icon: '🔐', url: '/admin/shift', access: 'Laporan', roles: ['admin', 'owner'], type: 'Navigasi', keywords: ['tutup kasir'] },
        { id: 'pengaturan', name: 'Pengaturan Umum', icon: '⚙️', url: '/admin/pengaturan', access: 'Settings', roles: ['admin', 'owner'], type: 'Navigasi', keywords: ['system'] },
        { id: 'datacenter', name: 'Pusat Data', icon: '🗄️', url: '/admin/data-center', access: 'Settings', roles: ['admin', 'owner'], type: 'Navigasi', keywords: ['backup'] }
    ];

    // Generate tenant-specific navigation actions
    const navActions = useMemo(() => {
        if (!tenantSlug) return baseNavActions;
        
        return baseNavActions.map(action => ({
            ...action,
            url: `/${tenantSlug}${action.url}`
        }));
    }, [tenantSlug]);

    // Check Access Helper
    const checkAccess = (action) => {
        if (userRole === 'admin' || userRole === 'owner' || userRoleAccess?.includes('*')) return true;
        if (action.access && userRoleAccess?.includes(action.access)) return true;
        if (action.roles && !action.roles.includes(userRole)) return false;
        if (!action.roles && !action.access) return true;
        return false;
    };

    // Filter Navigation based on role
    const allowedNavActions = navActions.filter(checkAccess);

    // Search Logic with Debounce
    useEffect(() => {
        if (!search) {
            setResults(allowedNavActions);
            return;
        }

        setIsSearching(true);
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

        debounceTimeout.current = setTimeout(async () => {
            const term = search.toLowerCase();
            const allResults = [];

            // 1. Search Navigation (Synchronous)
            const navResults = allowedNavActions.filter(action =>
                action.name.toLowerCase().includes(term) ||
                action.keywords?.some(k => k.includes(term))
            );
            allResults.push(...navResults);

            // 2. Search Dynamic Data (Async) if query > 2 chars
            if (term.length >= 2) {
                try {
                    const promises = [];

                    // API Call: Employees (if accessible)
                    if (checkAccess({ access: 'Pegawai', roles: ['admin', 'owner'] })) {
                        promises.push(employeesAPI.getAll().then(res => {
                            // Helper to safely extract array from various API response structures
                            const rawData = res.data;
                            const emps = Array.isArray(rawData) ? rawData : (rawData?.data || []);

                            return emps.filter(e => e.name.toLowerCase().includes(term)).map(e => ({
                                id: `emp_${e.id}`,
                                name: e.name,
                                icon: '👤',
                                type: 'Pegawai',
                                detail: e.role,
                                url: tenantSlug ? `/${tenantSlug}/admin/pegawai` : '/admin/pegawai'
                            }));
                        }).catch(() => []));
                    }

                    // API Call: Menu (if accessible)
                    if (checkAccess({ access: 'Menu' })) {
                        promises.push(menuAPI.getAll().then(res => {
                            const rawData = res.data;
                            const menus = Array.isArray(rawData) ? rawData : (rawData?.data || []);

                            return menus.filter(m => m.name.toLowerCase().includes(term)).map(m => ({
                                id: `menu_${m.id}`,
                                name: m.name,
                                icon: '☕',
                                type: 'Menu',
                                detail: `Stok: ${m.available_qty || '∞'}`,
                                url: tenantSlug ? `/${tenantSlug}/admin/menu` : '/admin/menu'
                            }));
                        }).catch(() => []));
                    }

                    // API Call: Customers (if accessible)
                    if (checkAccess({ access: 'Pelanggan' })) {
                        promises.push(customersAPI.getAll().then(res => {
                            const rawData = res.data;
                            const custs = Array.isArray(rawData) ? rawData : (rawData?.data || []);

                            return custs.filter(c => c.name.toLowerCase().includes(term)).map(c => ({
                                id: `cust_${c.id}`,
                                name: c.name,
                                icon: '❤️',
                                type: 'Pelanggan',
                                detail: c.phone || 'No Phone',
                                url: tenantSlug ? `/${tenantSlug}/admin/pelanggan` : '/admin/pelanggan'
                            }));
                        }).catch(() => []));
                    }

                    // API Call: Inventory (if accessible)
                    if (checkAccess({ access: 'Inventori' })) {
                        promises.push(inventoryAPI.getAll().then(res => {
                            const rawData = res.data;
                            const items = Array.isArray(rawData) ? rawData : (rawData?.data || []);

                            return items.filter(i => i.name.toLowerCase().includes(term)).map(i => ({
                                id: `inv_${i.id}`,
                                name: i.name,
                                icon: '📦',
                                type: 'Inventaris',
                                detail: `${i.stock} ${i.unit}`,
                                url: tenantSlug ? `/${tenantSlug}/admin/inventaris` : '/admin/inventaris'
                            }));
                        }).catch(() => []));
                    }

                    const dynamicResults = await Promise.all(promises);
                    dynamicResults.forEach(res => allResults.push(...res));

                } catch (err) {
                    console.error("Global search error", err);
                }
            }

            setResults(allResults);
            setIsSearching(false);
        }, 400); // 400ms debounce

        return () => clearTimeout(debounceTimeout.current);
    }, [search]); // Re-run when search changes

    const handleSelect = (action) => {
        navigate(action.url);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-[10vh] px-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="relative w-full max-w-2xl bg-[#1E1B4B] border border-purple-500/30 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
                        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
                    >
                        {/* Search Input */}
                        <div className="flex items-center gap-3 p-4 border-b border-white/10">
                            <span className="text-xl animate-pulse">
                                {isSearching ? '⏳' : '🔍'}
                            </span>
                            <input
                                ref={inputRef}
                                type="text"
                                className="flex-1 bg-transparent text-white text-lg placeholder-gray-500 focus:outline-none"
                                placeholder="Cari menu, pegawai, pelanggan... (Ctrl + K)"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <button onClick={onClose} className="px-2 py-1 text-xs bg-white/10 rounded text-gray-400 font-mono">Esc</button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto p-2 scrollbar-hide">
                            {results.length === 0 && !isSearching ? (
                                <div className="p-8 text-center text-gray-500">
                                    <div className="text-4xl mb-2">🤔</div>
                                    <p>Tidak ada hasil ditemukan</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {results.map((action, index) => (
                                        <motion.button
                                            key={action.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                            onClick={() => handleSelect(action)}
                                            className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 hover:border-l-4 hover:border-purple-500 text-left transition-all group"
                                        >
                                            <div className="text-2xl opacity-70 group-hover:opacity-100 transition-opacity w-8 text-center">
                                                {action.icon}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium text-white group-hover:text-purple-300 transition-colors">
                                                    {action.name}
                                                </div>
                                                <div className="flex gap-2 text-xs text-gray-500">
                                                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-purple-400">
                                                        {action.type}
                                                    </span>
                                                    {action.detail && (
                                                        <span>• {action.detail}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-gray-600 text-xs font-mono">↵</div>
                                        </motion.button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CommandPalette;
