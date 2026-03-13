import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiCheck, FiShield, FiExternalLink, FiUser, FiMail } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { paymentAPI } from '../services/api';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [plan, setPlan] = useState(null);
  const [user, setUser] = useState(null);
  const [phone, setPhone] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(true);
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  // Validasi Debounce Effect
  useEffect(() => {
    if (phone === '') {
      setIsPhoneValid(false);
      return;
    }
    const timer = setTimeout(() => {
      const isFormatValid = /^[0-9]+$/.test(phone);
      const isLengthValid = phone.length >= 10 && phone.length <= 13;
      const isPrefixValid = phone.startsWith('08') || phone.startsWith('628');
      setIsPhoneValid(isFormatValid && isLengthValid && isPrefixValid);
    }, 400); // delay 400ms

    return () => clearTimeout(timer);
  }, [phone]);

  useEffect(() => {
    // Load plan and user data
    const pendingPlanType = localStorage.getItem('pendingPlan');
    const userData = JSON.parse(localStorage.getItem('user') || 'null');

    if (!userData) {
      toast.error('Anda harus login terlebih dahulu');
      navigate('/auth/login');
      return;
    }

    if (!pendingPlanType) {
      toast.error('Tidak ada paket yang dipilih');
      navigate('/');
      return;
    }

    setUser(userData);

    // Initialize phone number
    const userPhone = userData.phone || userData.phoneNumber || '';
    if (!userPhone || userPhone.trim() === '' || userPhone.startsWith('080000000')) {
      setPhone('');
      setIsPhoneValid(false);
      setShowPhoneInput(true);
    } else {
      setPhone(userPhone);
      const isLengthValid = userPhone.length >= 10 && userPhone.length <= 13;
      const isPrefixValid = userPhone.startsWith('08') || userPhone.startsWith('628');
      const valid = isLengthValid && isPrefixValid;
      setIsPhoneValid(valid);
      setShowPhoneInput(!valid);
    }

    // Plan details (Authority comes from backend, but we show UI based on these)
    const pricingPlans = {
      starter: {
        name: 'Starter',
        price: 'Rp 200.000',
        period: 'bulan',
        description: 'Solusi fleksibel untuk operasional harian kafe Anda.',
        features: ['POS & Kasir', 'Laporan Keuangan', 'Manajemen Stok']
      },
      bisnis: {
        name: 'Bisnis',
        price: 'Rp 1.700.000',
        period: 'tahun',
        description: 'Investasi cerdas untuk efisiensi maksimal bisnis Anda.',
        features: ['POS & Kasir', 'Laporan Lengkap', 'Priority Support', 'Managed Setup']
      },
      lifetime: {
        name: 'Lifetime',
        price: 'Rp 5.500.000',
        period: 'Sekali Bayar',
        description: 'Kendali kafe di tangan Anda selamanya tanpa biaya langganan.',
        features: ['Semua Fitur Premium', 'Update Gratis Selamanya', 'Priority Support Lifetime']
      }
    };

    const selectedPlan = pricingPlans[pendingPlanType];
    if (!selectedPlan) {
      toast.error('Paket tidak valid');
      navigate('/');
      return;
    }

    setPlan({ ...selectedPlan, type: pendingPlanType });
    setLoading(false);
  }, [navigate]);

  const handlePayment = async () => {
    setProcessing(true);
    try {
      // If user hasn't completed setup, we don't have a tenant slug yet.
      // The backend expects tenantSlug, email, customerName.
      // For new registrations, we can use 'new-tenant' or similar temporarily, 
      // but PaymentService.js uses tenantSlug to find Tenant.
      
      // Let's check if user has a tenantSlug already
      let tenantSlug = user?.tenantSlug;
      
      if (!tenantSlug) {
        // For new users before setup, we use 'guest' or 'pending' if the backend allows.
        // Actually, PaymentService.js: line 48 says "if (tenantSlug !== 'guest') { ... findOne({slug}) }"
        // So we use 'guest' for pre-setup payments.
        tenantSlug = 'guest';
      }

      const response = await paymentAPI.createInvoice({
        tenantSlug: tenantSlug,
        planType: plan.type,
        email: user.email,
        customerName: user.name,
        phoneNumber: phone || '08000000000'
      });

      if (response.data.success && response.data.data.paymentUrl) {
        toast.success('Mengarahkan ke halaman pembayaran...');
        
        // Clear pending plan AFTER payment link is generated
        localStorage.removeItem('pendingPlan');
        
        window.location.href = response.data.data.paymentUrl;
      } else {
        toast.error('Gagal membuat invoice');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error.response?.data?.error || 'Gagal memproses pembayaran');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors mb-8">
          <FiArrowLeft />
          <span>Kembali ke Landing Page</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Order Summary */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Konfirmasi Pesanan</h1>
              <p className="text-gray-600">Langkah terakhir sebelum mengaktifkan SuperKafe untuk bisnis Anda.</p>
            </div>

            <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-amber-900 capitalize">Paket {plan.name}</h2>
                  <p className="text-amber-700 text-sm">{plan.description}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-amber-900">{plan.price}</span>
                  <p className="text-xs text-amber-600">/ {plan.period}</p>
                </div>
              </div>

              <div className="border-t border-amber-200 pt-6 mb-6">
                <h3 className="text-sm font-semibold text-amber-900 mb-4">Fitur yang Didapatkan:</h3>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-amber-800">
                      <FiCheck className="text-green-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white/50 rounded-2xl p-4 flex items-center justify-between border border-white/80">
                <span className="font-bold text-amber-900">Total Pembayaran</span>
                <span className="text-xl font-bold text-amber-900">{plan.price}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <FiShield className="text-green-500" />
                <span>Pembayaran Aman via Duitku</span>
              </div>
              <div className="flex items-center gap-1">
                <FiCheck className="text-green-500" />
                <span>Aktivasi Instan</span>
              </div>
            </div>
          </motion.div>

          {/* User & Payment Detail */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Informasi Akun</h2>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-700">
                    <FiUser size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Nama Pemilik</p>
                    <p className="text-gray-900 font-bold">{user.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-700">
                    <FiMail size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Email Terdaftar</p>
                    <p className="text-gray-900 font-bold truncate">{user.email}</p>
                  </div>
                </div>

                {showPhoneInput ? (
                  <div className={`p-4 rounded-2xl border transition-colors ${!isPhoneValid && phone.length > 5 ? 'bg-red-50 border-red-200' : 'bg-blue-50/50 border-blue-100'}`}>
                    <label className={`block text-sm font-semibold mb-2 ${!isPhoneValid && phone.length > 5 ? 'text-red-800' : 'text-gray-800'}`}>
                      Nomor WhatsApp (Wajib)
                    </label>
                    <input
                      type="tel"
                      className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 bg-white transition-all ${
                        !isPhoneValid && phone.length > 5 
                          ? 'border-red-300 focus:ring-red-400' 
                          : 'border-blue-200 focus:ring-blue-400'
                      }`}
                      placeholder="Contoh: 08123456789"
                      value={phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, ''); // Hanya angka
                        if (val.length <= 13) {
                          setPhone(val);
                        }
                      }}
                    />
                    {!isPhoneValid && phone.length > 5 && (
                      <p className="text-xs text-red-600 mt-2">
                        Masukkan format yang valid (10-13 digit, awalan 08 atau 628).
                      </p>
                    )}
                    {(isPhoneValid || phone.length <= 5) && (
                      <p className="text-xs text-gray-500 mt-2">
                        Nomor aktif dibutuhkan untuk pengiriman notifikasi via WhatsApp.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-700">
                        <FiUser size={24} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Nomor WhatsApp</p>
                        <p className="text-gray-900 font-bold">{phone}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowPhoneInput(true)}
                      className="text-xs font-bold text-amber-600 hover:text-amber-800 transition-colors px-3 py-1 bg-amber-100 hover:bg-amber-200 rounded-lg"
                    >
                      Ubah
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <button
                  onClick={handlePayment}
                  disabled={processing || !isPhoneValid}
                  className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-800 text-white rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-amber-700/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-95 flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <FiExternalLink />
                      Lanjutkan Ke Pembayaran
                    </>
                  )}
                </button>
                <p className="text-xs text-center text-gray-500">
                  Satu langkah lagi untuk memulai. Anda akan diarahkan ke gateway pembayaran aman Duitku.
                </p>
              </div>
            </div>

            <div className="border border-blue-100 bg-blue-50/50 p-6 rounded-3xl">
              <h3 className="text-blue-900 font-bold mb-2 flex items-center gap-2 text-sm">
                💡 Butuh Bantuan?
              </h3>
              <p className="text-xs text-blue-700 leading-relaxed">
                Hubungi tim pendukung kami di <span className="font-bold underline cursor-pointer">0819-1937-1357</span> jika Anda menemui kendala selama proses pembayaran. Kami siap membantu setup kafe Anda.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
