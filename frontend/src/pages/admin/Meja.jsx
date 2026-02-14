import { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import useSWR, { mutate } from 'swr';
import CustomSelect from '../../components/CustomSelect';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api, { tablesAPI } from '../../services/api';
import toast from 'react-hot-toast';

const fetcher = url => api.get(url).then(res => res.data);

function Meja() {
    const navigate = useNavigate();
    // SWR Data Fetching with auto-refresh every 30s
    const { data: tablesData, error: swrError } = useSWR('/tables', fetcher, { refreshInterval: 30000 });
    const tables = useMemo(() => {
        const data = Array.isArray(tablesData) ? tablesData : [];
        return [...data].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
    }, [tablesData]);
    const loading = !tablesData && !swrError;
    const error = swrError ? 'Gagal memuat data meja' : null;

    const [showModal, setShowModal] = useState(false);

    // QR Code Modal State
    const [showQRModal, setShowQRModal] = useState(false);
    const [selectedQRTable, setSelectedQRTable] = useState(null);
    const [showGeneralQR, setShowGeneralQR] = useState(false);
    const qrRef = useRef(null);

    // Live Order Preview Modal
    const [showOrderPreview, setShowOrderPreview] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    // Move Table Modal
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveFromTable, setMoveFromTable] = useState(null);
    const [moveToTableId, setMoveToTableId] = useState('');

    // Add Table Form
    const [formData, setFormData] = useState({
        number: '',
        capacity: 4,
        status: 'available'
    });

    const statusOptions = [
        { value: 'available', label: 'Tersedia', color: 'bg-green-500', icon: '✅' },
        { value: 'occupied', label: 'Terisi', color: 'bg-red-500', icon: '🍽️' },
        { value: 'reserved', label: 'Dipesan', color: 'bg-blue-500', icon: '📅' }
    ];

    const getBaseUrl = () => window.location.origin;

    // Calculate occupied duration
    const getOccupiedDuration = (occupiedSince) => {
        if (!occupiedSince) return null;
        const start = new Date(occupiedSince);
        const now = new Date();
        const diffMs = now - start;
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const getStatusInfo = (status) => {
        return statusOptions.find(s => s.value === status) || statusOptions[0];
    };

    // Handle table card click
    const handleTableClick = async (table) => {
        if (table.status === 'occupied') {
            // Show Live Order Preview
            setPreviewLoading(true);
            setShowOrderPreview(true);
            try {
                const res = await tablesAPI.getTableOrders(table.id);
                setPreviewData(res.data);
            } catch (err) {
                console.error('Error fetching table orders:', err);
                toast.error('Gagal memuat pesanan meja');
                setShowOrderPreview(false);
            } finally {
                setPreviewLoading(false);
            }
        }
    };

    // Handle status change (cycle through statuses)
    const handleStatusChange = async (tableId, newStatus) => {
        try {
            await tablesAPI.updateStatus(tableId, newStatus);
            mutate('/tables');
            toast.success('Status meja diperbarui');
        } catch (err) {
            console.error('Error updating table status:', err);
            toast.error('Gagal update status meja');
        }
    };

    // Handle Mark Clean
    const handleMarkClean = async (tableId) => {
        try {
            await tablesAPI.markClean(tableId);
            mutate('/tables');
            toast.success('Meja sudah bersih!');
        } catch (err) {
            console.error('Error marking clean:', err);
            toast.error(err.response?.data?.error || 'Gagal menandai meja bersih');
        }
    };

    // Handle Move Table
    const openMoveModal = (table) => {
        setMoveFromTable(table);
        setMoveToTableId('');
        setShowMoveModal(true);
    };

    const handleMoveTable = async () => {
        if (!moveFromTable || !moveToTableId) {
            toast.error('Pilih meja tujuan');
            return;
        }

        try {
            const res = await tablesAPI.moveTable(moveFromTable.id, moveToTableId);
            toast.success(`${res.data.movedOrders} pesanan dipindahkan!`);
            setShowMoveModal(false);
            setShowOrderPreview(false);
            mutate('/tables');
        } catch (err) {
            console.error('Error moving table:', err);
            toast.error(err.response?.data?.error || 'Gagal pindah meja');
        }
    };

    // Add new table
    const handleAddTable = async () => {
        if (!formData.number) {
            toast.error('Masukkan nomor meja');
            return;
        }

        try {
            await tablesAPI.create({
                id: `tbl_${Date.now()}`,
                number: formData.number,
                capacity: formData.capacity || 4,
                status: 'available'
            });
            toast.success('Meja berhasil ditambahkan!');
            setShowModal(false);
            mutate('/tables');
        } catch (err) {
            console.error('Error adding table:', err);
            toast.error('Gagal menambahkan meja');
        }
    };

    // Handle Delete Table
    const handleDeleteTable = (id) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <span className="font-medium">Hapus meja ini?</span>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="px-3 py-1 text-xs rounded-md bg-gray-600 text-white hover:bg-gray-500"
                    >
                        Batal
                    </button>
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                await tablesAPI.delete(id);
                                toast.success('Meja dihapus', { duration: 3000 });
                                fetchTables();
                            } catch (err) {
                                toast.error('Gagal menghapus meja');
                            }
                        }}
                        className="px-3 py-1 text-xs rounded-md bg-red-500 text-white hover:bg-red-600"
                    >
                        Hapus
                    </button>
                </div>
            </div>
        ), {
            style: { background: '#1F2937', color: '#fff', border: '1px solid #4B5563' }
        });
    };


    // QR Modal Functions
    const openQRModal = (table) => {
        setSelectedQRTable(table);
        setShowGeneralQR(false);
        setShowQRModal(true);
    };

    const openGeneralQRModal = () => {
        setSelectedQRTable(null);
        setShowGeneralQR(true);
        setShowQRModal(true);
    };

    const downloadQR = () => {
        const svg = qrRef.current?.querySelector('svg');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = 400;
            canvas.height = 500;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 50, 50, 300, 300);
            ctx.fillStyle = 'black';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            if (showGeneralQR) {
                ctx.fillText('Menu Umum / Take Away', canvas.width / 2, 400);
            } else {
                ctx.fillText(`Meja ${selectedQRTable?.number}`, canvas.width / 2, 400);
            }
            ctx.font = '14px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText('Scan untuk melihat menu', canvas.width / 2, 430);

            const link = document.createElement('a');
            link.download = showGeneralQR ? 'qr-menu-umum.png' : `qr-meja-${selectedQRTable?.number}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

    // Stats
    const availableCount = tables.filter(t => t.status === 'available').length;
    const occupiedCount = tables.filter(t => t.status === 'occupied').length;
    const reservedCount = tables.filter(t => t.status === 'reserved').length;

    // Available tables for move target
    const availableTables = tables.filter(t => t.status === 'available');

    if (loading && tables.length === 0) {
        return (
            <section className="p-4 md:p-6 space-y-6">
                <h2 className="text-2xl font-bold hidden md:block">🪑 Meja & Reservasi</h2>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="p-4 md:p-6 space-y-6">
                <h2 className="text-2xl font-bold hidden md:block">🪑 Meja & Reservasi</h2>
                <div className="glass rounded-xl p-6 text-center">
                    <p className="text-red-400">{error}</p>
                    <button onClick={fetchTables} className="mt-4 px-4 py-2 bg-purple-500 rounded-lg hover:bg-purple-600">
                        Coba Lagi
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">

                <div className="flex gap-2">
                    <button
                        onClick={openGeneralQRModal}
                        className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                        📱 QR General
                    </button>
                    <button
                        onClick={() => {
                            setFormData({ number: tables.length + 1, capacity: 4, status: 'available' });
                            setShowModal(true);
                        }}
                        className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                        ➕ Tambah Meja
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass rounded-xl p-4 text-center border border-green-500/30">
                    <div className="text-3xl mb-1">✅</div>
                    <p className="text-2xl font-bold text-green-400">{availableCount}</p>
                    <p className="text-xs text-gray-400">Tersedia</p>
                </div>
                <div className="glass rounded-xl p-4 text-center border border-red-500/30">
                    <div className="text-3xl mb-1">🍽️</div>
                    <p className="text-2xl font-bold text-red-400">{occupiedCount}</p>
                    <p className="text-xs text-gray-400">Terisi</p>
                </div>

                <div className="glass rounded-xl p-4 text-center border border-blue-500/30">
                    <div className="text-3xl mb-1">📅</div>
                    <p className="text-2xl font-bold text-blue-400">{reservedCount}</p>
                    <p className="text-xs text-gray-400">Dipesan</p>
                </div>
            </div>

            {/* Table Grid */}
            <div className="glass rounded-xl p-4">
                <h3 className="font-bold mb-4">Status Meja</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {tables.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-gray-400">
                            <div className="text-4xl mb-2">🪑</div>
                            <p>Belum ada meja</p>
                        </div>
                    ) : (
                        tables.map(table => {
                            const statusInfo = getStatusInfo(table.status);
                            const duration = table.status === 'occupied' ? getOccupiedDuration(table.occupiedSince) : null;
                            // Fallback to _id if custom id is missing
                            const tableId = table.id || table._id;

                            return (
                                <div
                                    key={tableId}
                                    onClick={() => handleTableClick(table)}
                                    className={`rounded-xl ${statusInfo.color} p-4 flex flex-col items-center justify-center transition-all cursor-pointer hover:scale-105 ${table.status === 'occupied' ? 'ring-2 ring-red-300 animate-pulse' : ''}`}
                                >
                                    <span className="text-3xl font-bold mb-1">{table.number}</span>
                                    <span className="text-xs opacity-80">{table.capacity || 4} orang</span>

                                    {/* Occupied Timer */}
                                    {duration && (
                                        <span className="mt-1 px-2 py-0.5 rounded-full bg-black/30 text-xs font-mono">
                                            ⏱️ {duration}
                                        </span>
                                    )}

                                    <div className="flex gap-1 w-full mt-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const next = table.status === 'available' ? 'occupied' : 'available';
                                                handleStatusChange(tableId, next);
                                            }}
                                            className="flex-1 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-xs"
                                            title="Ubah Status"
                                        >
                                            🔄
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openQRModal(table); }}
                                            className="flex-1 py-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-xs"
                                            title="Lihat QR"
                                        >
                                            📱
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteTable(tableId); }}
                                            className="flex-1 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs"
                                            title="Hapus Meja"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}

                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/10 text-sm">
                    {statusOptions.map(s => (
                        <div key={s.value} className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded ${s.color}`}></span>
                            <span className="text-gray-400">{s.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Live Order Preview Modal */}
            {showOrderPreview && createPortal(
                <div className="modal-overlay">
                    <div className="glass rounded-2xl p-6 w-full max-w-md animate-scale-up">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">
                                🍽️ Meja {previewData?.table?.number} - Pesanan Aktif
                            </h3>
                            <button
                                onClick={() => setShowOrderPreview(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>

                        {previewLoading ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500 mx-auto"></div>
                            </div>
                        ) : previewData?.orders?.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <p>Tidak ada pesanan aktif</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3 max-h-64 overflow-auto mb-4">
                                    {previewData?.orders?.map(order => (
                                        <div key={order.id} className="bg-white/5 rounded-lg p-3 border border-purple-500/20">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-sm font-medium">{order.customerName || 'Guest'}</span>
                                                <span className="text-xs text-gray-400">{order.time}</span>
                                            </div>
                                            <div className="space-y-1">
                                                {order.items?.slice(0, 3).map((item, idx) => (
                                                    <div key={idx} className="text-xs text-gray-300 flex justify-between">
                                                        <span>{item.name} x{item.qty || 1}</span>
                                                        <span>{formatCurrency((item.price || 0) * (item.qty || 1))}</span>
                                                    </div>
                                                ))}
                                                {order.items?.length > 3 && (
                                                    <p className="text-xs text-gray-500">+{order.items.length - 3} item lagi...</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-purple-500/20 rounded-xl p-4 mb-4 border border-purple-500/30">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300">Total Tagihan</span>
                                        <span className="text-xl font-bold text-green-400">
                                            {formatCurrency(previewData?.totalBill || 0)}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => openMoveModal(previewData?.table)}
                                        className="py-3 rounded-xl bg-yellow-500/20 text-yellow-400 font-medium hover:bg-yellow-500/30 flex items-center justify-center gap-2"
                                    >
                                        🔄 Pindah Meja
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowOrderPreview(false);
                                            navigate(`/kasir?meja=${previewData?.table?.number}`);
                                        }}
                                        className="py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 font-medium hover:from-purple-600 hover:to-blue-600 flex items-center justify-center gap-2"
                                    >
                                        💰 Ke Kasir
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                , document.body)}

            {/* Move Table Modal */}
            {showMoveModal && createPortal(
                <div className="modal-overlay">
                    <div className="glass rounded-2xl p-6 w-full max-w-sm animate-scale-up">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">🔄 Pindah Meja</h3>
                            <button
                                onClick={() => setShowMoveModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                <p className="text-sm text-gray-400">Dari Meja</p>
                                <p className="text-xl font-bold">Meja {moveFromTable?.number}</p>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Pindah ke Meja</label>
                                <CustomSelect
                                    value={moveToTableId}
                                    options={availableTables.map(t => ({ value: t.id, label: `Meja ${t.number}` }))}
                                    onChange={(val) => setMoveToTableId(val)}
                                    placeholder="-- Pilih Meja --"
                                />
                                {availableTables.length === 0 && (
                                    <p className="text-xs text-yellow-400 mt-1">⚠️ Tidak ada meja kosong</p>
                                )}
                            </div>

                            <button
                                onClick={handleMoveTable}
                                disabled={!moveToTableId}
                                className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 font-bold disabled:opacity-50"
                            >
                                Konfirmasi Pindah
                            </button>
                        </div>
                    </div>
                </div>
                , document.body)}

            {/* QR Code Modal */}
            {showQRModal && createPortal(
                <div className="modal-overlay">
                    <div className="glass rounded-2xl p-6 w-full max-w-sm animate-scale-up">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">
                                {showGeneralQR ? '📱 QR Menu Umum' : `📱 QR Meja ${selectedQRTable?.number}`}
                            </h3>
                            <button
                                onClick={() => setShowQRModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>

                        <div ref={qrRef} className="bg-white rounded-xl p-6 flex flex-col items-center">
                            <QRCodeSVG
                                value={showGeneralQR
                                    ? `${getBaseUrl()}`
                                    : `${getBaseUrl()}?meja=${selectedQRTable?.number}`
                                }
                                size={200}
                                level="H"
                                includeMargin={true}
                            />
                            <p className="mt-4 text-black font-bold text-lg">
                                {showGeneralQR ? 'Menu Umum / Take Away' : `Meja ${selectedQRTable?.number}`}
                            </p>
                            <p className="text-gray-500 text-sm">Scan untuk melihat menu</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <button
                                onClick={downloadQR}
                                className="py-3 rounded-xl bg-green-500/20 text-green-400 font-medium hover:bg-green-500/30 flex items-center justify-center gap-2"
                            >
                                💾 Download
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="py-3 rounded-xl bg-blue-500/20 text-blue-400 font-medium hover:bg-blue-500/30 flex items-center justify-center gap-2"
                            >
                                🖨️ Print
                            </button>
                        </div>
                    </div>
                </div>
                , document.body)}

            {/* Add Table Modal */}
            {showModal && createPortal(
                <div className="modal-overlay">
                    <div className="glass rounded-2xl p-6 w-full max-w-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold">➕ Tambah Meja</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Nomor Meja</label>
                                <input
                                    type="number"
                                    value={formData.number}
                                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Kapasitas</label>
                                <input
                                    type="number"
                                    value={formData.capacity}
                                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                />
                            </div>
                            <button
                                onClick={handleAddTable}
                                className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 font-bold"
                            >
                                Tambah Meja
                            </button>
                        </div>
                    </div>
                </div>
                , document.body)}
        </section>
    );
}

export default Meja;
