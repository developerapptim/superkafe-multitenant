
import { useState, useMemo } from 'react';
import useSWR from 'swr';
import api from '../../../services/api';
import SmartText from '../../SmartText';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

const fetcher = url => api.get(url).then(res => res.data);

function ProfitLossTab() {
    // Default to current month
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0]
        };
    });

    const { data, isValidating } = useSWR(
        `/finance/profit-loss?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        fetcher
    );

    const report = useMemo(() => data || {
        sales: { totalRevenue: 0, totalDiscounts: 0, transactionCount: 0 },
        cogs: { totalHPP: 0, percentOfSales: 0 },
        expenses: { totalOpEx: 0, breakdown: {} },
        profit: { grossProfit: 0, grossMargin: 0, netProfit: 0, netMargin: 0 }
    }, [data]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    const expenseData = useMemo(() => {
        if (!report.expenses.breakdown) return [];
        return Object.entries(report.expenses.breakdown).map(([name, value]) => ({
            name,
            value
        }));
    }, [report]);

    const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1'];

    return (
        <div className="space-y-6">
            {/* Filter Controls */}
            <div className="glass p-4 rounded-xl flex flex-wrap items-center gap-4 border border-purple-500/20">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Periode:</span>
                    <input
                        type="date"
                        value={dateRange.startDate}
                        onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                        className="bg-white/5 border border-purple-500/30 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-gray-500">-</span>
                    <input
                        type="date"
                        value={dateRange.endDate}
                        onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                        className="bg-white/5 border border-purple-500/30 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                </div>
                {isValidating && <span className="text-xs text-purple-400 animate-pulse">Memuat data...</span>}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Gross Revenue */}
                <div className="glass p-5 rounded-xl border-l-4 border-green-500">
                    <p className="text-xs text-gray-400 mb-1">Total Penjualan Kotor</p>
                    <SmartText className="text-2xl font-bold text-white">{formatCurrency(report.sales.totalRevenue)}</SmartText>
                    <p className="text-[10px] text-gray-500 mt-1">{report.sales.transactionCount} Transaksi</p>
                </div>

                {/* COGS */}
                <div className="glass p-5 rounded-xl border-l-4 border-orange-500">
                    <p className="text-xs text-gray-400 mb-1">HPP (Modal Bahan)</p>
                    <SmartText className="text-2xl font-bold text-orange-400">{formatCurrency(report.cogs.totalHPP)}</SmartText>
                    <p className="text-[10px] text-gray-500 mt-1">{report.cogs.percentOfSales.toFixed(1)}% dari Penjualan</p>
                </div>

                {/* OpEx */}
                <div className="glass p-5 rounded-xl border-l-4 border-red-500">
                    <p className="text-xs text-gray-400 mb-1">Total Biaya Operasional</p>
                    <SmartText className="text-2xl font-bold text-red-500">{formatCurrency(report.expenses.totalOpEx)}</SmartText>
                </div>

                {/* Net Profit */}
                <div className={`glass p-5 rounded-xl border-l-4 ${report.profit.netProfit >= 0 ? 'border-teal-500 bg-teal-500/5' : 'border-rose-500 bg-rose-500/5'}`}>
                    <p className="text-xs text-gray-400 mb-1">Laba Bersih (Net Profit)</p>
                    <SmartText className={`text-2xl font-bold ${report.profit.netProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                        {formatCurrency(report.profit.netProfit)}
                    </SmartText>
                    <p className="text-[10px] text-gray-500 mt-1">Margin Bersih: {report.profit.netMargin.toFixed(1)}%</p>
                </div>
            </div>

            {/* Detailed Analysis Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Profit Waterfall / Logic */}
                <div className="lg:col-span-2 glass rounded-xl p-6 border border-purple-500/20">
                    <h3 className="font-bold mb-4">📊 Analisis Profitabilitas</h3>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                            <div>
                                <span className="font-bold text-green-400">Penjualan Bersih</span>
                                {/* <p className="text-xs text-gray-400">Total pendapatan setelah diskon</p> */}
                            </div>
                            <span className="font-bold text-white">{formatCurrency(report.sales.totalRevenue)}</span>
                        </div>

                        <div className="flex items-center justify-center text-gray-500 font-mono text-xs">
                            Kurangi
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                            <div>
                                <span className="font-bold text-orange-400">Harga Pokok Penjualan (HPP)</span>
                                <p className="text-xs text-gray-400">Biaya bahan baku langsung</p>
                            </div>
                            <span className="font-bold text-white">({formatCurrency(report.cogs.totalHPP)})</span>
                        </div>

                        <div className="border-t border-dashed border-gray-600 my-2"></div>

                        <div className="flex items-center justify-between px-3">
                            <span className="text-gray-300">Laba Kotor (Gross Profit)</span>
                            <span className="font-bold text-white">{formatCurrency(report.profit.grossProfit)}</span>
                        </div>

                        <div className="flex items-center justify-center text-gray-500 font-mono text-xs mt-2">
                            Kurangi
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <div>
                                <span className="font-bold text-red-400">Biaya Operasional</span>
                                <p className="text-xs text-gray-400">Gaji, Listrik, Sewa, dll.</p>
                            </div>
                            <span className="font-bold text-white">({formatCurrency(report.expenses.totalOpEx)})</span>
                        </div>

                        <div className="border-t-2 border-white/20 my-4"></div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-teal-500/20 to-blue-500/20 border border-teal-500/30">
                            <div>
                                <h4 className="font-bold text-lg text-teal-300">Laba Bersih</h4>
                                <p className="text-xs text-teal-200/70">Keuntungan akhir bisnis</p>
                            </div>
                            <span className="text-2xl font-bold text-teal-300">{formatCurrency(report.profit.netProfit)}</span>
                        </div>
                    </div>
                </div>

                {/* Expense Breakdown Chart */}
                <div className="glass rounded-xl p-6 border border-purple-500/20 flex flex-col">
                    <h3 className="font-bold mb-4">📉 Breakdown Biaya</h3>
                    {expenseData.length > 0 ? (
                        <div className="flex-1 min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={expenseData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {expenseData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(value) => formatCurrency(value)}
                                        contentStyle={{ backgroundColor: '#1f2937', borderRadius: '8px', border: 'none' }}
                                    />
                                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                            Tidak ada data pengeluaran
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ProfitLossTab;
