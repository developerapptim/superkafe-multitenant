import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useSWR, { mutate } from 'swr';
import CustomSelect from '../../components/CustomSelect';
import CalendarInput from '../../components/CalendarInput';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api, { tablesAPI, reservationsAPI } from '../../services/api';
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

    // Stats Calculations (moved up to avoid TDZ)
    const availableTables = tables.filter(t => t.status === 'available');
    const availableCount = availableTables.length;
    const occupiedCount = tables.filter(t => t.status === 'occupied').length;
    const reservedCount = tables.filter(t => t.status === 'reserved').length;

    // Reservation State (Moved up to avoid TDZ)
    const { data: reservationsData, mutate: mutateReservations } = useSWR('/reservations?status=pending', fetcher, { refreshInterval: 15000 });
    const pendingReservations = Array.isArray(reservationsData) ? reservationsData : [];
    const { data: settingsData } = useSWR('/settings', fetcher);
    const shopName = settingsData?.name || 'Warkop';

    const [showModal, setShowModal] = useState(false);

    // QR Code Modal State
    const [showQRModal, setShowQRModal] = useState(false);
    const [selectedQRTable, setSelectedQRTable] = useState(null);
    const [showGeneralQR, setShowGeneralQR] = useState(false);
    const qrRef = useRef(null);

    // Sound Alert for New Reservations
    const prevPendingCountRef = useRef(0);
    useEffect(() => {
        const count = pendingReservations.length;
        if (count > prevPendingCountRef.current) {
            const audio = new Audio('/notif.mp3');
            audio.play().catch(err => console.log('Audio play failed:', err));
            toast('🔔 Permintaan Reservasi Baru!', {
                icon: '📅',
                duration: 5000,
                style: { borderRadius: '10px', background: '#333', color: '#fff' },
            });
        }
        prevPendingCountRef.current = count;
    }, [pendingReservations.length]);

    // Live Order Preview Modal
    const [showOrderPreview, setShowOrderPreview] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    // Move Table Modal
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [moveFromTable, setMoveFromTable] = useState(null);
    const [moveToTableId, setMoveToTableId] = useState('');

    // Reservation State


    const [showStaffReservationModal, setShowStaffReservationModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [approveTarget, setApproveTarget] = useState(null);
    const [approveTableId, setApproveTableId] = useState(''); // Keep for legacy or safety
    const [approveTableIds, setApproveTableIds] = useState([]); // New multi-select state
    const [staffResvForm, setStaffResvForm] = useState({
        customerName: '', customerPhone: '', pax: 2, eventType: 'Nongkrong', notes: '',
        reservationDate: '', reservationTime: '', tableIds: []
    });

    // Add Table Form
    const [formData, setFormData] = useState({
        number: '',
        capacity: 4,
        status: 'available'
    });

    // Generate Options
    const eventOptions = [
        { label: 'Nongkrong (Hangout)', value: 'Nongkrong' },
        { label: 'Rapat (Meeting)', value: 'Rapat' },
        { label: 'Ulang Tahun (Birthday)', value: 'Ulang Tahun' },
        { label: 'Arisan', value: 'Arisan' },
        { label: 'Lainnya', value: 'Lainnya' }
    ];

    const timeOptions = useMemo(() => {
        const options = [];
        for (let h = 10; h <= 22; h++) {
            const hour = h.toString().padStart(2, '0');
            options.push({ value: `${hour}:00`, label: `${hour}:00` });
            if (h !== 22) options.push({ value: `${hour}:30`, label: `${hour}:30` });
        }
        return options;
    }, []);





    const tableOptions = useMemo(() => {
        return [
            { value: '', label: '-- Pilih Meja --' },
            ...availableTables.map(t => ({
                value: t.id || t._id,
                label: `Meja ${t.number} (Kap: ${t.capacity})`
            }))
        ];
    }, [availableTables]);

    // Add Table Form
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
            {/* Header - Buttons Grid */}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-4 mb-2">
                <button
                    onClick={openGeneralQRModal}
                    className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 p-2 md:p-4 rounded-xl text-[10px] md:text-sm font-medium flex flex-col items-center justify-center gap-1 md:gap-2 shadow-lg hover:scale-105 transition-transform h-full"
                >
                    <span className="text-xl md:text-2xl">📱</span>
                    <span className="text-center leading-tight">QR General</span>
                </button>
                <button
                    onClick={() => {
                        setFormData({ number: tables.length + 1, capacity: 4, status: 'available' });
                        setShowModal(true);
                    }}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 p-2 md:p-4 rounded-xl text-[10px] md:text-sm font-medium flex flex-col items-center justify-center gap-1 md:gap-2 shadow-lg hover:scale-105 transition-transform h-full"
                >
                    <span className="text-xl md:text-2xl">➕</span>
                    <span className="text-center leading-tight">Tambah Meja</span>
                </button>
                <button
                    onClick={() => setShowStaffReservationModal(true)}
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 p-2 md:p-4 rounded-xl text-[10px] md:text-sm font-medium flex flex-col items-center justify-center gap-1 md:gap-2 shadow-lg hover:scale-105 transition-transform h-full"
                >
                    <span className="text-xl md:text-2xl">📅</span>
                    <span className="text-center leading-tight">Buat Reservasi</span>
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-4">
                <div className="glass rounded-xl p-2 md:p-4 text-center border border-green-500/30">
                    <div className="text-xl md:text-3xl mb-1">✅</div>
                    <p className="text-lg md:text-2xl font-bold text-green-400">{availableCount}</p>
                    <p className="text-[10px] md:text-xs text-gray-400">Tersedia</p>
                </div>
                <div className="glass rounded-xl p-2 md:p-4 text-center border border-red-500/30">
                    <div className="text-xl md:text-3xl mb-1">🍽️</div>
                    <p className="text-lg md:text-2xl font-bold text-red-400">{occupiedCount}</p>
                    <p className="text-[10px] md:text-xs text-gray-400">Terisi</p>
                </div>

                <div className="glass rounded-xl p-2 md:p-4 text-center border border-blue-500/30">
                    <div className="text-xl md:text-3xl mb-1">📅</div>
                    <p className="text-lg md:text-2xl font-bold text-blue-400">{reservedCount}</p>
                    <p className="text-[10px] md:text-xs text-gray-400">Dipesan</p>
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

            {/* Pending Reservations Section - Always Visible */}
            <div className="glass rounded-xl p-4 border border-purple-500/20">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-lg">
                    🔔 Reservasi Pending
                    {pendingReservations.length > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-bounce shadow-lg shadow-red-500/50">
                            {pendingReservations.length}
                        </span>
                    )}
                </h3>

                {pendingReservations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500 bg-white/5 rounded-xl border border-dashed border-gray-600/50">
                        <div className="text-4xl mb-2 opacity-50">📭</div>
                        <p className="text-sm">Belum ada permintaan reservasi baru</p>
                    </div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {pendingReservations.map(rsv => {
                            const rsvTime = new Date(rsv.reservationTime);
                            const timeStr = rsvTime.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                            const phone = (rsv.customerPhone || '').replace(/^0/, '62').replace(/\D/g, ''); // Ensure numeric only
                            const waMsg = encodeURIComponent(`Halo Kak ${rsv.customerName}, kami menerima permintaan reservasi di ${shopName} untuk ${rsv.pax} orang pada ${timeStr}. Untuk konfirmasi meja dan Down Payment (DP)/uang muka, silakan balas pesan ini ya Kak.`);
                            const waLink = `https://wa.me/${phone}?text=${waMsg}`;

                            return (
                                <div key={rsv.id || rsv._id} className="bg-gradient-to-br from-purple-900/40 to-black/40 border border-purple-500/30 rounded-xl p-4 shadow-lg hover:shadow-purple-500/20 transition-all flex flex-col h-full">
                                    {/* Top: Name, Phone, Date */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="font-bold text-white text-lg leading-tight">{rsv.customerName}</p>
                                            <p className="text-sm text-purple-300 font-mono mt-0.5">{rsv.customerPhone}</p>
                                        </div>
                                        <div className="text-right bg-black/30 px-3 py-1.5 rounded-lg border border-purple-500/20">
                                            <p className="text-sm text-orange-400 font-bold whitespace-nowrap">📅 {timeStr}</p>
                                        </div>
                                    </div>

                                    {/* Middle: Action Buttons */}
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <a
                                            href={waLink}
                                            target="_blank" rel="noopener noreferrer"
                                            className="col-span-1 py-2 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 text-center text-xs font-bold flex flex-col items-center justify-center gap-1 border border-green-600/30 transition-all"
                                            title="Hubungi via WhatsApp"
                                        >
                                            <span className="text-lg">💬</span>
                                            <span>WA</span>
                                        </a>
                                        <button
                                            onClick={() => {
                                                setApproveTarget(rsv);
                                                setApproveTableIds([]); // Reset multi-select
                                                setApproveTableId(''); // Safe reset
                                                setShowApproveModal(true);
                                            }}
                                            className="col-span-1 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-center text-xs font-bold flex flex-col items-center justify-center gap-1 shadow-lg shadow-blue-600/30 transition-all"
                                            title="Terima Reservasi"
                                        >
                                            <span className="text-lg">✅</span>
                                            <span>Terima</span>
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!window.confirm(`Tolak reservasi dari ${rsv.customerName}?`)) return;
                                                try {
                                                    await reservationsAPI.reject(rsv.id || rsv._id);
                                                    toast.success('Reservasi ditolak');
                                                    mutateReservations();
                                                } catch (err) {
                                                    toast.error('Gagal menolak reservasi');
                                                }
                                            }}
                                            className="col-span-1 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-center text-xs font-bold flex flex-col items-center justify-center gap-1 border border-red-500/20 transition-all"
                                            title="Tolak Reservasi"
                                        >
                                            <span className="text-lg">✕</span>
                                            <span>Tolak</span>
                                        </button>
                                    </div>

                                    {/* Bottom: Details (Pax, Type, Notes) */}
                                    <div className="mt-auto bg-black/20 rounded-xl p-3 border border-white/5 text-sm space-y-2">
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                            <span className="text-gray-400 text-xs">Jumlah Tamu</span>
                                            <span className="font-bold text-white">{rsv.pax} Orang</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                            <span className="text-gray-400 text-xs">Tujuan</span>
                                            <span className="font-bold text-purple-300 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-xs uppercase tracking-wide">
                                                {rsv.eventType}
                                            </span>
                                        </div>
                                        {rsv.notes && (
                                            <div className="pt-1">
                                                <span className="text-gray-500 block mb-1 text-[10px] uppercase tracking-wider">Catatan Tambahan</span>
                                                <p className="text-gray-300 italic bg-white/5 p-2 rounded text-xs border border-white/5">"{rsv.notes}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
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

            {/* Approve Reservation Modal */}
            {showApproveModal && approveTarget && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowApproveModal(false)}>
                    <div className="glass rounded-2xl p-6 w-full max-w-sm animate-scale-up" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-2">✅ Terima Reservasi</h3>
                        <p className="text-gray-400 text-sm mb-4">
                            {approveTarget.customerName} • {approveTarget.pax} orang
                        </p>

                        <div className="space-y-4">
                            <div className="relative z-50">
                                <label className="block text-sm text-gray-400 mb-1">Pilih Meja Tersedia</label>
                                <CustomSelect
                                    value={approveTableIds}
                                    onChange={setApproveTableIds}
                                    options={availableTables.map(t => ({ value: t.id || t._id, label: `Meja ${t.number} (Kap: ${t.capacity})` }))}
                                    placeholder="-- Pilih Meja --"
                                    isMulti={true}
                                />
                            </div>
                            <div className="flex gap-2 pt-20"> {/* Added padding top for dropdown space */}
                                <button onClick={() => setShowApproveModal(false)} className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">Batal</button>
                                <button
                                    onClick={async () => {
                                        if (approveTableIds.length === 0) { toast.error('Pilih minimal satu meja'); return; }
                                        try {
                                            await reservationsAPI.approve(approveTarget.id || approveTarget._id, { tableIds: approveTableIds });
                                            toast.success('Reservasi diterima! Meja sudah di-reserved.');
                                            setShowApproveModal(false);
                                            mutateReservations();
                                            mutate('/tables');
                                        } catch (err) {
                                            toast.error(err.response?.data?.error || 'Gagal menerima reservasi');
                                        }
                                    }}
                                    className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 font-bold hover:from-blue-600 hover:to-purple-600 transition-all"
                                >
                                    Terima
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                , document.body)}

            {/* Staff Create Reservation Modal */}
            {showStaffReservationModal && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowStaffReservationModal(false)}>
                    <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl w-[95%] max-w-md max-h-[90vh] flex flex-col border border-blue-500/30 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#1a1a2e] z-10 rounded-t-2xl">
                            <h3 className="text-lg font-bold">📅 Buat Reservasi (Staf)</h3>
                            <button onClick={() => setShowStaffReservationModal(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">✕</button>
                        </div>

                        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1 pb-32">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Nama Lengkap *</label>
                                <input type="text" placeholder="Nama pelanggan"
                                    value={staffResvForm.customerName}
                                    onChange={e => setStaffResvForm(f => ({ ...f, customerName: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">No. WhatsApp *</label>
                                <input type="tel" placeholder="08xxxxxxxxxx"
                                    value={staffResvForm.customerPhone}
                                    onChange={e => setStaffResvForm(f => ({ ...f, customerPhone: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Jumlah Orang</label>
                                    <input type="number" min="1" max="50" value={staffResvForm.pax}
                                        onChange={e => setStaffResvForm(f => ({ ...f, pax: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-purple-500/30 text-white outline-none" />
                                </div>
                                <div className="relative z-30">
                                    <label className="block text-sm text-gray-400 mb-1">Tujuan</label>
                                    <CustomSelect
                                        value={staffResvForm.eventType}
                                        onChange={val => setStaffResvForm(f => ({ ...f, eventType: val }))}
                                        options={eventOptions}
                                        placeholder="Pilih Tujuan"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative z-20">
                                    <label className="block text-sm text-gray-400 mb-1">Tanggal *</label>
                                    <CalendarInput
                                        value={staffResvForm.reservationDate}
                                        onChange={val => setStaffResvForm(f => ({ ...f, reservationDate: val }))}
                                        minDate={(() => {
                                            const d = new Date();
                                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                        })()}
                                        placeholder="Pilih Tanggal"
                                    />
                                </div>
                                <div className="relative z-20">
                                    <label className="block text-sm text-gray-400 mb-1">Jam *</label>
                                    <CustomSelect
                                        value={staffResvForm.reservationTime}
                                        onChange={val => setStaffResvForm(f => ({ ...f, reservationTime: val }))}
                                        options={timeOptions}
                                        placeholder="Pilih Jam"
                                        optionAlign="center"
                                        textSize="text-lg"
                                    />
                                </div>
                            </div>
                            <div className="relative z-10">
                                <label className="block text-sm text-gray-400 mb-1">Assign Meja (Langsung Approved)</label>
                                <CustomSelect
                                    value={staffResvForm.tableIds}
                                    onChange={val => setStaffResvForm(f => ({ ...f, tableIds: val }))}
                                    options={tableOptions}
                                    placeholder="-- Pilih Meja --"
                                    isMulti={true}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Catatan</label>
                                <textarea placeholder="Catatan khusus" value={staffResvForm.notes}
                                    onChange={e => setStaffResvForm(f => ({ ...f, notes: e.target.value }))}
                                    rows={2}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-purple-500/30 text-white placeholder-gray-500 outline-none resize-none" />
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-[#16213e] sticky bottom-0 z-10 rounded-b-2xl">
                            <button
                                onClick={async () => {
                                    const { customerName, customerPhone, pax, eventType, notes, reservationDate, reservationTime: rTime, tableIds: tIds } = staffResvForm;

                                    const missing = [];
                                    if (!customerName) missing.push('Nama');
                                    if (!customerPhone) missing.push('No. HP');
                                    if (!reservationDate) missing.push('Tanggal');
                                    if (!rTime) missing.push('Jam');

                                    if (missing.length > 0) {
                                        toast.error(`${missing.join(', ')} wajib diisi`);
                                        return;
                                    }
                                    try {
                                        // Fix Date parsing for IOS/Safari compatibility if needed, but standard YYYY-MM-DDTHH:mm is usually fine
                                        const reservationTime = new Date(`${reservationDate}T${rTime}:00`);
                                        await reservationsAPI.create({
                                            customerName, customerPhone, pax: parseInt(pax) || 2,
                                            eventType, notes, reservationTime,
                                            createdBy: 'staff',
                                            tableIds: tIds // Send array
                                        });
                                        toast.success(tIds && tIds.length > 0 ? 'Reservasi dibuat & meja di-reserved!' : 'Reservasi dibuat (pending).');
                                        setShowStaffReservationModal(false);
                                        setStaffResvForm({ customerName: '', customerPhone: '', pax: 2, eventType: 'Nongkrong', notes: '', reservationDate: '', reservationTime: '', tableIds: [] });
                                        mutateReservations();
                                        mutate('/tables');
                                    } catch (err) {
                                        toast.error(err.response?.data?.error || 'Gagal membuat reservasi');
                                    }
                                }}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 font-bold hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg"
                            >
                                📅 Buat Reservasi
                            </button>
                        </div>
                    </div>
                </div>
                , document.body)}
        </section>
    );
}

export default Meja;
