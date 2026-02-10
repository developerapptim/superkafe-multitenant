import { useState, useEffect } from 'react';
import { shiftAPI } from '../../services/api';

// Helper: Shift Card Component (Accordion)
const ShiftCard = ({ shift }) => {
    const [isOpen, setIsOpen] = useState(false);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (variance) => {
        const v = Math.abs(variance || 0);
        if (v === 0) {
            return <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">KLOP</span>;
        } else if (v <= 5000) {
            return <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">TOLERANSI</span>;
        } else {
            return <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">SELISIH</span>;
        }
    };

    return (
        <div
            className="glass rounded-xl overflow-hidden border border-white/5 hover:border-purple-500/30 transition-all cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
        >
            {/* Compact Header */}
            <div className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-xl">
                        {isOpen ? '📂' : '📁'}
                    </div>
                    <div>
                        <h4 className="font-bold flex items-center gap-2">
                            {formatDate(shift.endTime)}
                            <span className="font-normal text-gray-400 text-sm">
                                {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                            </span>
                        </h4>
                        <p className="text-sm text-gray-400 flex items-center gap-2">
                            👤 {shift.cashierName || '-'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {getStatusBadge(shift.variance)}
                    <div className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                        ▼
                    </div>
                </div>
            </div>

            {/* Expanded Details */}
            {isOpen && (
                <div className="bg-black/20 p-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in text-sm">
                    {/* Modal */}
                    <div>
                        <p className="text-gray-500 text-xs mb-1">💵 Modal Awal</p>
                        <p className="font-mono">{formatCurrency(shift.openingCash)}</p>
                    </div>

                    {/* Sales */}
                    <div>
                        <p className="text-gray-500 text-xs mb-1">📈 Penjualan (+)</p>
                        <p className="font-mono text-green-400">+{formatCurrency(shift.totalSales)}</p>
                    </div>

                    {/* Cash Out */}
                    <div>
                        <p className="text-gray-500 text-xs mb-1">💸 Kas Keluar (-)</p>
                        <p className="font-mono text-red-400">-{formatCurrency(shift.cashOut)}</p>
                    </div>

                    {/* Summary */}
                    <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                        <div className="flex justify-between mb-1">
                            <span className="text-gray-400">Expected:</span>
                            <span className="font-mono">{formatCurrency(shift.expectedCash)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-400">Selisih:</span>
                            <span className={`font-bold font-mono ${(shift.variance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatCurrency(shift.variance)}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function Shift() {
    const [shifts, setShifts] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, matched: 0, variance: 0 });

    // Pagination State
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Activity Pagination
    const [activityPage, setActivityPage] = useState(1);
    const [activityHasMore, setActivityHasMore] = useState(true);
    const [activityLoadingMore, setActivityLoadingMore] = useState(false);
    const [activityLoading, setActivityLoading] = useState(true);

    useEffect(() => {
        fetchShiftHistory(1);
        fetchActivities(1);
    }, []);

    const fetchActivities = async (pageToLoad) => {
        try {
            if (pageToLoad === 1) setActivityLoading(true);
            else setActivityLoadingMore(true);

            // Default limit 20
            const res = await shiftAPI.getActivities({ page: pageToLoad, limit: 20 });

            let newData = [];
            let moreAvailable = false;

            if (res.data.pagination) {
                newData = res.data.data;
                moreAvailable = res.data.pagination.hasMore;
            } else if (Array.isArray(res.data)) {
                // Fallback
                newData = res.data;
                moreAvailable = false;
            }

            if (pageToLoad === 1) {
                setActivityLogs(newData);
            } else {
                setActivityLogs(prev => [...prev, ...newData]);
            }

            setActivityPage(pageToLoad);
            setActivityHasMore(moreAvailable);

        } catch (err) {
            console.error('Error fetching activities:', err);
        } finally {
            setActivityLoading(false);
            setActivityLoadingMore(false);
        }
    };

    const handleLoadMoreActivities = () => {
        if (!activityLoadingMore && activityHasMore) {
            fetchActivities(activityPage + 1);
        }
    };

    const fetchShiftHistory = async (pageToLoad) => {
        try {
            if (pageToLoad === 1) setLoading(true);
            else setLoadingMore(true);

            const res = await shiftAPI.getHistory({ page: pageToLoad, limit: 10 });

            // Handle new pagination structure { data, pagination } or fallback
            // Backend was updated to return { data: [], pagination: {} }
            let newData = [];
            let moreAvailable = false;

            if (res.data.pagination) {
                newData = res.data.data;
                moreAvailable = res.data.pagination.hasMore;
            } else if (Array.isArray(res.data)) {
                // Fallback (older backend logic)
                newData = res.data;
                moreAvailable = false;
            }

            if (pageToLoad === 1) {
                setShifts(newData);
            } else {
                setShifts(prev => [...prev, ...newData]);
            }

            setPage(pageToLoad);
            setHasMore(moreAvailable);

            // Re-calculate Stats based on ALL loaded shifts (or maybe logic should stick to backend? 
            // The prompt didn't specify stats update, but consistent with current view is better)
            // Just calculating from current loaded list for simplicity
            const allData = pageToLoad === 1 ? newData : [...shifts, ...newData];
            const matched = allData.filter(s => Math.abs(s.variance || 0) <= 5000).length;
            const totalVariance = allData.reduce((sum, s) => sum + Math.abs(s.variance || 0), 0);

            setStats({
                total: allData.length,
                matched,
                variance: totalVariance
            });

        } catch (err) {
            console.error('Error fetching shifts:', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            fetchShiftHistory(page + 1);
        }
    };

    const formatCurrency = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

    return (
        <section className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">

                <button
                    onClick={() => { fetchShiftHistory(1); fetchActivities(1); }}
                    className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 flex items-center gap-2"
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass rounded-xl p-4">
                    <p className="text-xs text-gray-400">Total Shift (Loaded)</p>
                    <p className="text-2xl font-bold text-blue-400">{stats.total}</p>
                </div>
                <div className="glass rounded-xl p-4">
                    <p className="text-xs text-gray-400">Shift KLOP/Toleransi</p>
                    <p className="text-2xl font-bold text-green-400">{stats.matched}</p>
                </div>
                <div className="glass rounded-xl p-4">
                    <p className="text-xs text-gray-400">Total Selisih</p>
                    <p className="text-2xl font-bold text-red-400">{formatCurrency(stats.variance)}</p>
                </div>
            </div>

            {/* Shift List (Accordion) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="font-bold">📋 Riwayat Shift</h3>
                    <button className="text-sm text-green-400 hover:text-green-300">
                        📥 Excel Shift
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                        <p className="text-gray-500 mt-4">Memuat data shift...</p>
                    </div>
                ) : shifts.length === 0 ? (
                    <div className="glass p-8 text-center text-gray-400 rounded-xl">
                        <div className="text-4xl mb-2">📋</div>
                        <p>Belum ada data shift</p>
                    </div>
                ) : (
                    <div className="max-h-[350px] overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                        {shifts.map((shift, idx) => (
                            <ShiftCard key={`${shift.id || idx}`} shift={shift} />
                        ))}

                        {/* Load More Button */}
                        {hasMore && (
                            <button
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-all border border-white/5 flex items-center justify-center gap-2 shrink-0"
                            >
                                {loadingMore ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    '🔽 Muat Lebih Lama'
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Activity Log (CCTV) */}
            <div className="glass rounded-xl overflow-hidden mt-8">
                <div className="p-4 border-b border-purple-500/20 flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                        📷 Aktivitas (CCTV Log)
                        <span className="text-xs font-normal text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">Coming Live</span>
                    </h3>
                </div>
                <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                        <thead className="bg-purple-500/10 sticky top-0 backdrop-blur-sm">
                            <tr>
                                <th className="px-4 py-3 text-left w-32">Waktu</th>
                                <th className="px-4 py-3 text-left w-32">User</th>
                                <th className="px-4 py-3 text-left w-24">Role</th>
                                <th className="px-4 py-3 text-left w-24">Modul</th>
                                <th className="px-4 py-3 text-left w-24">Aksi</th>
                                <th className="px-4 py-3 text-left">Deskripsi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-500/10">
                            {activityLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mx-auto mb-2"></div>
                                        <p>Memuat aktivitas...</p>
                                    </td>
                                </tr>
                            ) : activityLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                        <div className="text-3xl mb-2">🕵️</div>
                                        <p>Belum ada aktivitas tercatat</p>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {activityLogs.map((log) => (
                                        <tr key={log._id} className="hover:bg-white/5 font-mono text-xs">
                                            <td className="px-4 py-2 text-gray-400">
                                                {new Date(log.timestamp).toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-4 py-2 font-bold text-white">
                                                {log.user?.name || 'System'}
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className="px-2 py-0.5 rounded bg-white/10 text-gray-300">
                                                    {log.user?.role || 'sys'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-blue-300">
                                                {log.module}
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className={`px-2 py-0.5 rounded ${log.action.includes('DELETE') ? 'bg-red-500/20 text-red-400' :
                                                    log.action.includes('UPDATE') ? 'bg-yellow-500/20 text-yellow-400' :
                                                        log.action.includes('ADD') || log.action.includes('CREATE') ? 'bg-green-500/20 text-green-400' :
                                                            'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-gray-300">
                                                {log.description}
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Load More Row */}
                                    {activityHasMore && (
                                        <tr>
                                            <td colSpan={6} className="p-2">
                                                <button
                                                    onClick={handleLoadMoreActivities}
                                                    disabled={activityLoadingMore}
                                                    className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-all text-xs flex items-center justify-center gap-2"
                                                >
                                                    {activityLoadingMore ? (
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    ) : (
                                                        '🔽 Muat Lebih Banyak Log'
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section >
    );
}

export default Shift;
