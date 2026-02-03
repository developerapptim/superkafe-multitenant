import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { createPortal } from 'react-dom';
import CustomSelect from '../../components/CustomSelect';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import api, { ordersAPI } from '../../services/api';
import { useCart } from '../../context/CartContext';
import Struk from '../../components/Struk';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

// Fetcher for SWR
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

function Keranjang() {
    const navigate = useNavigate();
    const { tableId, settings, isTableLocked, clearScannedTable } = useOutletContext();
    const { cart, updateQty, updateNote, removeFromCart, clearCart, cartTotal } = useCart();

    // Fetch tables from database
    const { data: tablesData } = useSWR('/tables', fetcher);
    const tables = tablesData || [];

    const [customerName, setCustomerName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [submittedOrder, setSubmittedOrder] = useState(null);

    // Payment State
    const [paymentMethod, setPaymentMethod] = useState('cash'); // cash, qris, bank, ewallet
    const [paymentProof, setPaymentProof] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    // Smart Phone Matching State
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [existingOrders, setExistingOrders] = useState([]);
    const [pendingOrderData, setPendingOrderData] = useState(null);

    // Order Type State - Auto-set based on scanned table
    const [orderType, setOrderType] = useState(() => {
        // If table was scanned, default to dine_in
        if (isTableLocked && tableId) return 'dine_in';
        return 'dine_in';
    });
    const [tableNumber, setTableNumber] = useState(tableId || '');

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPaymentProof(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCheckout = async () => {
        toast.dismiss(); // Clear previous toasts
        console.log('Checkout Triggered:', { paymentMethod, hasProof: !!paymentProof });

        if (cart.length === 0) {
            toast.error('Keranjang kosong!');
            return;
        }

        // Validate Identity
        if (!customerName.trim() || !phone.trim()) {
            toast.error('Mohon lengkapi Nama dan Nomor WhatsApp!');
            return;
        }

        // Validate Non-Cash Payment
        if (paymentMethod !== 'cash' && !paymentProof) {
            console.warn('Validation Failed: Payment proof missing for', paymentMethod);
            toast.error('Bukti pembayaran wajib diupload untuk metode Transfer/QRIS/E-Wallet');
            return;
        }
        // Validate Table Number for Dine In
        if (orderType === 'dine_in' && !tableNumber.trim()) {
            toast.error('Mohon masukkan Nomor Meja untuk Makan di Tempat!');
            return;
        }

        try {
            setLoading(true);

            // Smart Phone Matching: Check for existing orders with this phone
            const formattedPhone = formatPhoneNumber(phone.trim());
            if (formattedPhone) {
                try {
                    const checkRes = await ordersAPI.checkPhone(formattedPhone);
                    if (checkRes.data.hasActiveOrder) {
                        // Found existing order, show merge modal
                        setExistingOrders(checkRes.data.orders);
                        setPendingOrderData({
                            tableNumber: orderType === 'dine_in' ? tableNumber : null,
                            orderType,
                            customerName,
                            phone,
                            paymentMethod,
                            paymentProof
                        });
                        setShowMergeModal(true);
                        setLoading(false);
                        return; // Wait for user to choose
                    }
                } catch (err) {
                    console.log('Phone check failed, proceeding with new order');
                }
            }

            // Proceed with new order
            await createNewOrder();

        } catch (err) {
            console.error('Error creating order:', err);
            const errMsg = err.response?.data?.error || 'Gagal membuat pesanan.';
            toast.error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    // Create a new order (called from checkout or after user confirms new order)
    const createNewOrder = async () => {
        const orderDataObj = {
            id: `ORD-${Date.now()}`,
            tableNumber: orderType === 'dine_in' ? tableNumber : null,
            orderType: orderType,
            customerName: customerName,
            customerPhone: formatPhoneNumber(phone),
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                qty: item.qty,
                note: item.note || '',
                subtotal: item.price * item.qty
            })),
            subtotal: cartTotal,
            total: cartTotal,
            paymentMethod: paymentMethod,
            source: 'customer-app',
            createdAt: new Date().toISOString(),
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        const formData = new FormData();
        formData.append('orderData', JSON.stringify(orderDataObj));

        if (paymentProof) {
            formData.append('paymentProof', paymentProof);
        }

        const res = await ordersAPI.create(formData);
        const savedOrder = res.data;

        setSubmittedOrder(savedOrder);
        setOrderSuccess(true);
        toast.success('Pesanan berhasil dibuat!');
        localStorage.setItem('currentOrderId', savedOrder.id);
        clearCart();
    };

    // Handle merge: append items to existing order
    const handleMergeOrder = async () => {
        if (existingOrders.length === 0) return;

        const toastId = toast.loading('Menggabungkan pesanan...');
        try {
            const primaryOrderId = existingOrders[0].id;
            const itemsToAppend = cart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                qty: item.qty,
                note: item.note || ''
            }));

            await ordersAPI.appendItems(primaryOrderId, itemsToAppend);

            toast.success('Pesanan berhasil digabungkan!', { id: toastId });
            setShowMergeModal(false);
            clearCart();

            // Navigate to order status
            navigate('/customer/pesanan');
        } catch (err) {
            console.error('Error merging order:', err);
            toast.error(err.response?.data?.error || 'Gagal menggabungkan pesanan', { id: toastId });
        }
    };

    // Handle new order after seeing merge option
    const handleNewOrderAfterCheck = async () => {
        setShowMergeModal(false);
        setLoading(true);
        try {
            await createNewOrder();
        } catch (err) {
            console.error('Error creating order:', err);
            toast.error(err.response?.data?.error || 'Gagal membuat pesanan');
        } finally {
            setLoading(false);
        }
    };


    const handleDownloadPDF = async () => {
        const element = document.getElementById('printable-receipt');
        if (!element) return;

        const toastId = toast.loading('Memproses PDF...');

        try {
            // Use html-to-image for better support of modern CSS (like oklch)
            const dataUrl = await toPng(element, {
                cacheBust: true,
                pixelRatio: 3, // High resolution
                backgroundColor: '#ffffff'
            });

            // Calculate dimensions based on element size
            const w = element.offsetWidth;
            const h = element.offsetHeight;

            // Standard thermal receipt width ~80mm
            const pdfWidth = 80;
            const pdfHeight = (h * pdfWidth) / w;

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
            });

            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Struk-${submittedOrder.id}.pdf`);

            toast.success('Struk berhasil didownload!', { id: toastId });
        } catch (err) {
            console.error('PDF Error:', err);
            toast.error('Gagal membuat PDF. Coba refresh halaman.', { id: toastId });
        }
    };

    // Order Success View
    if (orderSuccess && submittedOrder) {
        return (
            <div className="px-4 py-8 text-center space-y-6">
                <div className="bg-white/5 rounded-2xl p-6 border border-green-500/30 no-print">
                    <div className="text-6xl mb-4">✅</div>
                    <h2 className="text-2xl font-bold text-green-400 mb-2">Pesanan Berhasil!</h2>
                    <p className="text-gray-400">Pesanan akan segera diproses.</p>
                </div>

                {/* Receipt Preview */}
                <div className="flex justify-center">
                    <div
                        id="printable-receipt"
                        className="bg-white rounded-lg overflow-hidden shadow-2xl transform scale-95 origin-top"
                    >
                        <Struk order={submittedOrder} settings={settings} />
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3 no-print">
                    <button
                        onClick={handleDownloadPDF}
                        className="w-full py-3 rounded-xl bg-purple-600 font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/30"
                    >
                        📥 Download Struk (PDF)
                    </button>

                    <button
                        onClick={() => navigate(`/customer${tableId ? `?meja=${tableId}` : ''}`)}
                        className="w-full py-3 rounded-xl bg-white/10 font-bold hover:bg-white/20 transition-colors"
                    >
                        🏠 Menu Utama
                    </button>

                    <button
                        onClick={() => navigate('/customer/pesanan')}
                        className="w-full py-3 rounded-xl border border-blue-500/30 text-blue-400 font-bold hover:bg-blue-500/10 transition-colors"
                    >
                        📋 Lihat Status Pesanan
                    </button>
                </div>

                {/* Hide non-printable elements in print mode via CSS */}
                <style>{`
                    @media print {
                        .no-print, nav, header {
                            display: none !important;
                        }
                    }
                `}</style>
            </div>
        );
    }

    // Empty Cart
    if (cart.length === 0) {
        return (
            <div className="px-4 py-8 text-center">
                <div className="text-6xl mb-4">🛒</div>
                <h2 className="text-xl font-bold mb-2">Keranjang Kosong</h2>
                <p className="text-gray-400 mb-6">Yuk pilih menu favoritmu!</p>
                <button
                    onClick={() => navigate(`/customer${tableId ? `?meja=${tableId}` : ''}`)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 font-medium"
                >
                    Lihat Menu
                </button>
            </div>
        );
    }

    return (
        <div className="px-4 py-4 space-y-4">
            <h2 className="text-xl font-bold">🛒 Keranjang</h2>

            {/* Order Type Selection */}
            <div className="bg-white/5 rounded-xl p-4 border border-purple-500/20">
                <h3 className="font-bold text-sm text-purple-300 mb-3">Tipe Pesanan</h3>

                {/* Locked Table Badge */}
                {isTableLocked && tableId && (
                    <div className="mb-3 p-3 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📍</span>
                            <div>
                                <p className="text-green-300 font-bold text-sm">Anda duduk di Meja {tableId}</p>
                                <p className="text-green-400/70 text-xs">Terdeteksi dari QR Code</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                clearScannedTable();
                                setOrderType('take_away');
                                setTableNumber('');
                            }}
                            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-white/10"
                        >
                            Ganti
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => {
                            setOrderType('dine_in');
                            if (isTableLocked && tableId) setTableNumber(tableId);
                        }}
                        disabled={isTableLocked && tableId}
                        className={`py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${orderType === 'dine_in'
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-purple-500/50'
                            } ${isTableLocked && tableId ? 'opacity-80' : ''}`}
                    >
                        <span className="text-xl">🍽️</span>
                        <span className="font-medium text-sm">Makan di Tempat</span>
                    </button>
                    <button
                        onClick={() => {
                            if (isTableLocked && tableId) {
                                toast('Anda scan QR Meja. Klik "Ganti" untuk pilih Bungkus.', { icon: 'ℹ️' });
                                return;
                            }
                            setOrderType('take_away');
                        }}
                        className={`py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${orderType === 'take_away'
                            ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-orange-500/50'
                            }`}
                    >
                        <span className="text-xl">🛍️</span>
                        <span className="font-medium text-sm">Bungkus</span>
                    </button>
                </div>

                {/* Table Number Select - Only for Dine In and NOT locked */}
                {orderType === 'dine_in' && !isTableLocked && (
                    <div className="mt-4">
                        <label className="block text-xs text-gray-400 mb-1">Pilih Meja <span className="text-red-400">*</span></label>
                        <CustomSelect
                            value={tableNumber}
                            options={tables.map(table => ({
                                value: String(table.number || table.id),
                                label: `Meja ${table.number || table.id} ${table.area ? `(${table.area})` : ''} ${table.status === 'occupied' ? '- Terisi' : ''}`
                            }))}
                            onChange={(val) => setTableNumber(val)}
                            placeholder="-- Pilih Meja --"
                            className="bg-black/30"
                        />
                        {tables.length === 0 && (
                            <p className="text-xs text-yellow-400 mt-1">⚠️ Belum ada meja tersedia</p>
                        )}
                    </div>
                )}
            </div>

            {/* Cart Items */}
            <div className="space-y-3">
                {cart.map(item => (
                    <div key={item.id} className="bg-white/5 rounded-xl p-3 border border-purple-500/20 flex gap-3">
                        {/* Image */}
                        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex-shrink-0 overflow-hidden">
                            {item.image ? (
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl">☕</div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                            <h3 className="font-medium text-sm">{item.name}</h3>
                            <p className="text-purple-400 text-sm">{formatCurrency(item.price)}</p>

                            <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2 bg-white/10 rounded-lg">
                                    <button
                                        onClick={() => updateQty(item.id, item.qty - 1)}
                                        className="w-8 h-8 flex items-center justify-center text-red-400"
                                    >
                                        -
                                    </button>
                                    <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                                    <button
                                        onClick={() => updateQty(item.id, item.qty + 1)}
                                        className="w-8 h-8 flex items-center justify-center text-green-400"
                                    >
                                        +
                                    </button>
                                </div>
                                <p className="font-bold text-sm">{formatCurrency(item.price * item.qty)}</p>
                            </div>

                            {/* Per-Item Note Input */}
                            <input
                                type="text"
                                placeholder="Catatan item (optional)"
                                value={item.note || ''}
                                onChange={(e) => updateNote(item.id, e.target.value)}
                                className="w-full mt-2 px-3 py-1.5 rounded-lg bg-black/20 border border-white/10 text-xs text-white placeholder-gray-500 focus:border-purple-500/50 outline-none"
                            />
                        </div>

                        {/* Remove */}
                        <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-400 text-sm self-start"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            {/* Customer Info */}
            <div className="bg-white/5 rounded-xl p-4 border border-purple-500/20 space-y-3">
                <h3 className="font-bold text-sm text-purple-300 mb-2">Identitas Pemesan</h3>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Nama Pemesan <span className="text-red-400">*</span></label>
                    <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                        placeholder="Masukkan nama Anda"
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Nomor WhatsApp/HP <span className="text-red-400">*</span></label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                        placeholder="Contoh: 08123456789"
                    />
                    <p className="text-xs text-gray-500 mt-1">Nomor ini digunakan untuk konfirmasi pesanan & poin loyalty.</p>
                </div>
            </div>

            {/* Payment Method Selection */}
            <div className="bg-white/5 rounded-xl p-4 border border-purple-500/20">
                <h3 className="font-bold mb-3">💳 Metode Pembayaran</h3>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setPaymentMethod('cash')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'cash'
                            ? 'bg-purple-600 border-purple-500 shadow-lg scale-[1.02]'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                    >
                        <span className="text-2xl">💵</span>
                        <span className="text-xs font-bold">Tunai</span>
                    </button>

                    <button
                        onClick={() => setPaymentMethod('qris')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'qris'
                            ? 'bg-purple-600 border-purple-500 shadow-lg scale-[1.02]'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                    >
                        <span className="text-2xl">📱</span>
                        <span className="text-xs font-bold">QRIS</span>
                    </button>

                    <button
                        onClick={() => setPaymentMethod('bank')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'bank'
                            ? 'bg-purple-600 border-purple-500 shadow-lg scale-[1.02]'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                    >
                        <span className="text-2xl">🏦</span>
                        <span className="text-xs font-bold">Transfer</span>
                    </button>

                    <button
                        onClick={() => setPaymentMethod('ewallet')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'ewallet'
                            ? 'bg-purple-600 border-purple-500 shadow-lg scale-[1.02]'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                    >
                        <span className="text-2xl">👛</span>
                        <span className="text-xs font-bold">{settings.ewalletType || 'E-Wallet'}</span>
                    </button>
                </div>

                {/* Info & Upload for Non-Cash */}
                {paymentMethod !== 'cash' && (
                    <div className="mt-4 p-4 bg-black/20 rounded-xl border border-white/10 space-y-4">
                        <div className="text-sm space-y-1">
                            {paymentMethod === 'qris' && (
                                settings.qrisImage ? (
                                    <div className="flex flex-col items-center mb-4">
                                        <p className="mb-2 text-gray-400">Scan QRIS di bawah ini:</p>
                                        <div className="p-2 bg-white rounded-xl">
                                            <img src={settings.qrisImage} alt="QRIS" className="w-48 h-48 object-contain" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center p-4 bg-white/5 rounded-xl text-yellow-500/80 mb-4 border border-yellow-500/20">
                                        ⚠️ QRIS belum dikonfigurasi oleh admin
                                    </div>
                                )
                            )}
                            {paymentMethod === 'bank' && (
                                (settings.bankName || settings.bankAccount) ? (
                                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                                        <p className="text-gray-400 text-xs">Silakan transfer ke:</p>
                                        <p className="font-bold text-lg text-purple-300">{settings.bankName || '-'}</p>
                                        <p className="font-mono text-xl">{settings.bankAccount || '-'}</p>
                                        <p className="text-sm">{settings.bankAccountName}</p>
                                    </div>
                                ) : (
                                    <div className="text-center p-4 bg-white/5 rounded-xl text-yellow-500/80 mb-4 border border-yellow-500/20">
                                        ⚠️ Info Transfer Bank belum dikonfigurasi oleh admin
                                    </div>
                                )
                            )}
                            {paymentMethod === 'ewallet' && (
                                (settings.ewalletType || settings.ewalletNumber) ? (
                                    <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                                        <p className="text-gray-400 text-xs">Silakan transfer ke {settings.ewalletType || 'E-Wallet'}:</p>
                                        <p className="font-mono text-xl text-purple-300">{settings.ewalletNumber}</p>
                                        <p className="text-sm">{settings.ewalletName}</p>
                                    </div>
                                ) : (
                                    <div className="text-center p-4 bg-white/5 rounded-xl text-yellow-500/80 mb-4 border border-yellow-500/20">
                                        ⚠️ Info E-Wallet belum dikonfigurasi oleh admin
                                    </div>
                                )
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-2 text-yellow-400">📤 Upload Bukti Pembayaran (Wajib)</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-400
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-purple-600 file:text-white
                                hover:file:bg-purple-700"
                            />
                            {previewUrl && (
                                <div className="mt-2 relative w-full h-32 rounded-lg overflow-hidden border border-white/20">
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                            )}
                            {paymentProof && (
                                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                                    ✅ File terpilih: {paymentProof.name}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Order Summary */}
            <div className="bg-white/5 rounded-xl p-4 border border-purple-500/20">
                <h3 className="font-bold mb-3">Ringkasan Pesanan</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-400">Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} item)</span>
                        <span>{formatCurrency(cartTotal)}</span>
                    </div>
                    {tableId && (
                        <div className="flex justify-between">
                            <span className="text-gray-400">Meja</span>
                            <span>{tableId}</span>
                        </div>
                    )}
                    <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span className="text-green-400">{formatCurrency(cartTotal)}</span>
                    </div>
                </div>
            </div>

            {/* Checkout Button */}
            <button
                onClick={handleCheckout}
                disabled={loading || !customerName.trim() || !phone.trim() || (paymentMethod !== 'cash' && !paymentProof)}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 font-bold text-lg disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 transition-all"
            >
                {loading ? (
                    <>
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                        Memproses...
                    </>
                ) : (
                    <>🚀 Pesan Sekarang</>
                )}
            </button>

            {/* Smart Merge Modal */}
            {showMergeModal && createPortal(
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gradient-to-br from-purple-900/90 to-blue-900/90 rounded-2xl p-6 w-full max-w-md border border-purple-500/30 shadow-2xl animate-scale-up">
                        <div className="text-center mb-4">
                            <div className="text-5xl mb-2">👋</div>
                            <h3 className="text-xl font-bold">Halo, {customerName}!</h3>
                            <p className="text-gray-400 mt-2">
                                Ada pesanan aktif sebelumnya dengan nomor ini
                            </p>
                        </div>

                        {existingOrders.length > 0 && (
                            <div className="bg-white/5 rounded-xl p-4 mb-4 border border-purple-500/20">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-gray-400">Pesanan Sebelumnya</span>
                                    <span className="text-xs text-gray-500">
                                        {existingOrders[0].tableNumber ? `Meja ${existingOrders[0].tableNumber}` : 'Take Away'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium">{existingOrders[0].itemCount} item</span>
                                    <span className="font-bold text-green-400">
                                        {formatCurrency(existingOrders[0].total)}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Waktu: {existingOrders[0].time}</p>
                            </div>
                        )}

                        <p className="text-center text-sm text-gray-400 mb-4">
                            Mau tambahkan ke pesanan sebelumnya?
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handleNewOrderAfterCheck}
                                className="py-3 rounded-xl bg-gray-500/20 text-gray-300 font-medium hover:bg-gray-500/30 transition-colors"
                            >
                                🆕 Pesanan Baru
                            </button>
                            <button
                                onClick={handleMergeOrder}
                                className="py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 font-bold hover:from-green-600 hover:to-emerald-700 transition-colors"
                            >
                                ✅ Ya, Gabungkan
                            </button>
                        </div>
                    </div>
                </div>
                , document.body)}
        </div >

    );
}

export default Keranjang;
