import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMail, FiLock, FiArrowLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { checkActiveSession, getDashboardUrl } from '../../utils/authHelper';

/**
 * Global Login - Modern login tanpa tenant slug
 * Auto-detect tenant berdasarkan email
 */
const GlobalLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    isPersonalDevice: false
  });
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Emergency Staff Login state
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [staffLoginData, setStaffLoginData] = useState({ tenantSlug: '', pin: '' });
  const [staffLoginLoading, setStaffLoginLoading] = useState(false);

  // Check for active session on mount
  useEffect(() => {
    const session = checkActiveSession();

    if (session) {
      console.log('[GLOBAL LOGIN] Active session detected, redirecting to dashboard');
      const dashboardUrl = getDashboardUrl();

      if (dashboardUrl) {
        toast.success('Sesi aktif ditemukan, mengarahkan ke dashboard...');
        setTimeout(() => {
          navigate(dashboardUrl, { replace: true });
        }, 500);
        return;
      }
    }

    setCheckingSession(false);
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validasi input
      if (!formData.email || !formData.password) {
        toast.error('Email dan password wajib diisi');
        setLoading(false);
        return;
      }

      // Global login request
      const response = await api.post('/auth/global-login', {
        email: formData.email,
        password: formData.password,
        isPersonalDevice: formData.isPersonalDevice
      });

      if (response.data.success) {
        const { token, tenantSlug, tenantName, user } = response.data;

        // Simpan data ke localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('tenant_slug', tenantSlug);
        localStorage.setItem('tenant_name', tenantName);
        localStorage.setItem('user', JSON.stringify(user));

        // Simpan status personal device owner
        if (formData.isPersonalDevice && (user.role === 'admin' || user.role === 'owner')) {
          localStorage.setItem('isPersonalDevice', 'true');
        } else {
          localStorage.removeItem('isPersonalDevice');
        }

        toast.success(`Selamat datang, ${user.name}!`);

        // Redirect ke admin dashboard via legacy route (will redirect to tenant-specific)
        setTimeout(() => {
          navigate('/admin');
        }, 500);
      }
    } catch (error) {
      console.error('Login error:', error);

      // Handle email verification error
      if (error.response?.data?.requiresVerification) {
        toast.error('Email belum diverifikasi');

        localStorage.setItem('pending_email', error.response.data.email);
        localStorage.setItem('tenant_slug', error.response.data.tenantSlug);

        setTimeout(() => {
          navigate('/auth/verify-otp', {
            state: {
              email: error.response.data.email,
              tenantSlug: error.response.data.tenantSlug
            }
          });
        }, 1500);
        return;
      }

      if (error.response?.status === 404) {
        toast.error('Email tidak ditemukan di sistem');
      } else if (error.response?.status === 401) {
        toast.error('Password salah');
      } else {
        toast.error(error.response?.data?.error || 'Login gagal. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {checkingSession ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Memeriksa sesi...</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md"
        >
          {/* Back Button */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <FiArrowLeft />
            <span>Kembali</span>
          </Link>

          {/* Login Card */}
          <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl">
            {/* Logo */}
            <div className="flex items-center justify-center mb-8">
              <img
                src="https://res.cloudinary.com/dhjqb65mf/image/upload/v1771859487/SuperKafe_i51g7i.png"
                alt="SuperKafe Logo"
                className="h-16 w-auto"
              />
            </div>

            <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">Masuk ke SuperKafe</h1>
            <p className="text-gray-600 text-center mb-8">
              Masukkan email dan password Anda
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FiMail className="text-gray-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="admin@warkop.com"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent transition-all placeholder:text-gray-400 text-gray-900"
                    required
                    autoComplete="email"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Sistem akan otomatis mendeteksi tenant Anda
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FiLock className="text-gray-400" />
                  </div>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent transition-all placeholder:text-gray-400 text-gray-900"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* Ingat Perangkat Ini Checkbox */}
              <div className="flex items-center">
                <input
                  id="isPersonalDevice"
                  name="isPersonalDevice"
                  type="checkbox"
                  checked={formData.isPersonalDevice}
                  onChange={handleChange}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="isPersonalDevice" className="ml-2 block text-sm text-gray-700 cursor-pointer select-none">
                  Ingat Perangkat Ini <span className="text-gray-400 text-xs ml-1">(Bypass layar Lock Screen POS)</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-amber-700 to-amber-800 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-amber-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Memproses...' : 'Masuk'}
              </button>
            </form>

            {/* Additional Links */}
            <div className="mt-6 space-y-3">
              <div className="text-center">
                <Link
                  to="/auth/device-login"
                  className="text-amber-700 hover:text-amber-800 text-sm font-medium transition-colors"
                >
                  Login dari Tablet Terdaftar
                </Link>
              </div>

              <div className="text-center">
                <p className="text-gray-600 text-sm">
                  Belum punya akun?{' '}
                  <Link
                    to="/auth/register"
                    className="text-amber-700 hover:text-amber-800 font-medium transition-colors"
                  >
                    Daftar Sekarang
                  </Link>
                </p>
              </div>

              {/* Emergency Staff Login Toggle */}
              <div className="pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowStaffLogin(!showStaffLogin)}
                  className="w-full text-center text-sm text-gray-500 hover:text-amber-700 transition-colors font-medium"
                >
                  {showStaffLogin ? '✕ Tutup' : '🧾 Login sebagai Staf (Emergency)'}
                </button>

                {showStaffLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-3"
                  >
                    <p className="text-xs text-amber-800">
                      Gunakan ini jika tablet kasir tidak sengaja logout dan admin tidak di tempat.
                    </p>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">ID Kafe / Slug</label>
                      <input
                        type="text"
                        value={staffLoginData.tenantSlug}
                        onChange={(e) => setStaffLoginData({ ...staffLoginData, tenantSlug: e.target.value.toLowerCase().trim() })}
                        placeholder="contoh: sulkopi"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">PIN Staf (6 Digit)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={staffLoginData.pin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setStaffLoginData({ ...staffLoginData, pin: val });
                        }}
                        placeholder="••••••"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 text-sm tracking-[0.3em] text-center font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={staffLoginLoading || !staffLoginData.tenantSlug || staffLoginData.pin.length < 4}
                      onClick={async () => {
                        setStaffLoginLoading(true);
                        try {
                          const res = await api.post('/auth/login-pin', {
                            tenantSlug: staffLoginData.tenantSlug,
                            pin: staffLoginData.pin
                          });
                          if (res.data.success) {
                            const { token, user } = res.data;
                            localStorage.setItem('token', token);
                            localStorage.setItem('tenant_slug', staffLoginData.tenantSlug);
                            localStorage.setItem('user', JSON.stringify(user));
                            localStorage.removeItem('isPersonalDevice');
                            toast.success(`Selamat datang, ${user.name}!`);
                            navigate(`/${staffLoginData.tenantSlug}/admin/kasir`);
                          }
                        } catch (err) {
                          const msg = err.response?.data?.message || err.response?.data?.error || 'ID Kafe atau PIN salah';
                          toast.error(msg);
                        } finally {
                          setStaffLoginLoading(false);
                        }
                      }}
                      className="w-full py-2.5 bg-amber-700 text-white rounded-lg font-semibold hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                    >
                      {staffLoginLoading ? 'Memproses...' : 'Login Staf'}
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default GlobalLogin;
