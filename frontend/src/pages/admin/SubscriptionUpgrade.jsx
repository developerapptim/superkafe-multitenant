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
  const [selectedPlan, setSelectedPlan] = useState('monthly');
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

      const response = await paymentAPI.createInvoice({
        tenantSlug,
        planType: selectedPlan,
        email: user.email || 'admin@example.com',
        customerName: user.name || 'Admin',
        phoneNumber: '08123456789'
      });

      if (response.data.success) {
        toast.success('Redirect ke halaman pembayaran...');
        
        // Redirect ke payment URL
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
      id: 'monthly',
      name: 'Bulanan',
      price: pricing?.monthly?.amount || 99000,
      duration: '30 Hari',
      description: 'Cocok untuk mencoba',
      features: [
        'Akses penuh semua fitur',
        'Dashboard analitik',
        'Support email',
        'Update gratis'
      ]
    },
    {
      id: 'quarterly',
      name: '3 Bulan',
      price: pricing?.quarterly?.amount || 270000,
      duration: '90 Hari',
      description: 'Hemat 10%',
      badge: 'Populer',
      features: [
        'Semua fitur Bulanan',
        'Hemat Rp 27.000',
        'Priority support',
        'Training gratis'
      ]
    },
    {
      id: 'yearly',
      name: 'Tahunan',
      price: pricing?.yearly?.amount || 990000,
      duration: '365 Hari',
      description: 'Hemat 20%',
      badge: 'Best Value',
      features: [
        'Semua fitur 3 Bulan',
        'Hemat Rp 198.000',
        'Dedicated support',
        'Custom features'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Upgrade ke Premium
          </h1>
          <p className="text-lg text-gray-600">
            Pilih paket yang sesuai dengan kebutuhan bisnis Anda
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              whileHover={{ scale: 1.02 }}
              className={`relative backdrop-blur-xl bg-white/80 border-2 rounded-3xl p-8 shadow-xl transition-all cursor-pointer ${
                selectedPlan === plan.id
                  ? 'border-purple-500 shadow-purple-500/50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="px-4 py-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-semibold rounded-full shadow-lg">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan Name */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-sm text-gray-600">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  Rp {plan.price.toLocaleString('id-ID')}
                </div>
                <div className="text-sm text-gray-600">{plan.duration}</div>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-gray-700">
                    <FiCheck className="text-green-500 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Select Indicator */}
              {selectedPlan === plan.id && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <FiCheck className="text-white" size={16} />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Payment Info */}
        <div className="backdrop-blur-xl bg-white/80 border border-gray-200 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiShield className="text-purple-500" />
            Metode Pembayaran
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <FiCreditCard className="text-purple-500" />
              <span>Virtual Account</span>
            </div>
            <div className="flex items-center gap-2">
              <FiCreditCard className="text-purple-500" />
              <span>E-Wallet</span>
            </div>
            <div className="flex items-center gap-2">
              <FiClock className="text-purple-500" />
              <span>Aktivasi Otomatis</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center">
          <button
            onClick={handleUpgrade}
            disabled={processing}
            className="px-12 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Memproses...' : 'Lanjutkan Pembayaran'}
          </button>
          <p className="text-sm text-gray-600 mt-4">
            Anda akan diarahkan ke halaman pembayaran Duitku
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionUpgrade;
