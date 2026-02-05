import { useState, useMemo } from 'react';
import useSWR from 'swr';
import api, { reportsAPI, tablesAPI, menuAPI } from '../../services/api';

// Generic fetcher
const fetcher = url => api.get(url).then(res => res.data);

function Dashboard() {
    const [searchTerm, setSearchTerm] = useState('');

    // SWR Hooks for Data Fetching
    const { data: statsData } = useSWR('/stats', fetcher, { refreshInterval: 15000 });
    const { data: tablesData } = useSWR('/tables', fetcher, { refreshInterval: 15000 });
    const { data: menuData } = useSWR('/menu', fetcher, { refreshInterval: 60000 });

    // Derived State: Stats & Transactions
    const { stats, topMenuItems, transactions, hourlyData } = useMemo(() => {
        if (!statsData?.success) return {
            stats: { revenue: 0, revenueChange: '+0%', orders: 0, tables: '0/0', customers: 0 },
            topMenuItems: [],
            transactions: [],
            hourlyData: []
        };

        const { stats: backendStats, recentOrders, topProducts } = statsData;
        const tablesCount = Array.isArray(tablesData) ? `${tablesData.filter(t => t.status === 'occupied').length}/${tablesData.length}` : '0/0';

        const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

        // Process Transactions
        const processedTransactions = (recentOrders || []).map(o => ({
            id: o.id,
            time: o.time || new Date(o.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            customer: o.customerName || 'Pelanggan',
            type: o.orderType === 'dine-in' ? 'Dine In' : 'Take Away',
            table: o.tableNumber,
            menu: o.items?.map(i => `${i.name || i.menuName} x${i.qty || i.quantity}`).join(', ') || '-',
            total: o.total || 0,
            method: o.paymentMethod || 'cash',
            status: o.status,
        }));

        // Hourly Data Calculation
        const hourlyMap = {};
        (recentOrders || []).forEach(o => {
            const h = o.time?.split(':')[0] || new Date(o.timestamp).getHours().toString().padStart(2, '0');
            hourlyMap[h] = (hourlyMap[h] || 0) + 1;
        });
        const chartData = [];
        for (let h = 8; h <= 22; h++) {
            const hourStr = h.toString().padStart(2, '0');
            chartData.push({ hour: hourStr, orders: hourlyMap[hourStr] || 0 });
        }

        return {
            stats: {
                revenue: formatCurrency(backendStats.revenue || 0),
                revenueChange: '+0%', // Future implementation
                orders: backendStats.orders || 0,
                tables: tablesCount,
                customers: (recentOrders || []).length
            },
            topMenuItems: topProducts || [],
            transactions: processedTransactions,
            hourlyData: chartData
        };
    }, [statsData, tablesData]);

    // Derived State: Table Statuses
    const tableStatuses = Array.isArray(tablesData) ? tablesData.map(t => ({
        number: parseInt(t.number) || t.id,
        status: t.status || 'available',
    })) : [];

    // Derived State: Low Stock
    const lowStockItems = useMemo(() => {
        return Array.isArray(menuData) ? menuData
            .filter(m => m.available_qty !== undefined && m.available_qty < 10 && m.use_stock_check)
            .slice(0, 5)
            .map(m => ({
                name: m.name,
                stock: m.available_qty || 0,
                unit: 'porsi',
            })) : [];
    }, [menuData]);

    // Filter Transactions
    const filteredTransactions = transactions.filter(t =>
        t.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.menu.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const maxOrders = Math.max(...hourlyData.map(h => h.orders), 1);
    const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

    // Initial Loading State
    if (!statsData && !tablesData && !menuData) {
        return (
            <section className="p-4 md:p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">📊 Dashboard</h2>
                </div>
                <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            </section>
        );
    }

    return (
        <section className="p-4 md:p-6 space-y-6">
            <div className="hidden md:flex items-center justify-between">
                <h2 className="text-2xl font-bold">📊 Dashboard</h2>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {/* Revenue Card */}
                <div className="glass rounded-xl p-3 md:p-4 hover:transform hover:-translate-y-1 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xl md:text-2xl">💰</span>
                        <span className="text-[10px] md:text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded-full">{stats.revenueChange}</span>
                    </div>
                    <p className="text-lg md:text-2xl font-bold truncate">{stats.revenue}</p>
                    <p className="text-[10px] md:text-xs text-gray-400">Pendapatan Hari Ini</p>
                </div>

                {/* Orders Card */}
                <div className="glass rounded-xl p-3 md:p-4 hover:transform hover:-translate-y-1 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xl md:text-2xl">📋</span>
                        <span className="text-[10px] md:text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded-full">Live</span>
                    </div>
                    <p className="text-lg md:text-2xl font-bold">{stats.orders}</p>
                    <p className="text-[10px] md:text-xs text-gray-400">Total Pesanan</p>
                </div>

                {/* Tables Card */}
                <div className="glass rounded-xl p-3 md:p-4 hover:transform hover:-translate-y-1 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xl md:text-2xl">🪑</span>
                    </div>
                    <p className="text-lg md:text-2xl font-bold">{stats.tables}</p>
                    <p className="text-[10px] md:text-xs text-gray-400">Meja Terisi</p>
                </div>

                {/* Customers Card */}
                <div className="glass rounded-xl p-3 md:p-4 hover:transform hover:-translate-y-1 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xl md:text-2xl">👥</span>
                    </div>
                    <p className="text-lg md:text-2xl font-bold">{stats.customers}</p>
                    <p className="text-[10px] md:text-xs text-gray-400">Pelanggan</p>
                </div>
            </div>

            {/* Charts & Ops Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Hourly Traffic Chart (2/3 width) */}
                <div className="glass rounded-xl p-4 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold">📊 Traffic Jam Sibuk (Hari Ini)</h3>
                        <div className="text-xs text-gray-400">08:00 - 22:00</div>
                    </div>
                    <div className="h-64 flex items-end justify-start gap-3 pb-2 overflow-x-auto custom-scrollbar px-2">
                        {hourlyData.map((data) => (
                            <div key={data.hour} className="flex flex-col items-center gap-1 shrink-0 min-w-[50px]">
                                <span className="text-xs text-gray-500">{data.orders > 0 ? data.orders : ''}</span>
                                <div
                                    className="w-full bg-gradient-to-t from-purple-600 to-blue-500 rounded-t-lg transition-all duration-500 hover:from-purple-500 hover:to-blue-400"
                                    style={{ height: `${(data.orders / maxOrders) * 100}%`, minHeight: data.orders > 0 ? '10px' : '2px' }}
                                />
                                <span className="text-xs text-gray-400">{data.hour}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Operational Widgets (1/3 width) */}
                <div className="space-y-6">
                    {/* Widget A: Top 5 Menu */}
                    <div className="glass rounded-xl p-4">
                        <h3 className="font-bold mb-3 flex items-center gap-2">
                            🏆 Top Menu Laris
                            <span className="text-xs text-gray-400 font-normal">(Hari Ini)</span>
                        </h3>
                        <div className="space-y-3">
                            {topMenuItems.length > 0 ? topMenuItems.map((item, index) => (
                                <div key={item.name} className="flex items-center gap-3">
                                    <span className="text-lg w-6">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}</span>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="truncate">{item.name}</span>
                                            <span className="text-purple-400 ml-2">{item.sold}</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                                                style={{ width: `${item.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center text-gray-500 text-sm py-4">Belum ada data</div>
                            )}
                        </div>
                    </div>

                    {/* Widget B: Low Stock Alert */}
                    <div className="glass rounded-xl p-4 border border-red-500/20">
                        <h3 className="font-bold mb-3 flex items-center gap-2 text-red-300">⚠️ Stok Menipis</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {lowStockItems.length > 0 ? (
                                lowStockItems.map((item) => (
                                    <div key={item.name} className="flex justify-between items-center p-2 bg-red-500/10 rounded-lg">
                                        <span className="text-sm">{item.name}</span>
                                        <span className="text-sm text-red-400">{item.stock} {item.unit}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-gray-500 text-sm py-4">Stok aman ✅</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction History */}
            <div className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold">📜 Riwayat Transaksi Hari Ini</h3>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="🔍 Cari Nama / Meja..."
                        className="bg-surface/50 border border-gray-700/50 rounded-lg px-3 py-1 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>

                <div className="overflow-x-auto">
                    <div className="max-h-[400px] overflow-y-auto pr-2">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-[#1a1625] z-10 shadow-sm shadow-black/20">
                                <tr className="text-gray-400 text-xs uppercase border-b border-gray-700/50">
                                    <th className="py-3 px-2">Waktu</th>
                                    <th className="py-3 px-2">Pelanggan</th>
                                    <th className="py-3 px-2">Tipe</th>
                                    <th className="py-3 px-2">Menu</th>
                                    <th className="py-3 px-2 text-right">Total</th>
                                    <th className="py-3 px-2 text-center">Metode</th>
                                    <th className="py-3 px-2 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-700/30">
                                {filteredTransactions.length > 0 ? filteredTransactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-purple-500/10 transition-colors">
                                        <td className="py-3 px-2 text-gray-400">{tx.time}</td>
                                        <td className="py-3 px-2">{tx.customer}{tx.table ? ` (Meja ${tx.table})` : ''}</td>
                                        <td className="py-3 px-2">
                                            <span className={`px-2 py-1 rounded-full text-xs ${tx.type === 'Dine In' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                                                }`}>
                                                {tx.type === 'Dine In' ? '🍽️' : '🥡'} {tx.type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 max-w-[200px] truncate">{tx.menu}</td>
                                        <td className="py-3 px-2 text-right font-medium text-green-400">{formatCurrency(tx.total)}</td>
                                        <td className="py-3 px-2 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs ${tx.method === 'cash' ? 'bg-green-500/20 text-green-400' :
                                                tx.method === 'qris' ? 'bg-purple-500/20 text-purple-400' :
                                                    'bg-blue-500/20 text-blue-400'
                                                }`}>
                                                {tx.method === 'cash' ? '💵' : tx.method === 'qris' ? '📱' : '🏦'} {tx.method.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs ${tx.status === 'done' ? 'bg-green-500/20 text-green-400' :
                                                tx.status === 'process' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {tx.status === 'done' ? '✅' : tx.status === 'process' ? '🔵' : '🟡'} {tx.status}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7" className="py-8 text-center text-gray-500">
                                            Belum ada transaksi hari ini
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Table Status */}
            <div className="glass rounded-xl p-4">
                <h3 className="font-bold mb-4">🪑 Status Meja</h3>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {tableStatuses.length > 0 ? tableStatuses.map((table) => (
                        <div
                            key={table.number}
                            className={`aspect-square rounded-xl flex items-center justify-center font-bold text-lg cursor-pointer transition-all duration-200 hover:scale-105 ${table.status === 'available'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}
                        >
                            {table.number}
                        </div>
                    )) : (
                        Array.from({ length: 12 }, (_, i) => (
                            <div
                                key={i + 1}
                                className="aspect-square rounded-xl flex items-center justify-center font-bold text-lg bg-gray-500/20 text-gray-400 border border-gray-500/30"
                            >
                                {i + 1}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
}

export default Dashboard;
