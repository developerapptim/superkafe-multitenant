import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiClock, FiShield, FiExternalLink, FiSmartphone, FiCopy } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { paymentAPI } from '../../services/api';
import usePlatform from '../../hooks/usePlatform';
import api from '../../services/api';

/**
 * Subscription Upgrade Page — Web-Only Checkout Strategy
 *
 * WEB BROWSER: Full billing page with pricing cards + payment button (Duitku)
 * MOBILE APP:  Status-only view with instruction to pay via browser
 */
const SubscriptionUpgrade = () => {
  const { isNative, isWeb } = usePlatform();
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('bisnis');
  const [processing, setProcessing] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);

  const tenantSlug = localStorage.getItem('tenant_slug');
  const billingUrl = `https://superkafe.com/${tenantSlug}/admin/subscription/upgrade`;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pricingRes, statusRes] = await Promise.all([
        paymentAPI.getPricing().catch(() => null),
        api.get(`/tenants/${tenantSlug}/trial-status`).catch(() => null)
      ]);

      if (pricingRes?.data?.success) setPricing(pricingRes.data.data);
      if (statusRes?.data?.success) setSubscriptionInfo(statusRes.data.data);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (isNative) return; // Safety: no payment on mobile
    setProcessing(true);

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      const response = await paymentAPI.createInvoice({
        tenantSlug,
        planType: selectedPlan,
        email: user.email || 'admin@example.com',
        customerName: user.name || 'Admin',
        phoneNumber: user.phone || '08123456789'
      });

      if (response.data.success) {
        toast.success('Membuka halaman pembayaran Duitku...');
        window.location.href = response.data.data.paymentUrl;
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error(error.response?.data?.error || 'Gagal membuat invoice pembayaran');
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(billingUrl).then(() => {
      toast.success('Link berhasil disalin!');
    }).catch(() => {
      toast.error('Gagal menyalin link');
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: pricing?.starter?.amount || 200000,
      duration: '/ Bulan',
      description: 'Solusi awal yang tepat untuk memulai digitalisasi kafe Anda.',
      features: [
        'Akses lengkap kasir (POS)',
        'Laporan penjualan',
        'Manajemen stok',
        'Support online'
      ]
    },
    {
      id: 'bisnis',
      name: 'Bisnis',
      originalPrice: 2400000,
      price: pricing?.bisnis?.amount || 1700000,
      duration: '/ Tahun',
      description: 'Pilihan favorit. Solusi komprehensif untuk operasional maksimal.',
      badge: 'DISKON 29%',
      features: [
        'Semua fitur Starter',
        'Laporan finansial komplit',
        'Multi-outlet (Coming Soon)',
        'Priority Support + Pelatihan'
      ]
    },
    {
      id: 'lifetime',
      name: 'Lifetime',
      price: pricing?.lifetime?.amount || 5500000,
      duration: 'Sekali Bayar',
      description: 'Bayar sekali, pakai selamanya. Pilihan investasi terbaik.',
      features: [
        'Semua fitur Bisnis',
        'Akses selamanya tanpa biaya tambahan',
        'Fitur eksklusif & prioritas rilis',
        'Priority Support'
      ]
    }
  ];

  // ===== MOBILE APP VIEW: Status only, no payment =====
  if (isNative) {
    return (
      <div className="h-full admin-bg-main p-6 admin-text-primary">
        <div className="max-w-lg mx-auto pb-10">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Status Langganan</h1>
            <p className="text-sm opacity-70">Kelola langganan Anda melalui browser web</p>
          </div>

          {/* Current Status Card */}
          {subscriptionInfo && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="backdrop-blur-xl admin-bg-sidebar border admin-border-accent rounded-2xl p-6 mb-6"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm opacity-70">Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${subscriptionInfo.canAccessFeatures
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                    }`}>
                    {subscriptionInfo.status === 'trial' ? 'Trial' :
                      subscriptionInfo.status === 'active' ? 'Aktif' :
                        subscriptionInfo.status === 'grace' ? 'Masa Tenggang' :
                          subscriptionInfo.status === 'expired' ? 'Kedaluwarsa' : subscriptionInfo.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm opacity-70">Paket</span>
                  <span className="font-bold text-purple-400">
                    {subscriptionInfo.planName || 'Trial'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm opacity-70">Berlaku Hingga</span>
                  <span className="font-medium">
                    {new Date(subscriptionInfo.expiresAt).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                </div>
                {subscriptionInfo.daysRemaining > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-70">Sisa Waktu</span>
                    <span className={`font-bold ${subscriptionInfo.daysRemaining <= 3 ? 'text-red-400' :
                        subscriptionInfo.daysRemaining <= 10 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                      {subscriptionInfo.daysRemaining} Hari
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Instruction Card (Mobile) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="backdrop-blur-xl rounded-2xl p-6 mb-4"
            style={{
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.2)',
            }}
          >
            <div className="flex items-start gap-3 mb-4">
              <FiSmartphone className="text-purple-400 mt-0.5 flex-shrink-0" size={22} />
              <div>
                <h3 className="font-bold text-sm mb-1">Perpanjang via Browser</h3>
                <p className="text-xs opacity-60 leading-relaxed">
                  Untuk menghindari biaya tambahan dari app store, pembayaran hanya tersedia melalui browser web. Buka link berikut:
                </p>
              </div>
            </div>
            <div
              className="flex items-center gap-2 p-3 rounded-xl mb-4"
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
            >
              <code className="text-purple-300 text-xs flex-1 break-all font-mono">
                superkafe.com/{tenantSlug}/admin/subscription/upgrade
              </code>
            </div>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
              }}
            >
              <FiCopy size={16} />
              Salin Link Pembayaran
            </button>
          </motion.div>

          {/* Subscription History */}
          {subscriptionInfo?.subscriptionHistory?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="backdrop-blur-xl admin-bg-sidebar border admin-border-accent rounded-2xl p-6"
            >
              <h3 className="font-bold text-sm mb-3 opacity-80">Riwayat Pembayaran</h3>
              <div className="space-y-3">
                {subscriptionInfo.subscriptionHistory.map((h, i) => (
                  <div key={i} className="flex justify-between items-center text-xs p-3 rounded-lg bg-black/10">
                    <div>
                      <p className="font-semibold capitalize">{h.plan}</p>
                      <p className="opacity-50 mt-0.5">
                        {new Date(h.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="font-bold text-green-400">
                      Rp {h.amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // ===== WEB BROWSER VIEW: Full billing with payment =====
  return (
    <div className="h-full admin-bg-main p-6 admin-text-primary">
      <div className="max-w-6xl mx-auto pb-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Pilih Paket Berlangganan
          </h1>
          <p className="text-lg opacity-80">
            Tingkatkan bisnis Anda dengan fitur lengkap dari SuperKafe
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              whileHover={{ scale: 1.02 }}
              className={`relative backdrop-blur-xl admin-bg-sidebar border-2 rounded-3xl p-8 shadow-xl transition-all cursor-pointer ${selectedPlan === plan.id
                ? 'border-purple-500 shadow-purple-500/30'
                : 'admin-border-accent hover:border-purple-300/50'
                }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="px-4 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-full shadow-lg whitespace-nowrap">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan Name */}
              <div className="text-center mb-6 mt-2">
                <h3 className="text-2xl font-bold mb-2">
                  {plan.name}
                </h3>
                <p className="text-sm opacity-70 px-2 h-10 flex items-center justify-center text-balance">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="text-center mb-6">
                {plan.originalPrice && (
                  <div className="text-sm opacity-50 line-through mb-1">
                    Rp {plan.originalPrice.toLocaleString('id-ID')}
                  </div>
                )}
                <div className="text-4xl font-bold text-amber-500 mb-2">
                  Rp {plan.price.toLocaleString('id-ID')}
                </div>
                <div className="text-sm opacity-80">{plan.duration}</div>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <FiCheck className="text-green-500 mt-1 flex-shrink-0" />
                    <span className="text-sm leading-relaxed opacity-90">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Select Indicator */}
              <div className="absolute bottom-6 left-0 right-0 px-8">
                <button className={`w-full py-3 rounded-xl font-bold transition-all ${selectedPlan === plan.id
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-inherit'
                  }`}>
                  {selectedPlan === plan.id ? 'Terpilih' : 'Pilih Paket'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Security Trust Badges */}
        <div className="backdrop-blur-xl admin-bg-sidebar border admin-border-accent rounded-2xl p-5 mb-6">
          <div className="grid md:grid-cols-3 gap-4 text-sm opacity-80">
            <div className="flex items-center gap-3 bg-black/10 p-3 rounded-xl">
              <FiShield className="text-purple-500 flex-shrink-0" size={20} />
              <span>Transaksi terenkripsi & aman</span>
            </div>
            <div className="flex items-center gap-3 bg-black/10 p-3 rounded-xl">
              <FiCheck className="text-purple-500 flex-shrink-0" size={20} />
              <span>Aktivasi otomatis setelah pembayaran</span>
            </div>
            <div className="flex items-center gap-3 bg-black/10 p-3 rounded-xl">
              <FiClock className="text-purple-500 flex-shrink-0" size={20} />
              <span>Invoice berlaku 60 menit</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center pt-4">
          <button
            onClick={handleUpgrade}
            disabled={processing}
            className="w-full md:w-auto px-16 py-4 rounded-xl text-lg font-bold admin-button-primary hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-1"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Membuka Halaman Pembayaran...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <FiExternalLink size={20} />
                Lanjutkan Pembayaran Sekarang
              </span>
            )}
          </button>
          <p className="text-sm opacity-60 mt-4">
            Anda akan diarahkan ke halaman pembayaran resmi Duitku untuk memilih metode pembayaran
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionUpgrade;
