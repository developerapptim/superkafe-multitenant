import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import useSWR, { mutate } from 'swr';
import api, { menuAPI, ordersAPI, tablesAPI, shiftAPI } from '../../services/api';

// Generic fetcher for SWR
const fetcher = url => api.get(url).then(res => res.data);

// Phone number formatter (08xxx -> 62xxx)
const formatPhoneNumber = (phone) => {
    if (!phone || typeof phone !== 'string') return null;
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned || cleaned.length < 9) return null;
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
    if (!cleaned.startsWith('62') && cleaned.length >= 9) cleaned = '62' + cleaned;
    return cleaned.length >= 11 ? cleaned : null;
};

// Custom Select Component for Consistent UI
const CustomSelect = ({ label, value, options, onChange, disabled, placeholder = 'Pilih...' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm text-gray-400 mb-1">{label}</label>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full px-4 h-10 rounded-lg text-left bg-surface/50 border ${isOpen ? 'border-purple-500 ring-1 ring-purple-500/50' : 'border-purple-500/30'} flex items-center justify-between transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface'}`}
                disabled={disabled}
            >
                <div className="flex items-center gap-2 truncate">
                    {selectedOption ? (
                        <>
                            <span>{selectedOption.icon}</span>
                            <span className="text-white">{selectedOption.label}</span>
                        </>
                    ) : (
                        <span className="text-gray-500">{placeholder}</span>
                    )}
                </div>
                <span className="text-gray-400 text-xs">▼</span>
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-[#1a1a2e] border border-purple-500/30 rounded-lg shadow-xl max-h-60 overflow-auto animate-fade-in custom-scrollbar">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-left flex items-center gap-2 hover:bg-purple-500/20 transition-colors ${value === option.value ? 'bg-purple-500/10 text-purple-300' : 'text-gray-300'}`}
                        >
                            <span>{option.icon}</span>
                            <span>{option.label}</span>
                            {value === option.value && <span className="ml-auto text-purple-400">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


function Kasir() {
    // Get User Role
    let user = {};
    try {
        user = JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
        console.error('Error parsing user:', e);
    }
    const isAdmin = user.role === 'admin' || user.role === 'owner';

    // SWR Data Fetching
    const { data: menuData } = useSWR('/menu', fetcher, { refreshInterval: 60000 }); // Refresh menu every 1 min
    const { data: ordersData } = useSWR('/orders', fetcher, { refreshInterval: 5000 }); // Refresh orders every 5s
    const { data: tablesData } = useSWR('/tables', fetcher, { refreshInterval: 10000 });

    const { data: shiftData } = useSWR('/shift/current-balance', fetcher);
    const { data: settings } = useSWR('/settings', fetcher);

    // Derived state from SWR data
    const menuItems = (menuData || []).filter(m => m.is_active !== false && m.available !== false);
    const tables = tablesData || [];

    // Process Active Orders
    const today = new Date().toISOString().split('T')[0];
    const orders = (ordersData || []).filter(o =>
        !o.is_archived_from_pos &&
        (o.date === today || (o.timestamp && new Date(o.timestamp).toISOString().split('T')[0] === today))
    );

    // Filter state
    const [filter, setFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [selectedProof, setSelectedProof] = useState(null); // For Payment Proof Modal
    const [showCashDrawer, setShowCashDrawer] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [processingOrderId, setProcessingOrderId] = useState(null); // Prevent double-submit

    // Search and Merge Bill states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedForMerge, setSelectedForMerge] = useState([]);
    const [showMergeModal, setShowMergeModal] = useState(false);

    // Payment Modal State
    const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
    const [paymentInput, setPaymentInput] = useState('');

    // Form states
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [selectedTable, setSelectedTable] = useState('');
    const [orderType, setOrderType] = useState('dine-in');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [note, setNote] = useState('');
    const [cart, setCart] = useState([]);

    // Customer Autocomplete States
    const [customerSuggestions, setCustomerSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const customerInputRef = useRef(null);

    // Shift Logic State
    const [startCash, setStartCash] = useState('');
    const [isStartingShift, setIsStartingShift] = useState(false);

    // Initial loading state (only when no data is in cache)
    const [menuCategory, setMenuCategory] = useState('all');
    const [menuSearchQuery, setMenuSearchQuery] = useState('');

    // Click outside to close suggestions
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (customerInputRef.current && !customerInputRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);



    // Audio State
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('pos_muted') === 'true');
    const prevOrdersLength = useRef(0);

    // Audio Logic
    useEffect(() => {
        if (!ordersData) return;

        const totalOrders = ordersData.length;
        // Check if new order arrived (count increased)
        if (totalOrders > prevOrdersLength.current) {
            const hasNew = ordersData.some(o => o.status === 'new');
            // Play sound if not muted and has new orders
            if (hasNew && !isMuted) {
                if (settings?.notificationSoundUrl) {
                    new Audio(settings.notificationSoundUrl).play().catch(err => console.log('Audio play failed:', err));
                } else {
                    // Fallback: Generate Beep
                    try {
                        const ctx = new (window.AudioContext || window.webkitAudioContext)();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.frequency.value = 550; // A bit higher pitch
                        osc.type = 'sine';
                        gain.gain.value = 0.1;
                        osc.start();
                        osc.stop(ctx.currentTime + 0.5); // 0.5s beep
                    } catch (e) {
                        console.error('AudioContext error:', e);
                    }
                }
                toast('Pesanan Baru Masuk!', { icon: '🔔' });
            }
        }
        prevOrdersLength.current = totalOrders;
    }, [ordersData, isMuted, settings]);

    const toggleMute = () => {
        const newState = !isMuted;
        setIsMuted(newState);
        localStorage.setItem('pos_muted', newState);
    };

    // Cash Drawer Data
    const cashDrawer = {
        openingCash: shiftData?.startCash || 0,
        totalCash: shiftData?.totalCash || shiftData?.currentCash || 0,
        nonCash: shiftData?.totalNonCash || shiftData?.currentNonCash || 0,
        // LOGIC UPDATE:
        // 1. If Staff: Show their name (user.name)
        // 2. If Admin: Show the active shift's cashier name
        // 3. If Admin & No Shift: Show "- (Tutup)"
        kasirName: !isAdmin
            ? (user.name || 'Staff')
            : (shiftData?.cashierName ? shiftData.cashierName : null), // Null if closed to handle styling later
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    };

    // Filter orders (by status and search query)
    const filteredOrders = orders.filter(o => {
        // Status filter
        if (filter !== 'all' && o.status !== filter) return false;

        // Search filter (by name, table, or order ID)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchName = (o.customerName || '').toLowerCase().includes(query);
            const matchTable = (o.tableNumber || '').toString().includes(query);
            const matchId = (o.id || '').toLowerCase().includes(query);
            const matchPhone = (o.phone || '').includes(query);
            if (!matchName && !matchTable && !matchId && !matchPhone) return false;
        }

        return true;
    });

    const orderCounts = {
        new: orders.filter(o => o.status === 'new').length,
        process: orders.filter(o => o.status === 'process').length,
        done: orders.filter(o => o.status === 'done').length,
    };

    // Available tables
    const availableTables = tables.filter(t => t.status === 'available');

    // Add item to cart
    const addToCart = (menuItem) => {
        const existing = cart.find(item => item.id === menuItem.id);
        if (existing) {
            setCart(cart.map(item =>
                item.id === menuItem.id
                    ? { ...item, qty: item.qty + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                id: menuItem.id,
                name: menuItem.name,
                price: menuItem.price,
                qty: 1,
                emoji: menuItem.category === 'kopi' ? '☕' :
                    menuItem.category === 'minuman' ? '🥤' :
                        menuItem.category === 'makanan' ? '🍛' : '🍿'
            }]);
        }
    };

    // Remove item from cart
    const removeFromCart = (menuId) => {
        setCart(cart.filter(item => item.id !== menuId));
    };

    // Update quantity
    const updateQty = (menuId, delta) => {
        setCart(cart.map(item => {
            if (item.id === menuId) {
                const newQty = item.qty + delta;
                return newQty > 0 ? { ...item, qty: newQty } : null;
            }
            return item;
        }).filter(Boolean));
    };

    // Calculate cart total
    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // Create new order
    const createOrder = async () => {
        if (cart.length === 0) {
            toast.error('Pilih minimal 1 menu!');
            return;
        }
        if (!customerName.trim()) {
            toast.error('Masukkan nama pelanggan!');
            return;
        }
        if (orderType === 'dine-in' && !selectedTable) {
            toast.error('Pilih nomor meja!');
            return;
        }

        setSubmitting(true);
        const toastId = toast.loading('Memproses pesanan...');
        try {
            const now = new Date();
            const orderData = {
                id: `ORD-${Date.now()}`,
                customerName: customerName,
                customerPhone: formatPhoneNumber(customerPhone) || null,
                tableNumber: orderType === 'dine-in' ? selectedTable : null,
                orderType: orderType,
                status: 'new',
                items: cart.map(item => ({
                    menuId: item.id,
                    name: item.name,
                    qty: item.qty,
                    price: item.price,
                    subtotal: item.price * item.qty
                })),
                total: cartTotal,
                paymentMethod: paymentMethod,
                notes: note,
                date: now.toISOString().split('T')[0],
                time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                timestamp: now.getTime(),
            };

            await ordersAPI.create(orderData);

            // Mutate SWR cache to update UI
            mutate('/orders');
            if (orderType === 'dine-in' && selectedTable) {
                await tablesAPI.updateStatus(selectedTable, 'occupied');
                mutate('/tables');
            }

            resetForm();
            setShowModal(false);
            toast.success('Pesanan berhasil dibuat! ✅', { id: toastId });
        } catch (err) {
            console.error('Error creating order:', err);
            toast.error('Gagal membuat pesanan: ' + (err.response?.data?.error || err.message), { id: toastId });
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenPayment = (order) => {
        setSelectedOrderForPayment(order);
        setPaymentInput('');
    };

    const handleConfirmPayment = async () => {
        if (!selectedOrderForPayment) return;

        const toastId = toast.loading('Memproses pembayaran...');
        try {
            // Update to paid
            await ordersAPI.payOrder(selectedOrderForPayment.id, selectedOrderForPayment.paymentMethod);

            // If cash and payment input exists, maybe log it? For now just mark paid.
            // In a real app we might want to record the exact cash amount given.

            mutate('/orders'); // Refresh
            toast.success('Pembayaran berhasil! Silakan selesaikan pesanan.', { id: toastId });
            setSelectedOrderForPayment(null);
        } catch (err) {
            console.error(err);
            toast.error('Gagal memproses pembayaran', { id: toastId });
        }
    };

    // Reset form
    const resetForm = () => {
        setCustomerName('');
        setCustomerPhone('');
        setSelectedTable('');
        setOrderType('dine-in');
        setPaymentMethod('cash');
        setNote('');
        setCart([]);
        setCustomerSuggestions([]);
        setShowSuggestions(false);
    };

    // Customer search for autocomplete
    const searchCustomers = async (query) => {
        if (query.length < 2) {
            setCustomerSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        try {
            const res = await api.get(`/customers/search?q=${encodeURIComponent(query)}`);
            setCustomerSuggestions(res.data || []);
            setShowSuggestions(res.data?.length > 0);
        } catch (err) {
            console.error('Customer search error:', err);
            setCustomerSuggestions([]);
        }
    };

    // Debounced customer search
    const searchTimeoutRef = useRef(null);
    const handleCustomerNameChange = (value) => {
        setCustomerName(value);
        // Clear existing timeout
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        // Debounce search
        searchTimeoutRef.current = setTimeout(() => {
            searchCustomers(value);
        }, 300);
    };

    // Select customer from suggestions
    const selectCustomer = (customer) => {
        setCustomerName(customer.name || '');
        setCustomerPhone(customer.phone || '');
        setShowSuggestions(false);
        setCustomerSuggestions([]);
    };

    // Update order status
    const updateOrderStatus = async (orderId, newStatus) => {
        if (processingOrderId) return; // Prevent double-submit
        setProcessingOrderId(orderId);
        try {
            await ordersAPI.updateStatus(orderId, newStatus);
            mutate('/orders'); // Refresh orders

            // Refresh saldo when order is completed
            if (newStatus === 'done') {
                mutate('/shift/current-balance'); // Refresh saldo widget
                toast.success('Pesanan selesai! Saldo diperbarui.');
            }

            // If order done, update table to DIRTY (needs cleaning)
            if (newStatus === 'done') {
                const order = orders.find(o => o.id === orderId);
                if (order?.tableNumber) {
                    // Check if any other active orders at this table
                    const tableOrders = orders.filter(o => o.tableNumber === order.tableNumber && o.id !== orderId && o.status !== 'done' && o.status !== 'cancel');
                    if (tableOrders.length === 0) {
                        // Last order at table, mark as dirty
                        await tablesAPI.updateStatus(order.tableNumber, 'dirty');
                        mutate('/tables');
                    }
                }
            }
        } catch (err) {
            console.error('Error updating order:', err);
            toast.error('Gagal update status: ' + (err.response?.data?.error || err.message));
        } finally {
            setProcessingOrderId(null);
        }
    };



    // Get status badge style
    const getStatusStyle = (status) => {
        switch (status) {
            case 'new': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'pending_payment': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'process': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'done': return 'bg-green-500/20 text-green-400 border-green-500/30';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    // Get status label
    const getStatusLabel = (status) => {
        switch (status) {
            case 'new': return '🟡 Baru';
            case 'pending_payment': return '🟠 Menunggu Bayar';
            case 'process': return '🔵 Diproses';
            case 'done': return '🟢 Selesai';
            default: return status;
        }
    };

    // Toggle order selection for merge
    const toggleMergeSelection = (orderId) => {
        setSelectedForMerge(prev =>
            prev.includes(orderId)
                ? prev.filter(id => id !== orderId)
                : [...prev, orderId]
        );
    };

    // Handle merge bill
    const handleMergeBill = async () => {
        if (selectedForMerge.length < 2) {
            toast.error('Pilih minimal 2 pesanan untuk digabung');
            return;
        }

        const toastId = toast.loading('Menggabungkan tagihan...');
        try {
            await ordersAPI.merge(selectedForMerge);
            mutate('/orders');
            setSelectedForMerge([]);
            setShowMergeModal(false);
            toast.success('Tagihan berhasil digabungkan!', { id: toastId });
        } catch (err) {
            console.error('Error merging orders:', err);
            toast.error(err.response?.data?.error || 'Gagal menggabungkan tagihan', { id: toastId });
        }
    };

    // Get selected orders for merge preview
    const selectedOrdersForMerge = orders.filter(o => selectedForMerge.includes(o.id));
    const mergePreviewTotal = selectedOrdersForMerge.reduce((sum, o) => sum + (o.total || 0), 0);

    // Get category emoji
    const getCategoryEmoji = (category) => {
        switch (category?.toLowerCase()) {
            case 'kopi': return '☕';
            case 'minuman': return '🥤';
            case 'makanan': return '🍛';
            case 'snack': return '🍿';
            default: return '🍽️';
        }
    };

    // Initial loading state (only when no data is in cache)
    if (!menuData && !ordersData) {
        return (
            <section className="flex flex-col h-[calc(100vh-80px)]">
                {/* Header Bar Skeleton */}
                <div className="flex items-center justify-between p-4 border-b border-purple-500/20 bg-surface/50">
                    <h2 className="text-2xl font-bold">🧾 Kasir (POS)</h2>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            </section>
        );
    }

    // BLOCKING LOGIC: If Shift is Closed
    const isShiftOpen = shiftData?.shiftId;

    // Helper to start shift
    const handleStartShift = async (e) => {
        e.preventDefault();
        if (!startCash) return toast.error('Masukkan modal awal!');

        const toastId = toast.loading('Membuka shift...');
        setIsStartingShift(true);
        try {
            // Get user info again to be sure
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            await shiftAPI.startShift({
                cashierName: user.name || 'Staff',
                userId: user.id,
                startCash: Number(startCash)
            });
            mutate('/shift/current-balance'); // Refresh SWR
            toast.success('Shift berhasil dibuka! Selamat bekerja  semangat! 💪', { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error('Gagal buka shift', { id: toastId });
        } finally {
            setIsStartingShift(false);
        }
    };

    // 1. If Staff AND Shift Closed -> BLOCK ACCESS (Show Open Shift UI)
    if (!isAdmin && !isShiftOpen) {
        return (
            <section className="flex flex-col h-[calc(100vh-80px)] items-center justify-center p-4">
                <div className="glass max-w-md w-full p-8 rounded-2xl border border-purple-500/30 text-center shadow-2xl animate-scale-up">
                    <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-4xl">🔐</span>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Kasir Belum Dibuka</h2>
                    <p className="text-gray-400 mb-8">Silakan masukkan modal awal (petty cash) untuk memulai shift hari ini.</p>

                    <form onSubmit={handleStartShift} className="space-y-4 text-left">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Modal Awal (Rp)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">Rp</span>
                                <input
                                    type="number"
                                    value={startCash}
                                    onChange={(e) => setStartCash(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-purple-500/30 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none text-white text-lg font-bold placeholder-gray-600 transition-all"
                                    placeholder="0"
                                    autoFocus
                                    min="0"
                                    required
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isStartingShift}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-lg shadow-lg shadow-purple-500/25 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale"
                        >
                            {isStartingShift ? '⏳ Membuka Shift...' : '🚀 Buka Kasir'}
                        </button>
                    </form>
                </div>
            </section>
        );
    }

    return (
        <section className="flex flex-col h-[calc(100vh-80px)]">
            {/* Header Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between p-4 border-b border-purple-500/20 bg-surface/50 gap-4">


                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <h2 className="text-2xl font-bold text-left">🧾 Kasir (POS)</h2>
                        {isAdmin && (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs font-medium animate-fade-in select-none">
                                <span>👁️</span>
                                <span>Mode Pantau</span>
                            </div>
                        )}
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="🔍 Cari nama, meja, ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full md:w-48 px-4 py-2 pl-4 pr-10 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-400 text-sm focus:w-full md:focus:w-64 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Status Filter Pills */}
                    <div className="flex gap-2 flex-wrap w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1 rounded-full text-xs md:text-sm whitespace-nowrap transition-all ${filter === 'all' ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                                }`}
                        >
                            Semua
                        </button>
                        <button
                            onClick={() => setFilter('new')}
                            className={`px-3 py-1 rounded-full text-xs md:text-sm whitespace-nowrap transition-all ${filter === 'new' ? 'bg-yellow-500/30 text-yellow-300' : 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                                }`}
                        >
                            🟡 Baru <span className="ml-1 font-bold">{orderCounts.new}</span>
                        </button>
                        <button
                            onClick={() => setFilter('pending_payment')}
                            className={`px-3 py-1 rounded-full text-xs md:text-sm whitespace-nowrap transition-all ${filter === 'pending_payment' ? 'bg-orange-500/30 text-orange-300' : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                                }`}
                        >
                            🟠 Bayar
                        </button>
                        <button
                            onClick={() => setFilter('process')}
                            className={`px-3 py-1 rounded-full text-xs md:text-sm whitespace-nowrap transition-all ${filter === 'process' ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                                }`}
                        >
                            🔵 Diproses <span className="ml-1 font-bold">{orderCounts.process}</span>
                        </button>
                        <button
                            onClick={() => setFilter('done')}
                            className={`px-3 py-1 rounded-full text-xs md:text-sm whitespace-nowrap transition-all ${filter === 'done' ? 'bg-green-500/30 text-green-300' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                }`}
                        >
                            🟢 Selesai <span className="ml-1 font-bold">{orderCounts.done}</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="flex-1 md:flex-none justify-center px-3 py-2 rounded-lg bg-surface text-sm flex items-center gap-2 hover:bg-surface/80 border border-purple-500/30"
                    >
                        <span>{soundEnabled ? '🔊' : '🔇'}</span>
                        <span className="hidden lg:inline">Notifikasi</span>
                    </button>
                    {!isAdmin && (
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex-1 md:flex-none justify-center bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-purple-500/40 whitespace-nowrap transition-all"
                        >
                            <span className="text-lg md:text-xl">➕</span> <span className="text-sm md:text-base">Pesanan Baru</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Order Grid */}
            <div
                className="flex-1 overflow-auto p-3 md:p-4"
                style={{ background: 'linear-gradient(180deg, rgba(139,92,246,0.02) 0%, transparent 100%)' }}
            >
                {filteredOrders.length === 0 ? (
                    <div className="col-span-full text-center py-20 text-gray-500">
                        <div className="text-6xl mb-4">📋</div>
                        <p className="text-xl">Belum ada pesanan aktif</p>
                        <p className="text-sm mt-2">Klik "Buat Pesanan Baru" untuk memulai</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                        {filteredOrders.map((order) => (
                            <div
                                key={order.id}
                                className={`glass rounded-xl p-3 md:p-4 border-2 transition-all duration-300 hover:scale-[1.02] ${order.status === 'new'
                                    ? 'border-yellow-400 bg-yellow-900/20 shadow-[0_0_20px_-3px_rgba(250,204,21,0.5)] animate-pulse-slow ring-2 ring-yellow-400/30'
                                    : selectedForMerge.includes(order.id)
                                        ? 'border-purple-500 bg-purple-900/20 ring-2 ring-purple-500/50'
                                        : `border-transparent ${getStatusStyle(order.status)}`
                                    }`}
                            >
                                {/* Order Header */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-start gap-2">
                                        {/* Merge Checkbox */}
                                        <input
                                            type="checkbox"
                                            checked={selectedForMerge.includes(order.id)}
                                            onChange={() => toggleMergeSelection(order.id)}
                                            className="mt-1 w-4 h-4 rounded border-purple-500/50 text-purple-500 focus:ring-purple-500/50 bg-white/10 cursor-pointer"
                                            title="Pilih untuk gabung tagihan"
                                        />
                                        <div>
                                            <p className="font-bold">{order.customerName || 'Pelanggan'}</p>
                                            {order.phone && (
                                                <p className="text-xs text-blue-300 mb-0.5">📱 {order.phone}</p>
                                            )}


                                            {/* Order Type Badge */}
                                            <div className="flex items-center gap-2 mt-1">
                                                {order.orderType === 'take_away' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500/30 text-orange-300 border border-orange-500/50">
                                                        🛍️ BUNGKUS
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                        🍽️ Meja {order.tableNumber || '-'}
                                                    </span>
                                                )}
                                                <span className="text-xs text-gray-500">• {order.time}</span>
                                            </div>

                                            {/* Payment Method Badge */}
                                            <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs ${order.paymentMethod === 'cash' ? 'bg-green-500/20 text-green-400' :
                                                order.paymentMethod === 'qris' ? 'bg-purple-500/20 text-purple-400' :
                                                    order.paymentMethod === 'bank' ? 'bg-blue-500/20 text-blue-400' :
                                                        order.paymentMethod === 'ewallet' ? 'bg-orange-500/20 text-orange-400' :
                                                            'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {order.paymentMethod === 'cash' ? '💵 Tunai' :
                                                    order.paymentMethod === 'qris' ? '📱 QRIS' :
                                                        order.paymentMethod === 'bank' ? '🏦 Transfer' :
                                                            order.paymentMethod === 'ewallet' ? '📲 E-Wallet' :
                                                                '💳 -'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusStyle(order.status)}`}>
                                        {getStatusLabel(order.status)}
                                    </span>
                                </div>


                                {/* Order Items */}
                                <div className="space-y-2 mb-3 max-h-40 overflow-auto pr-1">
                                    {order.items?.map((item, idx) => (
                                        <div key={idx} className="text-sm border-b border-white/5 pb-1 last:border-0">
                                            <div className="flex justify-between">
                                                <span>{item.name || item.menuName} x{item.qty || item.quantity}</span>
                                                <span className="text-gray-400">{formatCurrency((item.price || 0) * (item.qty || item.quantity || 1))}</span>
                                            </div>
                                            {item.note && (
                                                <p className="text-xs text-yellow-500/80 italic mt-0.5 ml-2">
                                                    └ 📝 {item.note}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {order.notes && (
                                    <div className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded-lg mb-3">
                                        📝 {order.notes}
                                    </div>
                                )}

                                {/* Payment Proof Button */}
                                {order.paymentProofImage && (
                                    <div className="mb-3">
                                        <button
                                            onClick={() => setSelectedProof(order.paymentProofImage)}
                                            className="w-full py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs hover:bg-purple-500/30 flex items-center justify-center gap-2"
                                        >
                                            📷 Lihat Bukti Bayar
                                        </button>
                                    </div>
                                )}

                                {/* Order Footer */}
                                <div className="flex justify-between items-center pt-3 border-t border-white/10">
                                    <div>
                                        <p className="text-xs text-gray-400">Total</p>
                                        <p className="font-bold text-green-400">{formatCurrency(order.total || 0)}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {order.status === 'new' && (
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'process')}
                                                disabled={processingOrderId === order.id || isAdmin}
                                                className={`px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 ${processingOrderId === order.id ? 'opacity-50 cursor-wait' : ''} ${isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {processingOrderId === order.id ? '⏳ Proses...' : '▶️ Proses'}
                                            </button>
                                        )}
                                        {order.status === 'pending_payment' && (
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'process')}
                                                disabled={processingOrderId === order.id || isAdmin}
                                                className={`px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 flex items-center gap-1 ${processingOrderId === order.id ? 'opacity-50 cursor-wait' : ''} ${isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {processingOrderId === order.id ? '⏳ Proses...' : <><span>💰</span> Bayar & Proses</>}
                                            </button>
                                        )}
                                        {order.status === 'process' && (
                                            order.paymentStatus === 'paid' ? (
                                                <button
                                                    onClick={() => updateOrderStatus(order.id, 'done')}
                                                    disabled={processingOrderId === order.id}
                                                    className={`px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 ${processingOrderId === order.id ? 'opacity-50 cursor-wait' : ''}`}
                                                >
                                                    {processingOrderId === order.id ? '⏳ Proses...' : '✅ Selesai'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleOpenPayment(order)}
                                                    disabled={isAdmin}
                                                    className={`px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30 flex items-center gap-1 ${isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <span>💸</span> Bayar
                                                </button>
                                            )
                                        )}
                                        {order.status === 'done' && (
                                            <span className="px-3 py-1 text-gray-500 text-sm">
                                                {order.paymentMethod === 'cash' ? '💵' :
                                                    order.paymentMethod === 'qris' ? '📱' :
                                                        order.paymentMethod === 'ewallet' ? '👛' : '🏦'} {(order.paymentMethod || 'cash').toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Cash Drawer Toggle Button */}
            <button
                onClick={() => setShowCashDrawer(!showCashDrawer)}
                className="fixed bottom-4 right-4 z-30 p-3 rounded-xl bg-green-500 text-white shadow-lg hover:bg-green-600 flex items-center gap-2"
            >
                <span className="text-xl">💰</span>
                <span className="font-bold">{formatCurrency(cashDrawer.totalCash)}</span>
            </button>

            {/* Cash Drawer Widget */}
            {showCashDrawer && (
                <div className="fixed bottom-20 right-4 z-40 glass rounded-xl p-4 border border-purple-500/30 shadow-2xl min-w-[280px]">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-sm flex items-center gap-2">💰 Laci Kas Digital</h4>
                        <button onClick={() => setShowCashDrawer(false)} className="text-gray-400 hover:text-white text-xs">✕</button>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Mute Button */}
                        <button
                            onClick={toggleMute}
                            className={`p-2 rounded-lg border ${isMuted ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-green-500/10 border-green-500/50 text-green-400'}`}
                            title={isMuted ? "Unmute Notifikasi" : "Mute Notifikasi"}
                        >
                            {isMuted ? '🔇' : '🔊'}
                        </button>

                        <div className="bg-white/5 rounded-lg border border-purple-500/20 px-3 py-1 text-right">
                            <p className="text-xs text-gray-400">Kasir:</p>
                            {cashDrawer.kasirName ? (
                                <p className="font-bold text-sm truncate max-w-[120px]">{cashDrawer.kasirName}</p>
                            ) : (
                                <p className="font-bold text-sm text-red-500">TUTUP</p>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 rounded-lg bg-surface/50">
                            <span className="text-xs text-gray-400">📥 Modal Awal</span>
                            <span className="font-bold text-blue-400">{formatCurrency(cashDrawer.openingCash)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                            <span className="text-xs text-green-400">💵 Saldo Tunai</span>
                            <span className="font-bold text-green-400 text-lg">{formatCurrency(cashDrawer.totalCash)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <span className="text-xs text-purple-400">💳 Non-Tunai</span>
                            <span className="font-bold text-purple-400">{formatCurrency(cashDrawer.nonCash)}</span>
                        </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-white/10 text-xs text-gray-500 text-center">
                        Update: {new Date().toLocaleTimeString('id-ID')}
                    </div>
                </div>
            )}

            {/* Payment Confirmation Modal */}
            {selectedOrderForPayment && (
                <div className="modal-overlay">
                    <div className="bg-surface border border-purple-500/30 rounded-2xl p-6 max-w-sm w-full animate-scale-up">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">💸</span>
                            </div>
                            <h3 className="text-xl font-bold mb-1">Konfirmasi Pembayaran</h3>
                            <p className="text-gray-400 text-sm">Pesanan atas nama <span className="text-white font-bold">{selectedOrderForPayment.customerName}</span></p>
                        </div>

                        <div className="bg-white/5 rounded-xl p-4 mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-400">Total Tagihan</span>
                                <span className="font-bold text-xl text-white">{formatCurrency(selectedOrderForPayment.total)}</span>
                            </div>

                            {selectedOrderForPayment.paymentMethod === 'cash' && (
                                <div className="mt-4 pt-4 border-t border-white/10">
                                    <label className="block text-xs text-gray-500 mb-1">Uang Diterima (Opsional - Hitung Kembalian)</label>
                                    <input
                                        type="number"
                                        value={paymentInput}
                                        onChange={(e) => setPaymentInput(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-right text-white focus:border-purple-500 outline-none"
                                        placeholder="0"
                                    />
                                    {paymentInput && Number(paymentInput) >= selectedOrderForPayment.total && (
                                        <div className="flex justify-between items-center mt-2 text-green-400">
                                            <span className="text-xs">Kembalian</span>
                                            <span className="font-bold">{formatCurrency(Number(paymentInput) - selectedOrderForPayment.total)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setSelectedOrderForPayment(null)}
                                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 font-medium"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleConfirmPayment}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-bold shadow-lg shadow-purple-500/20"
                            >
                                Konfirmasi Lunas
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Proof Modal */}
            {selectedProof && (
                <div className="modal-overlay" onClick={() => setSelectedProof(null)}>
                    <div className="relative max-w-lg w-full max-h-[90vh] bg-surface rounded-2xl overflow-hidden p-2" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedProof(null)}
                            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500"
                        >
                            ✕
                        </button>
                        <img src={selectedProof} alt="Bukti Pembayaran" className="w-full h-full object-contain rounded-xl" />
                        <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                            <span className="bg-black/70 text-white px-3 py-1 rounded-full text-xs">
                                🖱️ Klik di luar untuk tutup
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* New Order Modal - Modern Redesign */}
            {showModal && (
                <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div
                        className="bg-[#1A1A2E] w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border border-purple-500/20 overflow-hidden flex flex-col animate-scale-up"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#1A1A2E] shrink-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                                    <span className="text-xl">🛍️</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white leading-tight">Buat Pesanan Baru</h3>
                                    <p className="text-xs text-gray-400">Isi detail pesanan pelanggan</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="w-10 h-10 rounded-full bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition-all duration-300 group"
                                title="Tutup"
                            >
                                <span className="group-hover:rotate-90 transition-transform duration-300 text-lg">✕</span>
                            </button>
                        </div>

                        {/* Modal Body - Scrollable */}
                        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="space-y-6">
                                {/* Section 1: Customer Details */}
                                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                    <h4 className="text-sm font-bold text-purple-300 mb-4 flex items-center gap-2">
                                        👤 Informasi Pelanggan
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Name */}
                                        <div className="relative" ref={customerInputRef}>
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Nama Pelanggan</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={customerName}
                                                    onChange={(e) => handleCustomerNameChange(e.target.value)}
                                                    onFocus={() => customerSuggestions.length > 0 && setShowSuggestions(true)}
                                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/20 border border-purple-500/20 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-white placeholder-gray-600 transition-all outline-none"
                                                    placeholder="Ketik nama..."
                                                    autoComplete="off"
                                                />
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
                                            </div>

                                            {/* Suggestions */}
                                            {showSuggestions && customerSuggestions.length > 0 && (
                                                <div className="absolute z-20 w-full mt-2 bg-[#0F0A1F] border border-purple-500/30 rounded-xl shadow-2xl max-h-48 overflow-auto">
                                                    {customerSuggestions.map((cust, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => selectCustomer(cust)}
                                                            className="w-full px-4 py-3 text-left hover:bg-purple-500/10 border-b border-white/5 last:border-0 transition-colors flex justify-between items-center group"
                                                        >
                                                            <div>
                                                                <p className="font-bold text-sm text-white group-hover:text-purple-300">{cust.name}</p>
                                                                <p className="text-xs text-gray-500">{cust.phone}</p>
                                                            </div>
                                                            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                                Pilih
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Phone */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">No. Telepon <span className="text-gray-600">(Opsional)</span></label>
                                            <input
                                                type="tel"
                                                value={customerPhone}
                                                onChange={(e) => setCustomerPhone(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl bg-black/20 border border-purple-500/20 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-white placeholder-gray-600 transition-all outline-none"
                                                placeholder="08xx-xxxx-xxxx"
                                            />
                                        </div>

                                        {/* Table & Type */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">No. Meja</label>
                                            <CustomSelect
                                                value={selectedTable}
                                                onChange={setSelectedTable}
                                                placeholder="Pilih Meja"
                                                disabled={orderType === 'take-away'}
                                                options={availableTables.map(t => ({ value: t.number || t.id, label: `Meja ${t.number || t.id}`, icon: '🪑' }))}
                                                className="h-[46px]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Tipe Pesanan</label>
                                            <div className="grid grid-cols-2 gap-2 bg-black/20 p-1 rounded-xl h-[46px]">
                                                <button
                                                    onClick={() => setOrderType('dine-in')}
                                                    className={`rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${orderType === 'dine-in' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                                >
                                                    🍽️ Dine In
                                                </button>
                                                <button
                                                    onClick={() => setOrderType('take-away')}
                                                    className={`rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${orderType === 'take-away' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                                >
                                                    🛍️ Take Away
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Menu Selection */}
                                <div>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                        <h4 className="text-sm font-bold text-purple-300 flex items-center gap-2">
                                            🍔 Pilih Menu <span className="bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 rounded-full">{menuItems.length}</span>
                                        </h4>
                                        <div className="relative w-full md:w-64">
                                            <input
                                                type="text"
                                                placeholder="Cari menu..."
                                                value={menuSearchQuery}
                                                onChange={(e) => setMenuSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-purple-500 text-sm focus:outline-none transition-all"
                                            />
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                                        </div>
                                    </div>

                                    {/* Categories */}
                                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 hide-scrollbar">
                                        <button
                                            onClick={() => setMenuCategory('all')}
                                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${menuCategory === 'all'
                                                ? 'bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/25'
                                                : 'bg-transparent border-white/10 text-gray-400 hover:border-purple-500/50 hover:text-white'
                                                }`}
                                        >
                                            Semua
                                        </button>
                                        {[...new Set(menuItems.map(m => m.category))].filter(Boolean).map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setMenuCategory(cat)}
                                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${menuCategory === cat
                                                    ? 'bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/25'
                                                    : 'bg-transparent border-white/10 text-gray-400 hover:border-purple-500/50 hover:text-white'
                                                    }`}
                                            >
                                                <span>{getCategoryEmoji(cat)}</span> {cat}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Menu Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                                        {menuItems.filter(item => {
                                            if (menuCategory !== 'all' && item.category !== menuCategory) return false;
                                            if (menuSearchQuery) {
                                                const query = menuSearchQuery.toLowerCase();
                                                return item.name.toLowerCase().includes(query) || (item.category || '').toLowerCase().includes(query);
                                            }
                                            return true;
                                        }).map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => addToCart(item)}
                                                className="group relative bg-[#0F0A1F] hover:bg-[#1A1A2E] border border-white/5 hover:border-purple-500/50 rounded-xl overflow-hidden text-left transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col"
                                            >
                                                {/* Image */}
                                                <div className="h-28 overflow-hidden relative">
                                                    {item.image ? (
                                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-white/5 text-3xl">
                                                            {getCategoryEmoji(item.category)}
                                                        </div>
                                                    )}
                                                    {/* Qty Badge */}
                                                    {cart.find(c => c.id === item.id) && (
                                                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center shadow-lg border-2 border-[#0F0A1F]">
                                                            {cart.find(c => c.id === item.id).qty}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="p-3 flex-1 flex flex-col justify-between">
                                                    <div>
                                                        <h5 className="text-sm font-bold text-gray-200 line-clamp-1 group-hover:text-purple-300 transition-colors">{item.name}</h5>
                                                        <p className="text-[10px] text-gray-500">{item.category}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className="text-sm font-bold text-green-400">{formatCurrency(item.price)}</span>
                                                        <span className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">+</span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Cart Preview (Mini) */}
                                    {cart.length > 0 && (
                                        <div className="mt-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                            <div className="flex justify-between items-center mb-2">
                                                <h5 className="text-xs font-bold text-purple-300">🛒 Keranjang ({cart.length} Item)</h5>
                                                <span className="text-xs font-bold text-green-400">{formatCurrency(cartTotal)}</span>
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                                                {cart.map(item => (
                                                    <div key={item.id} className="flex-shrink-0 bg-[#0F0A1F] rounded-lg p-2 border border-white/10 flex items-center gap-2 pr-3">
                                                        <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-xs">
                                                            {getCategoryEmoji(item.category)}
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-gray-300 truncate max-w-[80px]">{item.name}</p>
                                                            <p className="text-[10px] text-gray-500">{item.qty}x</p>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                                                            className="text-red-400 hover:text-red-300 ml-1"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Section 3: Payment & Notes */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Metode Pembayaran</label>
                                        <CustomSelect
                                            value={paymentMethod}
                                            onChange={setPaymentMethod}
                                            options={[
                                                { value: 'cash', label: 'Tunai', icon: '💵' },
                                                { value: 'qris', label: 'QRIS', icon: '📱' },
                                                { value: 'bank', label: 'Transfer Bank', icon: '🏦' },
                                                { value: 'ewallet', label: 'E-Wallet', icon: '📲' }
                                            ]}
                                            className="h-[46px]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Catatan</label>
                                        <input
                                            type="text"
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl bg-black/20 border border-purple-500/20 focus:border-purple-500 text-white placeholder-gray-600 outline-none text-sm h-[46px]"
                                            placeholder="Contoh: Jangan terlalu manis..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 border-t border-white/10 bg-[#151525] shrink-0 flex items-center justify-between z-10">
                            <div>
                                <p className="text-xs text-gray-500">Total Tagihan</p>
                                <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                                    {formatCurrency(cartTotal)}
                                </p>
                            </div>
                            <button
                                onClick={createOrder}
                                disabled={submitting || cart.length === 0}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:grayscale transition-all transform active:scale-95 flex items-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Proses...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🚀 Buat Pesanan</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Merge Button */}
            {selectedForMerge.length >= 2 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                    <button
                        onClick={() => setShowMergeModal(true)}
                        className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold shadow-2xl hover:from-purple-600 hover:to-pink-600 flex items-center gap-2"
                    >
                        🔗 GABUNG ({selectedForMerge.length}) TAGIHAN
                    </button>
                </div>
            )}

            {/* Merge Bill Modal */}
            {showMergeModal && (
                <div className="modal-overlay">
                    <div className="glass rounded-2xl p-6 w-full max-w-md animate-scale-up">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">🔗 Gabungkan Tagihan</h3>
                            <button
                                onClick={() => setShowMergeModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3 max-h-64 overflow-auto mb-4">
                            {selectedOrdersForMerge.map(order => (
                                <div key={order.id} className="bg-white/5 rounded-lg p-3 border border-purple-500/20">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="font-medium">{order.customerName || 'Pelanggan'}</span>
                                            <span className="text-xs text-gray-400 ml-2">
                                                {order.orderType === 'take_away' ? '🛍️' : `🍽️ Meja ${order.tableNumber}`}
                                            </span>
                                        </div>
                                        <span className="font-bold text-green-400">{formatCurrency(order.total)}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">{order.items?.length || 0} item(s) • {order.time}</p>
                                </div>
                            ))}
                        </div>

                        <div className="bg-purple-500/20 rounded-xl p-4 mb-4 border border-purple-500/30">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-300">Total Gabungan</span>
                                <span className="text-2xl font-bold text-green-400">{formatCurrency(mergePreviewTotal)}</span>
                            </div>
                        </div>

                        <div className="bg-yellow-500/10 rounded-lg p-3 mb-4 border border-yellow-500/30">
                            <p className="text-xs text-yellow-400">
                                ⚠️ Pesanan lainnya akan diarsipkan dan digabung ke pesanan pertama
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => {
                                    setShowMergeModal(false);
                                    setSelectedForMerge([]);
                                }}
                                className="py-3 rounded-xl bg-gray-500/20 text-gray-300 font-medium hover:bg-gray-500/30"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleMergeBill}
                                className="py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-bold hover:from-purple-600 hover:to-pink-600"
                            >
                                ✅ Konfirmasi Gabung
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>

    );
}

export default Kasir;
