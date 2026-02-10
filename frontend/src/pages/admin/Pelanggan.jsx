import { useState, useEffect } from 'react';
import { customersAPI, settingsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const InsightModal = ({ customer, analytics, onClose, onUpdateTags }) => {
    const [tagInput, setTagInput] = useState('');
    if (!customer || !analytics) return null;

    const { persona, topMenus, recentHistory, tags } = analytics;

    // Determine Gradient based on Persona
    const getPersonaGradient = (label) => {
        switch (label) {
            case 'Morning Person': return 'from-orange-400 to-yellow-300';
            case 'Pejuang Siang': return 'from-blue-400 to-cyan-300';
            case 'Anak Senja': return 'from-purple-500 to-orange-400';
            case 'Sobat Begadang': return 'from-indigo-900 to-purple-800';
            default: return 'from-gray-700 to-gray-600';
        }
    };

    const handleAddTag = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            if (!tags.includes(tagInput.trim())) {
                onUpdateTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove) => {
        onUpdateTags(tags.filter(t => t !== tagToRemove));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-white/10 text-white z-10 transition-colors"
                >
                    ✕
                </button>

                {/* HERO SECTION: Persona */}
                <div className={`relative p-8 overflow-hidden bg-gradient-to-r ${getPersonaGradient(persona.label)}`}>
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-white">
                        <div className="text-6xl md:text-8xl filter drop-shadow-lg animate-bounce-slow">
                            {persona.icon}
                        </div>
                        <div className="text-center md:text-left">
                            <h2 className="text-3xl md:text-4xl font-bold mb-2 drop-shadow-md">{persona.label}</h2>
                            <p className="text-white/90 text-lg max-w-md leading-relaxed">{persona.description}</p>
                            <div className="mt-4 inline-flex items-center gap-2 bg-black/20 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                                <span className="font-bold">{customer.name}</span>
                                <span className="text-white/60">|</span>
                                <span className="text-sm opacity-90">{customer.tier.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                    {/* Decorative Circles */}
                    <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-black/10 rounded-full blur-2xl"></div>
                </div>

                <div className="p-6 md:p-8 space-y-8">
                    {/* SECTION: Top Menus */}
                    <div>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span>🏆</span> Menu Favorit
                        </h3>
                        {topMenus.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {topMenus.map((menu, idx) => (
                                    <div key={idx} className="bg-surface p-4 rounded-xl border border-white/5 flex items-center gap-4 hover:border-purple-500/30 transition-colors group">
                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold
                                            ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                                idx === 1 ? 'bg-gray-400/20 text-gray-400' :
                                                    'bg-orange-600/20 text-orange-500'}`}>
                                            #{idx + 1}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white group-hover:text-purple-400 transition-colors line-clamp-1">{menu._id}</p>
                                            <p className="text-sm text-gray-400">Dipesan {menu.totalQty}x</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic">Belum ada data favorit.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* SECTION: Manual Tags */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <span>🏷️</span> Tags & Catatan
                            </h3>
                            <div className="bg-surface p-4 rounded-xl border border-white/5 space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    {tags.map((tag, idx) => (
                                        <span key={idx} className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-sm flex items-center gap-2">
                                            {tag}
                                            <button onClick={() => handleRemoveTag(tag)} className="hover:text-white">×</button>
                                        </span>
                                    ))}
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={handleAddTag}
                                        placeholder="+ Tag (Enter)"
                                        className="bg-transparent text-sm focus:outline-none min-w-[100px] text-gray-300 placeholder-gray-600"
                                    />
                                </div>
                                <p className="text-xs text-gray-500">Tekan Enter untuk menambah tag baru.</p>
                            </div>
                        </div>

                        {/* SECTION: Recent History */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <span>🕒</span> Riwayat Terakhir
                            </h3>
                            <div className="bg-surface rounded-xl border border-white/5 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white/5 text-gray-400">
                                        <tr>
                                            <th className="p-3">Waktu</th>
                                            <th className="p-3 text-right">Total</th>
                                            <th className="p-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {recentHistory.map((order, idx) => (
                                            <tr key={idx}>
                                                <td className="p-3 text-gray-300">
                                                    {new Date(order.timestamp).toLocaleDateString()}<br />
                                                    <span className="text-xs text-gray-500">{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </td>
                                                <td className="p-3 text-right font-mono">
                                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(order.total)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === 'done' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {recentHistory.length === 0 && (
                                            <tr>
                                                <td colSpan="3" className="p-4 text-center text-gray-500">Belum ada riwayat.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

function Pelanggan() {
    const [activeTab, setActiveTab] = useState('data');
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);

    // Analytics & Insight State
    const [showInsightModal, setShowInsightModal] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [analyticsData, setAnalyticsData] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        tier: 'bronze',
        points: 0,
        totalSpending: 0
    });

    const [loyaltySettings, setLoyaltySettings] = useState({
        enabled: true,
        pointRatio: 10000,
        silverThreshold: 500000,
        goldThreshold: 2000000
    });

    const tabs = [
        { id: 'data', label: '📋 Data Pelanggan' },
        { id: 'leaderboard', label: '🏆 Leaderboard' },
        { id: 'churn', label: '⚠️ Churn Alert' },
        { id: 'settings', label: '⚙️ Pengaturan' }
    ];

    const tiers = [
        { value: 'bronze', label: '🥉 Bronze', color: 'text-orange-400' },
        { value: 'silver', label: '🥈 Silver', color: 'text-gray-300' },
        { value: 'gold', label: '🥇 Gold', color: 'text-yellow-400' }
    ];

    useEffect(() => {
        fetchCustomers();
        fetchLoyaltySettings();
    }, []);

    const fetchLoyaltySettings = async () => {
        try {
            const res = await settingsAPI.get();
            const settings = res.data;
            if (settings?.loyaltySettings) {
                setLoyaltySettings({
                    enabled: settings.loyaltySettings.enableLoyalty !== false,
                    pointRatio: settings.loyaltySettings.pointRatio || 10000,
                    silverThreshold: settings.loyaltySettings.tierThresholds?.silver || 500000,
                    goldThreshold: settings.loyaltySettings.tierThresholds?.gold || 2000000
                });
            }
        } catch (err) {
            console.error('Error fetching loyalty settings:', err);
        }
    };

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const res = await customersAPI.getAll();
            // Handle { data: [], total: ... } vs []
            const data = res.data.data && Array.isArray(res.data.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
            setCustomers(data);
        } catch (err) {
            console.error('Error fetching customers:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(value || 0);
    };

    // Filter customers by search
    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
    );

    // Get leaderboard (sorted by totalSpent)
    const leaderboard = [...customers].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)).slice(0, 10);

    // Get churn risk (inactive for 30+ days)
    const now = new Date();
    const churnRisk = customers.filter(c => {
        if (!c.lastOrderDate) return true;
        const lastVisit = new Date(c.lastOrderDate);
        const daysSince = Math.floor((now - lastVisit) / (1000 * 60 * 60 * 24));
        return daysSince >= 30;
    });

    const getTierInfo = (tier) => tiers.find(t => t.value === tier) || tiers[0];

    const openAddModal = () => {
        setFormData({
            name: '',
            phone: '',
            email: '',
            tier: 'bronze',
            points: 0,
            totalSpending: 0
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            alert('Nama dan No HP wajib diisi');
            return;
        }
        try {
            await customersAPI.create({
                ...formData,
                id: `cust_${Date.now()}`
            });
            await fetchCustomers();
            setShowModal(false);
        } catch (err) {
            console.error('Error saving customer:', err);
            alert('Gagal menyimpan pelanggan');
        }
    };

    const saveLoyaltySettings = async () => {
        try {
            await settingsAPI.updateLoyalty({
                enableLoyalty: loyaltySettings.enabled,
                pointRatio: Number(loyaltySettings.pointRatio),
                tierThresholds: {
                    silver: Number(loyaltySettings.silverThreshold),
                    gold: Number(loyaltySettings.goldThreshold)
                }
            });
            alert('✅ Pengaturan loyalty berhasil disimpan!');
        } catch (err) {
            console.error('Error saving loyalty settings:', err);
            alert('❌ Gagal menyimpan pengaturan');
        }
    };

    // Fetch Analytics
    const handleCustomerClick = async (customer) => {
        const toastId = toast.loading('Memuat insight pelanggan...');
        try {
            const res = await customersAPI.getAnalytics(customer.id);
            setAnalyticsData(res.data);
            setSelectedCustomer(customer);
            setShowInsightModal(true);
            toast.dismiss(toastId);
        } catch (err) {
            console.error("Analytics Error:", err);
            toast.error("Gagal memuat data insight", { id: toastId });
        }
    };

    // Update Tags
    const handleUpdateTags = async (newTags) => {
        try {
            // Optimistic update
            setAnalyticsData(prev => ({ ...prev, tags: newTags }));

            await customersAPI.update(selectedCustomer.id, {
                tags: newTags
            });
            toast.success('Tags diperbarui');

            // Refresh customer list to keep sync? Optional but good.
            // fetchCustomers(); 
        } catch (err) {
            console.error(err);
            toast.error('Gagal update tags');
        }
    };

    return (
        <section className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                <button
                    onClick={openAddModal}
                    className="w-full md:w-auto bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                >
                    <span>➕</span> Tambah Pelanggan
                </button>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center ${activeTab === tab.id
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
            ) : (
                <>
                    {/* TAB 1: Data Pelanggan */}
                    {activeTab === 'data' && (
                        <div className="space-y-4">
                            <div className="glass rounded-xl p-4">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                    placeholder="🔍 Cari pelanggan (nama/HP)..."
                                />
                            </div>
                            <div className="glass rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white/5">
                                            <tr className="text-left text-gray-400">
                                                <th className="px-4 py-3">Nama</th>
                                                <th className="px-4 py-3">No HP</th>
                                                <th className="px-4 py-3">Tier</th>
                                                <th className="px-4 py-3 text-right">Poin</th>
                                                <th className="px-4 py-3 text-right">Total Belanja</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredCustomers.length === 0 ? (
                                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">
                                                    <div className="text-4xl mb-2">👥</div>
                                                    <p>Belum ada data pelanggan</p>
                                                </td></tr>
                                            ) : (
                                                filteredCustomers.map(c => {
                                                    const tierInfo = getTierInfo(c.tier);
                                                    return (
                                                        <tr
                                                            key={c.id}
                                                            className="hover:bg-white/5 cursor-pointer transition-colors"
                                                            onClick={() => handleCustomerClick(c)}
                                                            title="Klik untuk lihat insight"
                                                        >
                                                            <td className="px-4 py-3 font-medium">
                                                                {c.name}
                                                                {c.tags && c.tags.includes('VIP') && <span className="ml-2 text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/30">VIP</span>}
                                                            </td>
                                                            <td className="px-4 py-3">{c.phone || '-'}</td>
                                                            <td className={`px-4 py-3 ${tierInfo.color}`}>{tierInfo.label}</td>
                                                            <td className="px-4 py-3 text-right">{c.points || 0}</td>
                                                            <td className="px-4 py-3 text-right">{formatCurrency(c.totalSpent)}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">Aktif</span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: Leaderboard */}
                    {activeTab === 'leaderboard' && (
                        <div className="glass rounded-xl p-4">
                            <h3 className="font-bold mb-4">🏆 Top Pelanggan</h3>
                            <div className="space-y-3">
                                {leaderboard.length === 0 ? (
                                    <p className="text-center text-gray-400 py-4">Belum ada data</p>
                                ) : (
                                    leaderboard.map((c, idx) => (
                                        <div key={c.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-600' : 'bg-white/20'
                                                }`}>
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1">
                                                <p className="font-medium">{c.name}</p>
                                                <p className="text-xs text-gray-400">{c.phone}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-green-400">{formatCurrency(c.totalSpent)}</p>
                                                <p className="text-xs text-gray-400">{c.points || 0} poin</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: Churn Alert */}
                    {activeTab === 'churn' && (
                        <div className="glass rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-purple-500/20">
                                <h3 className="font-bold">⚠️ Pelanggan Berisiko Churn</h3>
                                <p className="text-xs text-gray-400">Tidak berkunjung lebih dari 30 hari</p>
                            </div>
                            <div className="divide-y divide-purple-500/10">
                                {churnRisk.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400">
                                        <div className="text-4xl mb-2">✅</div>
                                        <p>Tidak ada pelanggan berisiko churn</p>
                                    </div>
                                ) : (
                                    churnRisk.slice(0, 10).map(c => (
                                        <div key={c.id} className="p-4 flex items-center justify-between">
                                            <div>
                                                <p className="font-medium">{c.name}</p>
                                                <p className="text-xs text-gray-400">{c.phone}</p>
                                            </div>
                                            <button className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-sm">
                                                📱 Hubungi
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 4: Pengaturan Loyalty */}
                    {activeTab === 'settings' && (
                        <div className="glass rounded-xl p-6">
                            <h3 className="font-bold text-lg mb-4">⚙️ Pengaturan Program Loyalty</h3>
                            <div className="space-y-6">
                                {/* Enable Toggle */}
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                                    <div>
                                        <p className="font-medium">Aktifkan Program Loyalty</p>
                                        <p className="text-sm text-gray-400">Pelanggan mendapat poin setiap transaksi</p>
                                    </div>
                                    <button
                                        onClick={() => setLoyaltySettings({ ...loyaltySettings, enabled: !loyaltySettings.enabled })}
                                        className={`w-12 h-6 rounded-full transition-all ${loyaltySettings.enabled ? 'bg-purple-600' : 'bg-gray-600'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white transition-all ${loyaltySettings.enabled ? 'ml-6' : 'ml-0.5'}`}></div>
                                    </button>
                                </div>

                                {/* Point Ratio */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Rasio Poin (Rp per 1 Poin)</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400">Rp</span>
                                        <input
                                            type="number"
                                            value={loyaltySettings.pointRatio}
                                            onChange={(e) => setLoyaltySettings({ ...loyaltySettings, pointRatio: e.target.value })}
                                            className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                        />
                                        <span className="text-gray-400">= 1 Poin</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Contoh: Transaksi Rp 50.000 → 5 Poin</p>
                                </div>

                                {/* Tier Thresholds */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">🥈 Batas Silver (Total Spending)</label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400">Rp</span>
                                            <input
                                                type="number"
                                                value={loyaltySettings.silverThreshold}
                                                onChange={(e) => setLoyaltySettings({ ...loyaltySettings, silverThreshold: e.target.value })}
                                                className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">🥇 Batas Gold (Total Spending)</label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400">Rp</span>
                                            <input
                                                type="number"
                                                value={loyaltySettings.goldThreshold}
                                                onChange={(e) => setLoyaltySettings({ ...loyaltySettings, goldThreshold: e.target.value })}
                                                className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={saveLoyaltySettings}
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-bold"
                                >
                                    💾 Simpan Pengaturan
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Add Customer Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="glass rounded-2xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold">➕ Tambah Pelanggan</h3>
                            <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Nama *</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white" required />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">No HP *</label>
                                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white" required />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Email</label>
                                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-purple-500/30 text-white" />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-lg bg-white/10">Batal</button>
                                <button type="submit" className="flex-1 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 font-bold">💾 Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* INSIGHT MODAL */}
            {showInsightModal && selectedCustomer && analyticsData && (
                <InsightModal
                    customer={selectedCustomer}
                    analytics={analyticsData}
                    onClose={() => setShowInsightModal(false)}
                    onUpdateTags={handleUpdateTags}
                />
            )}
        </section>
    );
}

export default Pelanggan;
