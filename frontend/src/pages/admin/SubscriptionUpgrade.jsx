import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiCreditCard, FiClock, FiShield } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { paymentAPI } from '../../services/api';

/**
 * Subscription Upgrade Page
 * Halaman untuk upgrade dari trial ke paid subscription
 */
const SubscriptionUpgrade = () => {
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('bisnis');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('NQ'); // Default: QRIS
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      const response = await paymentAPI.getPricing();
      if (response.data.success) {
        setPricing(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
      toast.error('Gagal memuat informasi harga');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setProcessing(true);

    try {
      const tenantSlug = localStorage.getItem('tenant_slug');
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      // Kirim planType dan paymentMethod — harga dihitung AMAN di backend
      const response = await paymentAPI.createInvoice({
        tenantSlug,
        planType: selectedPlan,
        paymentMethod: selectedPaymentMethod,
        email: user.email || 'admin@example.com',
        customerName: user.name || 'Admin',
        phoneNumber: user.phone || '08123456789'
      });

      if (response.data.success) {
        toast.success('Membuka gateway pembayaran...');
        window.location.href = response.data.data.paymentUrl;
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error(error.response?.data?.error || 'Gagal membuat invoice pembayaran');
    } finally {
      setProcessing(false);
    }
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
      price: pricing?.starter?.amount || 225000,
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
      originalPrice: 2500000,
      price: pricing?.bisnis?.amount || 2000000,
      duration: '/ Tahun',
      description: 'Pilihan favorit. Solusi komprehensif untuk operasional maksimal.',
      badge: 'Best Value',
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
      price: pricing?.lifetime?.amount || 7500000,
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

  return (
    <div className="min-h-screen admin-bg-main p-6 admin-text-primary">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Pilih Paket Berlangganan
          </h1>
          <p className="text-lg opacity-80">
            Tingkatkan bisnis Anda dengan fitur lengkap dari Warkop Santai
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

        {/* Payment Method Selector */}
        <div className="backdrop-blur-xl admin-bg-sidebar border admin-border-accent rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
            <FiCreditCard className="text-purple-500" />
            Pilih Metode Pembayaran
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[
              { code: 'NQ', name: 'QRIS', emoji: '📱', desc: 'Scan & bayar' },
              { code: 'B1', name: 'BCA', emoji: '🏦', desc: 'Virtual Account' },
              { code: 'BV', name: 'BNI', emoji: '🏦', desc: 'Virtual Account' },
              { code: 'M2', name: 'Mandiri', emoji: '🏦', desc: 'Virtual Account' },
              { code: 'BR', name: 'BRI', emoji: '🏦', desc: 'Virtual Account' },
              { code: 'OV', name: 'OVO', emoji: '💜', desc: 'E-Wallet' },
              { code: 'DA', name: 'DANA', emoji: '💙', desc: 'E-Wallet' },
              { code: 'SP', name: 'ShopeePay', emoji: '🛒', desc: 'E-Wallet' },
            ].map((method) => (
              <button
                key={method.code}
                onClick={() => setSelectedPaymentMethod(method.code)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${selectedPaymentMethod === method.code
                    ? 'border-purple-500 bg-purple-500/10 shadow-purple-500/20 shadow-lg'
                    : 'admin-border-accent bg-black/10 hover:bg-white/5 hover:border-purple-300/40'
                  }`}
              >
                <span className="text-2xl">{method.emoji}</span>
                <span className="font-bold text-sm">{method.name}</span>
                <span className="text-xs opacity-60">{method.desc}</span>
                {selectedPaymentMethod === method.code && (
                  <span className="text-xs text-purple-400 font-semibold">✓ Terpilih</span>
                )}
              </button>
            ))}
          </div>
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
            {processing ? 'Membuka Gateway Pembayaran...' : 'Lanjutkan Pembayaran Sekarang'}
          </button>
          <p className="text-sm opacity-60 mt-4">
            Anda akan diarahkan ke antarmuka pembayaran aman (Duitku)
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionUpgrade;
