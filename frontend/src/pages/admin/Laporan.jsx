import { useState, useMemo } from 'react';
import useSWR from 'swr';
import api from '../../services/api';

// Fetcher
const fetcher = url => api.get(url).then(res => res.data);

function Laporan() {
    const [period, setPeriod] = useState('daily');
    // Fetch analytics data from backend
    const { data: analyticsData, error } = useSWR(
        `/analytics/report?period=${period}&timezone=%2B07:00`,
        fetcher,
        { refreshInterval: 60000 }
    );
    const isLoading = !analyticsData && !error;

    // Default empty data to prevent crashes
    const { stats, paymentStats, topMenu, bottomMenu, peakHours, retention, topCombinations } = analyticsData || {
        stats: { revenue: 0, orders: 0, avgOrderValue: 0, growthRate: 0 },
        paymentStats: { cashCount: 0, nonCashCount: 0, cashPercent: 0, nonCashPercent: 0 },
        topMenu: [],
        bottomMenu: [],
        peakHours: [],
        retention: { new: 0, returning: 0 },
        topCombinations: []
    };

    // Calculate profit stats (Client-side derivation from backend revenue)
    const profitStats = useMemo(() => {
        const revenue = stats.revenue || 0;
        const totalHPP = revenue * 0.35; // Estimate 35% HPP
        const grossProfit = revenue - totalHPP;
        const avgMargin = revenue > 0 ? ((revenue - totalHPP) / revenue * 100) : 0;
        return { totalHPP, grossProfit, avgMargin, integratedOrders: stats.orders };
    }, [stats.revenue, stats.orders]);





    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    const periods = [
        { value: 'daily', label: 'Harian' },
        { value: 'weekly', label: 'Mingguan' },
        { value: 'monthly', label: 'Bulanan' },
        { value: 'yearly', label: 'Tahunan' }
    ];

    const maxCount = Math.max(...topMenu.map(m => m.count), 1);
    const maxBottomCount = Math.max(...bottomMenu.map(m => m.count), 1);
    const maxPeakCount = Math.max(...peakHours.map(h => h.count), 1);

    return (
        <section className="p-4 md:p-6 space-y-6">
            <h2 className="text-2xl font-bold hidden md:block">📈 Laporan & Analitik</h2>

            {/* Period Filter */}
            <div className="flex gap-2 flex-wrap">
                {periods.map(p => (
                    <button
                        key={p.value}
                        onClick={() => setPeriod(p.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === p.value
                            ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                            : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            ) : (
                <>
                    {/* Report Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        <div className="glass rounded-xl p-3 md:p-4 border-l-4 border-green-500">
                            <p className="text-[10px] md:text-xs text-gray-400">Total Pendapatan</p>
                            <p className="text-lg md:text-xl font-bold truncate">{formatCurrency(stats.revenue)}</p>
                        </div>
                        <div className="glass rounded-xl p-3 md:p-4 border-l-4 border-blue-500">
                            <p className="text-[10px] md:text-xs text-gray-400">Total Pesanan</p>
                            <p className="text-lg md:text-xl font-bold">{stats.orders}</p>
                        </div>
                        <div className="glass rounded-xl p-3 md:p-4 border-l-4 border-purple-500">
                            <p className="text-[10px] md:text-xs text-gray-400">Rata-rata Transaksi</p>
                            <p className="text-lg md:text-xl font-bold truncate">{formatCurrency(stats.avgOrderValue)}</p>
                        </div>
                        <div className="glass rounded-xl p-3 md:p-4 border-l-4 border-yellow-500">
                            <p className="text-[10px] md:text-xs text-gray-400">Pertumbuhan Omzet</p>
                            <p className={`text-lg md:text-xl font-bold ${stats.growthRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {stats.growthRate > 0 ? '+' : ''}{stats.growthRate.toFixed(1)}%
                            </p>
                            <p className="text-[10px] md:text-xs text-gray-500">vs periode sebelumnya</p>
                        </div>
                    </div>

                    {/* Profit Analysis */}
                    <div className="glass rounded-xl p-4">
                        <h3 className="font-bold mb-4">⚖️ Analisis Profitabilitas dari Pesanan</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <p className="text-xs text-gray-400">Total HPP Pesanan</p>
                                <p className="text-xl font-bold text-red-400">{formatCurrency(profitStats.totalHPP)}</p>
                            </div>
                            <div className="relative group">
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                    Laba Kotor (Gross Profit)
                                    <span className="cursor-help text-gray-500">ⓘ</span>
                                </p>
                                <p className="text-xl font-bold text-green-400">{formatCurrency(profitStats.grossProfit)}</p>
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10">
                                    <div className="bg-gray-900 text-xs text-gray-300 p-2 rounded-lg shadow-lg max-w-xs">
                                        Pendapatan dikurangi HPP Bahan.<br />
                                        <span className="text-yellow-400">Belum termasuk biaya operasional & gaji.</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Rata-rata Margin</p>
                                <p className="text-xl font-bold text-purple-400">{profitStats.avgMargin.toFixed(1)}%</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Pesanan Terintegrasi</p>
                                <p className="text-xl font-bold text-blue-400">{profitStats.integratedOrders}</p>
                            </div>
                        </div>
                    </div>

                    {/* Charts Row 1: Menu Analysis */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Top Menu */}
                        <div className="glass rounded-xl p-4">
                            <h3 className="font-bold mb-4">🏆 Menu Terlaris</h3>
                            <div className="space-y-3">
                                {topMenu.length === 0 ? (
                                    <p className="text-center text-gray-400 py-4">Belum ada data</p>
                                ) : (
                                    topMenu.map((item, idx) => (
                                        <div key={item.name} className="flex items-center gap-3">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-600' : 'bg-white/20'
                                                }`}>
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm truncate">{item.name}</span>
                                                    <span className="text-sm text-gray-400">{item.count}x</span>
                                                </div>
                                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                                                        style={{ width: `${(item.count / maxCount) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Bottom Menu */}
                        <div className="glass rounded-xl p-4">
                            <h3 className="font-bold mb-4">📉 Menu Kurang Diminati</h3>
                            <div className="space-y-3">
                                {bottomMenu.length === 0 ? (
                                    <p className="text-center text-gray-400 py-4">Belum ada data</p>
                                ) : (
                                    bottomMenu.map((item, idx) => (
                                        <div key={item.name} className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-red-500/30 text-red-400">
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm truncate">{item.name}</span>
                                                    <span className="text-sm text-red-400">{item.count}x</span>
                                                </div>
                                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                                                        style={{ width: `${(item.count / maxBottomCount) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Menu Combinations - Frequently Bought Together */}
                        <div className="glass rounded-xl p-4">
                            <h3 className="font-bold mb-4">🔥 Sering Dibeli Bersamaan</h3>
                            <div className="space-y-3">
                                {(!topCombinations || topCombinations.length === 0) ? (
                                    <p className="text-center text-gray-400 py-4">Belum ada data kombinasi</p>
                                ) : (
                                    topCombinations.map((combo, idx) => (
                                        <div key={combo.name} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <span className="text-orange-400">🛒</span>
                                                <span className="text-sm">{combo.name}</span>
                                            </div>
                                            <span className="text-sm text-purple-400 font-medium">{combo.count}x</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Customer Retention - New vs Returning */}
                        <div className="glass rounded-xl p-4">
                            <h3 className="font-bold mb-4">👥 Retensi Pelanggan</h3>
                            {(!retention || (retention.new === 0 && retention.returning === 0)) ? (
                                <p className="text-center text-gray-400 py-8">Belum ada data pelanggan</p>
                            ) : (
                                <div className="flex items-center justify-center gap-8">
                                    {/* Retention Pie Chart */}
                                    <div
                                        className="w-32 h-32 rounded-full relative"
                                        style={{
                                            background: `conic-gradient(
                                                #8b5cf6 0% ${(retention.new / (retention.new + retention.returning) * 100) || 0}%, 
                                                #14b8a6 ${(retention.new / (retention.new + retention.returning) * 100) || 0}% 100%
                                            )`
                                        }}
                                    >
                                        <div className="absolute inset-4 bg-[#1E1B4B] rounded-full flex items-center justify-center">
                                            <span className="text-xs text-gray-400">{retention.new + retention.returning} Cust</span>
                                        </div>
                                    </div>
                                    {/* Legend */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded bg-purple-500"></div>
                                            <span className="text-sm">Pelanggan Baru ({retention.new})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded bg-teal-500"></div>
                                            <span className="text-sm">Pelanggan Kembali ({retention.returning})</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Charts Row 2: Peak Hours & Payment Pie */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Peak Hours */}
                        <div className="glass rounded-xl p-4">
                            <h3 className="font-bold mb-4">⏰ Jam Ramai</h3>
                            <div className="h-48 flex items-end justify-around gap-1">
                                {peakHours.map(h => (
                                    <div key={h.hour} className="flex flex-col items-center flex-1">
                                        <div
                                            className={`w-full rounded-t transition-all ${h.count > 0 ? 'bg-gradient-to-t from-purple-500 to-blue-500' : 'bg-white/10'
                                                }`}
                                            style={{ height: `${maxPeakCount > 0 ? (h.count / maxPeakCount) * 100 : 0}%`, minHeight: '4px' }}
                                        ></div>
                                        <span className="text-xs text-gray-400 mt-1">{h.hour}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Payment Pie Chart */}
                        <div className="glass rounded-xl p-4">
                            <h3 className="font-bold mb-4">💳 Metode Pembayaran</h3>
                            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                                {/* Simple CSS Pie Chart */}
                                <div
                                    className="w-32 h-32 rounded-full relative"
                                    style={{
                                        background: `conic-gradient(
                                            #22c55e 0% ${paymentStats.cashPercent}%, 
                                            #3b82f6 ${paymentStats.cashPercent}% 100%
                                        )`
                                    }}
                                >
                                    <div className="absolute inset-4 bg-[#1E1B4B] rounded-full flex items-center justify-center">
                                        <span className="text-xs text-gray-400">{stats.orders} Pesanan</span>
                                    </div>
                                </div>
                                {/* Legend */}
                                <div className="space-y-3 w-full md:w-auto">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-green-500"></div>
                                        <span className="text-sm">Cash ({paymentStats.cashPercent}%)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-blue-500"></div>
                                        <span className="text-sm">QRIS/Non-Cash ({paymentStats.nonCashPercent}%)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Export Buttons */}
                    <div className="glass rounded-xl p-4">
                        <h3 className="font-bold mb-4">📥 Export Data</h3>
                        <div className="flex flex-wrap gap-3">
                            <button className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center gap-2">
                                📥 Excel Shift
                            </button>
                            <button className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 flex items-center gap-2">
                                📥 Excel Transaksi
                            </button>
                            <button className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 flex items-center gap-2">
                                📊 Export PDF
                            </button>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}

export default Laporan;
