import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ordersAPI } from '../../services/api';

function PesananSaya() {
    const { tableId } = useOutletContext();
    const [orders, setOrders] = useState([]);
    // activeOrderId from localStorage
    const [activeOrderId, setActiveOrderId] = useState(localStorage.getItem('currentOrderId'));
    const [activeOrder, setActiveOrder] = useState(null); // Full active order object
    const [loading, setLoading] = useState(true);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);

    useEffect(() => {
        // Initial Load & Cleanup
        cleanUpOldOrders();
        fetchData();

        const interval = setInterval(fetchData, 15000); // Poll every 15s to sync status
        return () => clearInterval(interval);
    }, [activeOrderId, tableId]);

    // 1. Cleanup Function (24-Hour Rule)
    const cleanUpOldOrders = () => {
        try {
            const raw = localStorage.getItem('myOrderHistory');
            if (!raw) return;

            const history = JSON.parse(raw);
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;

            const validOrders = history.filter(order => {
                // Determine time. Priority: createdAt (ISO) > timestamp (Number) > Current Time (fallback to keep)
                const timeStr = order.createdAt || order.timestamp;
                if (!timeStr) return true; // Keep if no date (safety)

                const orderTime = new Date(timeStr).getTime();
                if (isNaN(orderTime)) return true; // Keep if invalid date

                return (now - orderTime) < oneDay;
            });

            // Only update if changes were made to avoid unnecessary writes
            if (validOrders.length !== history.length) {
                console.log(`🧹 Cleaned up ${history.length - validOrders.length} old orders`);
                localStorage.setItem('myOrderHistory', JSON.stringify(validOrders));
            }
        } catch (err) {
            console.error("Cleanup error:", err);
        }
    };

    // 2. Fetch Data (Sync Local History with API)
    const fetchData = async () => {
        try {
            // A. Handle Active Order (Existing Logic)
            if (activeOrderId) {
                try {
                    const res = await ordersAPI.getById(activeOrderId);
                    if (res.data) setActiveOrder(res.data);
                } catch (err) {
                    if (err.response && err.response.status === 404) {
                        localStorage.removeItem('currentOrderId');
                        setActiveOrderId(null);
                        setActiveOrder(null);
                    }
                }
            }

            // B. Handle History (Local + Sync)
            const rawHistory = localStorage.getItem('myOrderHistory');
            let localOrders = rawHistory ? JSON.parse(rawHistory) : [];

            if (localOrders.length > 0) {
                // Sync Status: Fetch latest status for these orders
                const res = await ordersAPI.getToday();
                const serverOrders = Array.isArray(res.data) ? res.data : [];

                // Update local orders with server data if found
                const updatedOrders = localOrders.map(local => {
                    const serverMatch = serverOrders.find(s => s.id === local.id);
                    return serverMatch ? { ...local, ...serverMatch } : local;
                });

                // NOTE: Removed tableId filter. 
                // Since this uses localStorage ('myOrderHistory'), it is personal to the device.
                // We should show ALL personal orders regardless of which table they are currently at.
                // This prevents history from determining "disappearing" when switching context.

                const filtered = updatedOrders;

                // Sort by newest
                filtered.sort((a, b) => {
                    const dateA = new Date(a.createdAt || a.timestamp || 0);
                    const dateB = new Date(b.createdAt || b.timestamp || 0);
                    return dateB - dateA;
                });

                setOrders(filtered);
            } else {
                setOrders([]);
            }

        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    };

    // Handle Delete History (Manual)
    const handleDeleteHistory = (orderId) => {
        if (window.confirm("Hapus riwayat pesanan ini? Bukti pesanan akan hilang permanen.")) {
            const raw = localStorage.getItem('myOrderHistory');
            if (raw) {
                const history = JSON.parse(raw);
                const newHistory = history.filter(o => o.id !== orderId);
                localStorage.setItem('myOrderHistory', JSON.stringify(newHistory));
                // Update State
                setOrders(prev => prev.filter(o => o.id !== orderId));
            }
        }
    };

    const clearActiveSession = () => {
        localStorage.removeItem('currentOrderId');
        setActiveOrderId(null);
        setActiveOrder(null);
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Updated: 3 steps only (Diterima - Diproses - Selesai)
    const getStatusStep = (status) => {
        switch (status) {
            case 'new': return 1;
            case 'pending': return 1;
            case 'process': return 2;
            case 'preparing': return 2;
            case 'served': return 3;
            case 'ready': return 3;
            case 'done': return 3;
            case 'completed': return 3;
            default: return 0;
        }
    };

    // Check if order is take_away
    const isTakeAway = (order) => {
        return order?.orderType === 'take_away' || !order?.tableNumber;
    };

    // Get display order number (last 6 chars of ID)
    const getOrderNumber = (order) => {
        return order?.id?.slice(-6) || '------';
    };

    // Handle Cancel Order
    const handleCancelOrder = async () => {
        if (!activeOrder) return;
        setLoading(true);
        try {
            await ordersAPI.cancel(activeOrder.id);
            // Update local state immediately
            setActiveOrder(prev => ({ ...prev, status: 'cancelled' }));
            // Also update history list
            setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, status: 'cancelled' } : o));
            setShowCancelModal(false);
        } catch (err) {
            console.error("Failed to cancel order", err);
            alert("Gagal membatalkan pesanan. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    const renderActiveOrder = () => {
        if (!activeOrder) return null;

        const currentStep = getStatusStep(activeOrder.status);
        // Updated: Only 3 steps
        const steps = [
            { label: 'Diterima', icon: '📝', step: 1 },
            { label: 'Diproses', icon: '👨‍🍳', step: 2 },
            { label: 'Selesai', icon: '✅', step: 3 },
        ];

        const takeAway = isTakeAway(activeOrder);

        return (
            <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-2xl p-6 border border-purple-500/50 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20 text-9xl transform translate-x-1/4 -translate-y-1/4">
                    {steps[currentStep - 1]?.icon || '📋'}
                </div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                                Pesanan Aktif
                            </h3>
                            <div className="flex flex-col">
                                <p className="text-purple-300">#{getOrderNumber(activeOrder)} • {activeOrder.tableNumber ? `Meja ${activeOrder.tableNumber}` : 'Take Away'}</p>
                                <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1">
                                    📅 {formatDateTime(activeOrder.createdAt || activeOrder.timestamp)}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-400">Total</p>
                            <p className="text-xl font-bold text-green-400">{formatCurrency(activeOrder.total)}</p>
                        </div>
                    </div>

                    {/* Progress Bar - 3 Steps */}
                    <div className="mb-8">
                        <div className="flex justify-between relative">
                            {/* Line Base */}
                            <div className="absolute top-1/2 left-0 w-full h-1 bg-white/10 -z-0"></div>
                            {/* Line Active */}
                            <div
                                className="absolute top-1/2 left-0 h-1 bg-purple-500 -z-0 transition-all duration-1000"
                                style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                            ></div>

                            {steps.map((s, idx) => {
                                const isActive = currentStep >= s.step;
                                const isCurrent = currentStep === s.step;
                                return (
                                    <div key={idx} className="relative z-10 flex flex-col items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${isActive ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-gray-800 text-gray-500 border border-white/10'
                                            } ${isCurrent ? 'scale-125 ring-2 ring-purple-400 ring-offset-2 ring-offset-[#1E1B4B]' : ''}`}>
                                            {isActive ? '✓' : idx + 1}
                                        </div>
                                        <span className={`text-xs font-medium transition-colors ${isActive ? 'text-white' : 'text-gray-500'}`}>
                                            {s.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Order Details Preview with Thumbnails */}
                    <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm border border-white/5">
                        <p className="text-sm text-gray-400 mb-2">Item Pesanan:</p>
                        <ul className="space-y-2">
                            {(activeOrder.items || []).slice(0, 3).map((item, idx) => (
                                <li key={idx} className="flex items-center gap-3">
                                    {/* Thumbnail */}
                                    <div className="w-12 h-12 rounded-md bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex-shrink-0 overflow-hidden">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-lg">☕</div>
                                        )}
                                    </div>
                                    {/* Name & Qty */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.name}</p>
                                        <p className="text-xs text-gray-400">{item.qty}x {item.note && <span className="text-purple-400">• {item.note}</span>}</p>
                                    </div>
                                    {/* Price */}
                                    <span className="text-sm text-gray-400 flex-shrink-0">{formatCurrency(item.subtotal || item.price * item.qty)}</span>
                                </li>
                            ))}
                            {(activeOrder.items?.length > 3) && (
                                <li className="text-xs text-gray-500 pt-1 pl-15">+{activeOrder.items.length - 3} item lainnya...</li>
                            )}
                        </ul>
                    </div>

                    {/* Actions - Dynamic Button */}
                    <div className="mt-6 flex gap-3">
                        {/* Dynamic Action Button based on orderType */}
                        {takeAway ? (
                            <button
                                onClick={() => setShowTicketModal(true)}
                                className="flex-1 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all flex items-center justify-center gap-2 font-bold shadow-lg shadow-purple-500/25"
                            >
                                🎫 Lihat Tiket / QR
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowDetailModal(true)}
                                className="flex-1 py-3 rounded-lg bg-transparent border border-purple-500/50 hover:bg-purple-500/10 transition-all flex items-center justify-center gap-2 text-purple-300"
                            >
                                📄 Lihat Rincian
                            </button>
                        )}

                        {(activeOrder.status === 'done' || activeOrder.status === 'completed' || activeOrder.status === 'cancelled') && (
                            <button
                                onClick={clearActiveSession}
                                className="flex-1 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors shadow-lg font-bold"
                            >
                                ✨ Pesan Lagi
                            </button>
                        )}
                    </div>

                    {/* SAFE CANCEL LOGIC */}
                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-center">
                        {activeOrder.status === 'new' && activeOrder.paymentStatus === 'unpaid' ? (
                            <button
                                onClick={() => setShowCancelModal(true)}
                                className="text-red-500/70 text-sm hover:text-red-400 hover:bg-red-500/10 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
                            >
                                ⛔ Batalkan Pesanan
                            </button>
                        ) : (activeOrder.paymentStatus === 'paid' && activeOrder.status !== 'cancelled' && activeOrder.status !== 'done' && activeOrder.status !== 'completed' ? (
                            <p className="text-xs text-center text-gray-500 flex items-center gap-1">
                                ℹ️ Pesanan sudah dibayar. Hubungi kasir jika ingin membatalkan.
                            </p>
                        ) : null)}
                    </div>
                </div>
            </div>
        );
    };

    // Modal: Detail Pesanan (for Dine In)
    const renderDetailModal = () => {
        if (!showDetailModal || !activeOrder) return null;

        const subtotal = activeOrder.subtotal || activeOrder.total;
        const tax = activeOrder.tax || 0;
        const total = activeOrder.total || 0;

        return createPortal(
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDetailModal(false)}>
                <div
                    className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden border border-purple-500/30 shadow-2xl animate-scale-up"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold">📄 Detail Pesanan</h3>
                            <p className="text-sm text-gray-400">#{getOrderNumber(activeOrder)} • Meja {activeOrder.tableNumber}</p>
                        </div>
                        <button onClick={() => setShowDetailModal(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                            ✕
                        </button>
                    </div>

                    {/* Items List */}
                    <div className="p-4 overflow-y-auto max-h-[50vh] space-y-3">
                        {(activeOrder.items || []).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                                {/* Thumbnail */}
                                <div className="w-12 h-12 rounded-md bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex-shrink-0 overflow-hidden">
                                    {item.image ? (
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-lg">☕</div>
                                    )}
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{item.name}</p>
                                    <p className="text-xs text-gray-400">{item.qty}x @ {formatCurrency(item.price)}</p>
                                    {item.note && (
                                        <p className="text-xs text-purple-400 mt-1">📝 {item.note}</p>
                                    )}
                                </div>
                                {/* Subtotal */}
                                <span className="font-bold text-sm">{formatCurrency(item.subtotal || item.price * item.qty)}</span>
                            </div>
                        ))}
                    </div>

                    {/* Summary */}
                    <div className="p-4 border-t border-white/10 space-y-2 bg-black/20">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {tax > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Pajak</span>
                                <span>{formatCurrency(tax)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10">
                            <span>Total</span>
                            <span className="text-green-400">{formatCurrency(total)}</span>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    // Modal: Tiket Pengambilan (for Take Away)
    const renderTicketModal = () => {
        if (!showTicketModal || !activeOrder) return null;

        const orderNumber = getOrderNumber(activeOrder);
        const totalItems = (activeOrder.items || []).reduce((sum, item) => sum + item.qty, 0);

        return createPortal(
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowTicketModal(false)}>
                <div
                    className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl w-full max-w-sm overflow-hidden border border-purple-500/30 shadow-2xl animate-scale-up"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-600/20 to-blue-600/20">
                        <h3 className="text-lg font-bold">🎫 Tiket Pengambilan</h3>
                        <button onClick={() => setShowTicketModal(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                            ✕
                        </button>
                    </div>

                    {/* Ticket Content */}
                    <div className="p-6 text-center space-y-6">
                        {/* Order Number - VERY LARGE */}
                        <div className="space-y-2">
                            <p className="text-sm text-gray-400 uppercase tracking-widest">Nomor Pesanan</p>
                            <p className="text-5xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent tracking-wider">
                                #{orderNumber}
                            </p>
                        </div>

                        {/* Customer Info */}
                        <div className="bg-white/5 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Nama Pemesan</span>
                                <span className="font-medium">{activeOrder.customerName || '-'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Total Item</span>
                                <span className="font-medium">{totalItems} item</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Total Bayar</span>
                                <span className="font-bold text-green-400">{formatCurrency(activeOrder.total)}</span>
                            </div>
                        </div>

                        {/* QR Code */}
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-3 bg-white rounded-xl">
                                <QRCodeSVG
                                    value={activeOrder.id || 'ORDER'}
                                    size={120}
                                    level="M"
                                />
                            </div>
                            <p className="text-xs text-gray-500">Scan untuk verifikasi</p>
                        </div>

                        {/* Instructions */}
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                            <p className="text-sm text-yellow-400">
                                📢 Tunjukkan layar ini ke Kasir untuk mengambil pesanan Anda
                            </p>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            new: { label: 'Menunggu', color: 'bg-yellow-500/20 text-yellow-400', icon: '⏳' },
            pending: { label: 'Menunggu', color: 'bg-yellow-500/20 text-yellow-400', icon: '⏳' },
            process: { label: 'Diproses', color: 'bg-blue-500/20 text-blue-400', icon: '👨‍🍳' },
            done: { label: 'Selesai', color: 'bg-green-500/20 text-green-400', icon: '✅' },
            cancelled: { label: 'Dibatalkan', color: 'bg-red-500/20 text-red-400', icon: '❌' }
        };
        const info = statusMap[status] || statusMap.pending;
        return (
            <span className={`px-2 py-1 rounded-full text-xs ${info.color}`}>
                {info.icon} {info.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="px-4 py-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold">📋 Pesanan Saya</h2>
            </div>

            {/* Active Order Section */}
            {renderActiveOrder()}

            {/* Modals */}
            {renderDetailModal()}
            {renderTicketModal()}

            {renderDetailModal()}
            {renderTicketModal()}

            {/* Cancel Confirmation Modal */}
            {showCancelModal && createPortal(
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCancelModal(false)}>
                    <div
                        className="bg-[#1a1a2e] rounded-2xl w-full max-w-sm border border-red-500/30 shadow-2xl animate-scale-up p-5 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Batalkan Pesanan?</h3>
                        <p className="text-sm text-gray-400 mb-6">
                            Yakin ingin membatalkan pesanan ini? <br />
                            Pesanan yang dibatalkan <span className="text-red-400 font-bold">tidak dapat dikembalikan</span>.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowCancelModal(false)}
                                className="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-colors"
                            >
                                Kembali
                            </button>
                            <button
                                onClick={handleCancelOrder}
                                className="py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30 font-bold transition-all shadow-lg shadow-red-500/10"
                            >
                                Ya, Batalkan
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* History List */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-400 text-sm uppercase tracking-wider">
                    Riwayat
                </h3>
                <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                    ♻️ Reset dalam 24 Jam
                </span>
            </div>

            {orders.length === 0 ? (
                <div className="text-center py-8 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-gray-500 text-sm">Belum ada riwayat pesanan.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {orders.map(order => (
                        <div key={order.id} className={`bg-white/5 rounded-xl border overflow-hidden ${order.id === activeOrderId ? 'border-purple-500/50 ring-1 ring-purple-500/20' : 'border-white/10'}`}>
                            {/* Header */}
                            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-black/20">
                                <div className="flex items-center gap-3">
                                    <div>
                                        <p className="text-xs text-gray-400">#{order.id?.slice(-6)}</p>
                                        <p className="text-xs text-gray-500">{formatDateTime(order.createdAt || order.timestamp)}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {getStatusBadge(order.status)}

                                    {/* DELETE BUTTON (Only for Done/Cancelled) */}
                                    {(order.status === 'done' || order.status === 'cancelled' || order.status === 'completed') && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteHistory(order.id);
                                            }}
                                            className="w-6 h-6 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                                            title="Hapus Riwayat"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Items with Thumbnails */}
                            <div className="p-3">
                                <div className="space-y-2">
                                    {(order.items || []).slice(0, 2).map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            {/* Thumbnail */}
                                            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex-shrink-0 overflow-hidden">
                                                {item.image ? (
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-sm">☕</div>
                                                )}
                                            </div>
                                            {/* Name & Qty */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-gray-300 truncate">{item.name}</p>
                                                <p className="text-xs text-gray-500">{item.qty}x</p>
                                            </div>
                                            {/* Price */}
                                            <span className="text-sm text-gray-400">{formatCurrency(item.subtotal || item.price * item.qty)}</span>
                                        </div>
                                    ))}
                                    {(order.items || []).length > 2 && (
                                        <p className="text-gray-500 text-xs pl-13">+{order.items.length - 2} item lainnya</p>
                                    )}
                                </div>
                                <div className="mt-2 pt-2 border-t border-white/10 flex justify-between font-bold text-sm">
                                    <span>Total</span>
                                    <span className="text-green-400">{formatCurrency(order.total)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default PesananSaya;
