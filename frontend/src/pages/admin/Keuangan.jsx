import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import SmartText from '../../components/SmartText';
import CustomSelect from '../../components/CustomSelect';
import { cashTransactionsAPI, cashAnalyticsAPI, debtsAPI, employeesAPI } from '../../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

function Keuangan() {
    // State
    const [activeTab, setActiveTab] = useState('ringkasan');
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    // Analytics & Breakdown
    const [analytics, setAnalytics] = useState({ dailyData: [], totalIncome: 0, totalExpense: 0, netProfit: 0 });
    const [breakdown, setBreakdown] = useState({ cashBalance: 0, nonCashBalance: 0, totalKasbon: 0, totalPiutang: 0 });

    // Debts
    const [debts, setDebts] = useState([]);
    const [employees, setEmployees] = useState([]);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('transaction'); // 'transaction' | 'kasbon' | 'piutang'
    const [formData, setFormData] = useState({
        type: 'in',
        amount: '',
        description: '',
        category: '',
        paymentMethod: 'cash',
        personName: ''
    });

    const categories = {
        in: ['Penjualan', 'Modal', 'Lainnya'],
        out: ['Belanja Bahan', 'Gaji Pegawai', 'Operasional', 'Marketing', 'Listrik/Air', 'Lainnya']
    };

    // Fetch data
    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const [transRes, analyticsRes, breakdownRes, debtsRes, empRes] = await Promise.all([
                cashTransactionsAPI.getAll(),
                cashAnalyticsAPI.getAnalytics(),
                cashAnalyticsAPI.getBreakdown(),
                debtsAPI.getAll(),
                employeesAPI.getAll()
            ]);

            setTransactions(Array.isArray(transRes.data) ? transRes.data : []);
            setAnalytics(analyticsRes.data || { dailyData: [], totalIncome: 0, totalExpense: 0, netProfit: 0 });
            setBreakdown(breakdownRes.data || { cashBalance: 0, nonCashBalance: 0, totalKasbon: 0, totalPiutang: 0 });
            setDebts(Array.isArray(debtsRes.data) ? debtsRes.data : []);
            setEmployees(Array.isArray(empRes.data) ? empRes.data : []);
        } catch (err) {
            console.error('Error fetching data:', err);
            toast.error('Gagal memuat data keuangan');
        } finally {
            setLoading(false);
        }
    };

    // Filter transactions
    const filteredTransactions = transactions.filter(t => {
        if (filter === 'all') return true;
        return t.type === filter;
    });

    // Format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    // Format date
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Open modal
    const openModal = (type, transType = 'in') => {
        setModalType(type);
        setFormData({
            type: transType,
            amount: '',
            description: '',
            category: categories[transType][0],
            paymentMethod: 'cash',
            personName: ''
        });
        setShowModal(true);
    };

    // Handle form submit
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.amount) {
            toast.error('Jumlah wajib diisi');
            return;
        }

        try {
            if (modalType === 'transaction') {
                await cashTransactionsAPI.create({
                    type: formData.type,
                    amount: Number(formData.amount),
                    category: formData.category,
                    description: formData.description,
                    paymentMethod: formData.paymentMethod
                });
                toast.success('Transaksi berhasil disimpan');
            } else {
                // Kasbon or Piutang
                await debtsAPI.create({
                    type: modalType,
                    personName: formData.personName,
                    amount: Number(formData.amount),
                    description: formData.description
                });
                toast.success(`${modalType === 'kasbon' ? 'Kasbon' : 'Piutang'} berhasil dicatat`);
            }

            await fetchAllData();
            setShowModal(false);
        } catch (err) {
            console.error('Error saving:', err);
            toast.error('Gagal menyimpan');
        }
    };

    // Handle delete transaction
    const handleDeleteTransaction = async (id) => {
        if (!confirm('Hapus transaksi ini?')) return;
        try {
            await cashTransactionsAPI.delete(id);
            toast.success('Transaksi dihapus');
            await fetchAllData();
        } catch (err) {
            toast.error('Gagal menghapus');
        }
    };

    // Handle settle debt
    const handleSettleDebt = async (id) => {
        if (!confirm('Tandai lunas? Saldo kas akan disesuaikan.')) return;
        try {
            await debtsAPI.settle(id);
            toast.success('Berhasil dilunasi!');
            await fetchAllData();
        } catch (err) {
            toast.error('Gagal melunasi');
        }
    };

    // Handle delete debt
    const handleDeleteDebt = async (id) => {
        if (!confirm('Hapus hutang ini?')) return;
        try {
            await debtsAPI.delete(id);
            toast.success('Hutang dihapus');
            await fetchAllData();
        } catch (err) {
            toast.error('Gagal menghapus');
        }
    };

    // Pending debts
    const pendingDebts = debts.filter(d => d.status === 'pending');

    if (loading) {
        return (
            <section className="p-4 md:p-6 space-y-6">

                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            </section>
        );
    }

    return (
        <section className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-end flex-wrap gap-4">
                {/* <h2 className="text-2xl font-bold hidden md:block">💰 Keuangan & Kas</h2> - Moved to Header */}
                <button
                    onClick={() => openModal('transaction', 'in')}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                >
                    <span>➕</span> Tambah Transaksi
                </button>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-3 gap-1 border-b border-purple-500/30 pb-1">
                {[
                    { id: 'ringkasan', label: '📊 Ringkasan' },
                    { id: 'transaksi', label: '📋 Transaksi' },
                    { id: 'hutang', label: '📒 Hutang' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-1 py-2 md:px-4 rounded-t-lg transition-colors font-medium text-xs md:text-sm truncate ${activeTab === tab.id
                            ? 'bg-purple-600 text-white'
                            : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ==================== RINGKASAN TAB ==================== */}
            {activeTab === 'ringkasan' && (
                <div className="space-y-6">
                    {/* Main Profit Card */}
                    <div className={`glass rounded-xl p-4 md:p-6 border-2 ${analytics.netProfit >= 0 ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'}`}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <p className="text-xs md:text-sm text-gray-400 mb-1">📈 Estimasi Laba Bersih</p>
                                <SmartText className={`text-xl md:text-4xl font-bold ${analytics.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatCurrency(analytics.netProfit)}
                                </SmartText>
                                <p className="text-[10px] md:text-xs text-gray-500 mt-2">= Penjualan - HPP - Biaya Operasional</p>
                            </div>
                            <div className="text-left md:text-right text-xs md:text-sm space-y-1 border-t border-white/5 pt-2 md:border-0 md:pt-0">
                                <p><span className="text-gray-500 mr-2 md:mr-0">Laba Kotor:</span> <span className="text-teal-400 font-medium">{formatCurrency(analytics.grossProfit || 0)}</span></p>
                                <p className="text-[10px] md:text-xs text-gray-500">(Penjualan - HPP)</p>
                            </div>
                        </div>
                    </div>

                    {/* Income/Expense Breakdown */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        {/* Total Penjualan */}
                        <div className="glass rounded-xl p-3 md:p-5">
                            <p className="text-[10px] md:text-xs text-gray-500 mb-1">💰 Total Penjualan</p>
                            <SmartText className="text-lg md:text-xl font-bold text-green-400">{formatCurrency(analytics.totalSales || 0)}</SmartText>
                        </div>

                        {/* HPP */}
                        <div className="glass rounded-xl p-3 md:p-5 border border-orange-500/30">
                            <p className="text-[10px] md:text-xs text-gray-500 mb-1">🏭 HPP (Modal Bahan)</p>
                            <SmartText className="text-lg md:text-xl font-bold text-orange-400">{formatCurrency(analytics.totalHPP || 0)}</SmartText>
                        </div>

                        {/* Biaya Operasional */}
                        <div className="glass rounded-xl p-3 md:p-5">
                            <p className="text-[10px] md:text-xs text-gray-500 mb-1">📤 Biaya Operasional</p>
                            <SmartText className="text-lg md:text-xl font-bold text-red-400">{formatCurrency(analytics.totalOperationalExpense || 0)}</SmartText>
                        </div>

                        {/* Hutang Belum Lunas */}
                        <div className="glass rounded-xl p-3 md:p-5 border border-yellow-500/30">
                            <p className="text-[10px] md:text-xs text-gray-500 mb-1">⚠️ Hutang Aktif</p>
                            <SmartText className="text-lg md:text-xl font-bold text-yellow-400">
                                {formatCurrency(breakdown.totalKasbon + breakdown.totalPiutang)}
                            </SmartText>
                            <p className="text-[10px] md:text-xs text-gray-600 mt-1 truncate">
                                Kasbon: {formatCurrency(breakdown.totalKasbon)}
                            </p>
                        </div>
                    </div>

                    {/* Cash Flow Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="glass rounded-xl p-6 border border-green-500/30">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-3xl">💵</span>
                                <div>
                                    <p className="text-sm text-gray-400">Saldo Tunai (Cash)</p>
                                    <p className="text-2xl font-bold text-green-400">{formatCurrency(breakdown.cashBalance)}</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">Uang fisik di laci kasir (sudah dikurangi kasbon aktif)</p>
                        </div>

                        <div className="glass rounded-xl p-6 border border-blue-500/30">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-3xl">📱</span>
                                <div>
                                    <p className="text-sm text-gray-400">Saldo Digital (Non-Cash)</p>
                                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(breakdown.nonCashBalance)}</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">Dana di Bank / E-Wallet (QRIS, Transfer)</p>
                        </div>
                    </div>

                    {/* 7-Day Trend Chart */}
                    <div className="glass rounded-xl p-6">
                        <h3 className="font-bold mb-4">📊 Tren 7 Hari Terakhir</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={analytics.dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                                    <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #6B21A8', borderRadius: '8px' }}
                                        labelStyle={{ color: '#fff' }}
                                        formatter={(value) => formatCurrency(value)}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="income" name="Pemasukan" stroke="#22C55E" strokeWidth={3} dot={{ fill: '#22C55E' }} />
                                    <Line type="monotone" dataKey="expense" name="Pengeluaran" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== TRANSAKSI TAB ==================== */}
            {activeTab === 'transaksi' && (
                <div className="space-y-4">
                    {/* Quick Actions */}
                    <div className="flex gap-3 flex-wrap">
                        <button
                            onClick={() => openModal('transaction', 'in')}
                            className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center gap-2"
                        >
                            <span>📥</span> Kas Masuk
                        </button>
                        <button
                            onClick={() => openModal('transaction', 'out')}
                            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center gap-2"
                        >
                            <span>📤</span> Kas Keluar
                        </button>
                    </div>

                    {/* Transaction List */}
                    <div className="glass rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-purple-500/20 flex items-center justify-between">
                            <h3 className="font-bold">📋 Riwayat Transaksi</h3>
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="px-3 py-1 rounded-lg bg-white/10 border border-purple-500/30 text-sm text-white"
                            >
                                <option value="all">Semua</option>
                                <option value="in">Kas Masuk</option>
                                <option value="out">Kas Keluar</option>
                            </select>
                        </div>
                        <div className="divide-y divide-purple-500/10 max-h-[500px] overflow-auto">
                            {filteredTransactions.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <div className="text-4xl mb-2">📋</div>
                                    <p>Belum ada transaksi</p>
                                </div>
                            ) : (
                                filteredTransactions.map(t => (
                                    <div key={t.id} className="p-4 flex items-center justify-between hover:bg-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.type === 'in' ? 'bg-green-500/20' : 'bg-red-500/20'
                                                }`}>
                                                <span className="text-lg">{t.type === 'in' ? '📥' : '📤'}</span>
                                            </div>
                                            <div>
                                                <SmartText className="font-medium">{t.description || t.category}</SmartText>
                                                <p className="text-xs text-gray-400">
                                                    {t.category && <span className="mr-2 px-2 py-0.5 bg-purple-500/20 rounded">{t.category}</span>}
                                                    <span className={`mr-2 px-2 py-0.5 rounded ${t.paymentMethod === 'cash' ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
                                                        {t.paymentMethod === 'cash' ? '💵 Cash' : '📱 Digital'}
                                                    </span>
                                                    {formatDate(t.date)} {t.time && `• ${t.time}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-lg font-bold ${t.type === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                                                {t.type === 'in' ? '+' : '-'}{formatCurrency(t.amount)}
                                            </span>
                                            <button
                                                onClick={() => handleDeleteTransaction(t.id)}
                                                className="p-2 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                title="Hapus"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== BUKU HUTANG TAB ==================== */}
            {activeTab === 'hutang' && (
                <div className="space-y-6">
                    {/* Quick Actions */}
                    <div className="flex gap-3 flex-wrap">
                        <button
                            onClick={() => openModal('kasbon')}
                            className="px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 flex items-center gap-2"
                        >
                            <span>👤</span> Kasbon Pegawai
                        </button>
                        <button
                            onClick={() => openModal('piutang')}
                            className="px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 flex items-center gap-2"
                        >
                            <span>🧾</span> Piutang Pelanggan
                        </button>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="glass rounded-xl p-5 border border-orange-500/30">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-400">👤 Total Kasbon Aktif</p>
                                    <p className="text-2xl font-bold text-orange-400">{formatCurrency(breakdown.totalKasbon)}</p>
                                </div>
                                <span className="text-4xl opacity-30">💸</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Uang dipinjam pegawai (mengurangi kas)</p>
                        </div>
                        <div className="glass rounded-xl p-5 border border-yellow-500/30">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-400">🧾 Total Piutang Aktif</p>
                                    <p className="text-2xl font-bold text-yellow-400">{formatCurrency(breakdown.totalPiutang)}</p>
                                </div>
                                <span className="text-4xl opacity-30">📝</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Hutang pelanggan (aset belum masuk kas)</p>
                        </div>
                    </div>

                    {/* Debt List */}
                    <div className="glass rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-purple-500/20">
                            <h3 className="font-bold">📒 Daftar Hutang Belum Lunas</h3>
                        </div>
                        <div className="divide-y divide-purple-500/10 max-h-[400px] overflow-auto">
                            {pendingDebts.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    <div className="text-4xl mb-2">✅</div>
                                    <p>Tidak ada hutang aktif</p>
                                </div>
                            ) : (
                                pendingDebts.map(d => (
                                    <div key={d.id} className="p-4 flex items-center justify-between hover:bg-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${d.type === 'kasbon' ? 'bg-orange-500/20' : 'bg-yellow-500/20'
                                                }`}>
                                                <span className="text-lg">{d.type === 'kasbon' ? '👤' : '🧾'}</span>
                                            </div>
                                            <div>
                                                <p className="font-medium">{d.personName}</p>
                                                <p className="text-xs text-gray-400">
                                                    <span className={`mr-2 px-2 py-0.5 rounded ${d.type === 'kasbon' ? 'bg-orange-500/20 text-orange-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                                        {d.type === 'kasbon' ? 'Kasbon' : 'Piutang'}
                                                    </span>
                                                    {d.description && <span className="mr-2">{d.description}</span>}
                                                    {formatDate(d.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg font-bold text-white">{formatCurrency(d.amount)}</span>
                                            <button
                                                onClick={() => handleSettleDebt(d.id)}
                                                className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 text-sm font-medium"
                                            >
                                                ✅ Lunas
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDebt(d.id)}
                                                className="p-2 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                title="Hapus"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== MODAL ==================== */}
            {showModal && createPortal(
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="glass rounded-2xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold">
                                {modalType === 'transaction'
                                    ? (formData.type === 'in' ? '📥 Kas Masuk' : '📤 Kas Keluar')
                                    : modalType === 'kasbon'
                                        ? '👤 Kasbon Pegawai'
                                        : '🧾 Piutang Pelanggan'
                                }
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center text-gray-400 hover:text-red-400"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Type Toggle (only for transactions) */}
                            {modalType === 'transaction' && (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'in', category: categories.in[0] })}
                                        className={`flex-1 py-2 rounded-lg font-medium transition-all ${formData.type === 'in' ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400'
                                            }`}
                                    >
                                        📥 Masuk
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'out', category: categories.out[0] })}
                                        className={`flex-1 py-2 rounded-lg font-medium transition-all ${formData.type === 'out' ? 'bg-red-500 text-white' : 'bg-white/10 text-gray-400'
                                            }`}
                                    >
                                        📤 Keluar
                                    </button>
                                </div>
                            )}

                            {/* Person Name (for debts) */}
                            {(modalType === 'kasbon' || modalType === 'piutang') && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">
                                        {modalType === 'kasbon' ? 'Nama Pegawai *' : 'Nama Pelanggan *'}
                                    </label>
                                    {modalType === 'kasbon' && employees.length > 0 ? (
                                        <CustomSelect
                                            value={formData.personName}
                                            options={employees.map(emp => ({ value: emp.name, label: emp.name }))}
                                            onChange={(val) => setFormData({ ...formData, personName: val })}
                                            placeholder="Pilih Pegawai"
                                            required
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={formData.personName}
                                            onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                            placeholder={modalType === 'kasbon' ? 'Nama pegawai' : 'Nama pelanggan'}
                                            required
                                        />
                                    )}
                                </div>
                            )}

                            {/* Amount */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Jumlah (Rp) *</label>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-purple-500/30 text-white text-xl font-bold focus:outline-none focus:border-purple-500"
                                    placeholder="0"
                                    required
                                />
                            </div>

                            {/* Category (only for transactions) */}
                            {modalType === 'transaction' && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Kategori</label>
                                    <CustomSelect
                                        value={formData.category}
                                        options={categories[formData.type].map(cat => ({ value: cat, label: cat }))}
                                        onChange={(val) => setFormData({ ...formData, category: val })}
                                        placeholder="Pilih Kategori"
                                    />
                                </div>
                            )}

                            {/* Payment Method (only for Kas Keluar) */}
                            {modalType === 'transaction' && formData.type === 'out' && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Metode Pembayaran</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, paymentMethod: 'cash' })}
                                            className={`flex-1 py-2 rounded-lg font-medium transition-all ${formData.paymentMethod === 'cash' ? 'bg-green-500/30 text-green-300 border border-green-500' : 'bg-white/10 text-gray-400'
                                                }`}
                                        >
                                            💵 Tunai
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, paymentMethod: 'non-cash' })}
                                            className={`flex-1 py-2 rounded-lg font-medium transition-all ${formData.paymentMethod === 'non-cash' ? 'bg-blue-500/30 text-blue-300 border border-blue-500' : 'bg-white/10 text-gray-400'
                                                }`}
                                        >
                                            📱 Digital
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Keterangan</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
                                    placeholder="Opsional: catatan tambahan"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className={`flex-1 px-4 py-3 rounded-lg font-bold ${modalType === 'transaction'
                                        ? formData.type === 'in'
                                            ? 'bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600'
                                            : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                                        : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600'
                                        }`}
                                >
                                    💾 Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                , document.body)}
        </section>
    );
}

export default Keuangan;
