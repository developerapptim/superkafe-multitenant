import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShoppingBag, FiUser, FiMail, FiLock, FiArrowLeft, FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { loadGoogleScript } from '../../utils/googleAuth';

const SimpleRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(true);

  // Load Google Sign-In script
  useEffect(() => {
    loadGoogleScript()
      .then(() => {
        setGoogleScriptReady(true);
        console.log('[Google Auth] Script ready');
      })
      .catch((error) => {
        console.error('[Google Auth] Failed to load:', error);
      });
  }, []);

  // Check password match
  useEffect(() => {
    if (formData.confirmPassword) {
      setPasswordMatch(formData.password === formData.confirmPassword);
    } else {
      setPasswordMatch(true);
    }
  }, [formData.password, formData.confirmPassword]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validasi input
      if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
        toast.error('Semua field wajib diisi');
        setLoading(false);
        return;
      }

      // Validasi password match
      if (formData.password !== formData.confirmPassword) {
        toast.error('Password dan konfirmasi password tidak cocok');
        setLoading(false);
        return;
      }

      // Validasi format email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error('Format email tidak valid');
        setLoading(false);
        return;
      }

      // Validasi password minimal 6 karakter
      if (formData.password.length < 6) {
        toast.error('Password minimal 6 karakter');
        setLoading(false);
        return;
      }

      // Register request ke endpoint baru
      const response = await api.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password
      });

      if (response.data.success) {
        toast.success('Registrasi berhasil! Silakan cek email Anda untuk kode verifikasi.');

        // Redirect ke halaman verifikasi OTP
        setTimeout(() => {
          navigate('/auth/verify-otp', {
            state: {
              email: formData.email
            }
          });
        }, 1500);
      }
    } catch (error) {
      console.error('Register error:', error);

      if (error.response?.status === 409) {
        toast.error('Email sudah terdaftar');
      } else {
        toast.error(error.response?.data?.message || 'Registrasi gagal. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    setGoogleLoading(true);

    // Check Google script
    if (typeof window.google === 'undefined') {
      toast.error('Google Sign-In belum siap. Silakan refresh halaman.');
      setGoogleLoading(false);
      return;
    }

    // Initialize Google OAuth
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: 'email profile openid',
      callback: async (response) => {
        try {
          if (response.error) {
            console.error('Google OAuth Error:', response);
            toast.error('Pendaftaran dengan Google gagal');
            setGoogleLoading(false);
            return;
          }

          // Get user info from Google
          const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
              Authorization: `Bearer ${response.access_token}`
            }
          });
          const userInfo = await userInfoResponse.json();

          console.log('[Google Auth] User info:', userInfo);

          // Kirim ke backend (endpoint baru)
          const backendResponse = await api.post('/auth/google', {
            idToken: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture
          });

          if (backendResponse.data.success) {
            // Simpan token dan user data
            localStorage.setItem('token', backendResponse.data.token);
            localStorage.setItem('user', JSON.stringify(backendResponse.data.user));

            // Show success message
            if (backendResponse.data.isNewUser) {
              toast.success('Akun berhasil dibuat dengan Google! Selamat datang!');
            } else {
              toast.success('Login dengan Google berhasil!');
            }

            // Redirect berdasarkan hasCompletedSetup
            if (backendResponse.data.user.hasCompletedSetup) {
              // User sudah setup tenant → ke dashboard via legacy route (will redirect to tenant-specific)
              localStorage.setItem('tenant_slug', backendResponse.data.user.tenantSlug);
              setTimeout(() => {
                navigate('/admin');
              }, 1500);
            } else {
              // User belum setup tenant → ke setup wizard
              setTimeout(() => {
                navigate('/setup-cafe');
              }, 1500);
            }
          }
        } catch (error) {
          console.error('Backend registration error:', error);

          if (error.response?.status === 409) {
            toast.error('Email sudah terdaftar');
          } else {
            toast.error(error.response?.data?.message || 'Registrasi gagal. Silakan coba lagi.');
          }
        } finally {
          setGoogleLoading(false);
        }
      },
    });

    // Request access token
    client.requestAccessToken();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center p-4">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
        >
          <FiArrowLeft />
          <span>Kembali</span>
        </Link>

        {/* Register Card */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
              <FiShoppingBag className="w-8 h-8" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center mb-2">Daftar Akun Baru</h1>
          <p className="text-white/60 text-center mb-8">
            Buat akun untuk memulai bisnis Anda
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Nama Lengkap
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiUser className="text-white/40" />
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-white/30"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiMail className="text-white/40" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="admin@warkop.com"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-white/30"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiLock className="text-white/40" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-white/30"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white transition-colors"
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Konfirmasi Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiLock className="text-white/40" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Ketik ulang password"
                  className={`w-full pl-12 pr-12 py-3 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 transition-all placeholder:text-white/30 ${
                    passwordMatch
                      ? 'border-white/10 focus:ring-purple-500 focus:border-transparent'
                      : 'border-red-500 focus:ring-red-500 focus:border-red-500'
                  }`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white transition-colors"
                >
                  {showConfirmPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
              {!passwordMatch && formData.confirmPassword && (
                <p className="text-xs text-red-400 mt-1">
                  Password tidak cocok
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !passwordMatch}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memproses...' : 'Daftar Sekarang'}
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-transparent text-white/40">atau</span>
              </div>
            </div>

            {/* Google Sign-Up Button */}
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={googleLoading || !googleScriptReady}
              className="w-full py-3 px-4 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border border-gray-300 shadow-sm"
            >
              <FcGoogle className="w-5 h-5" />
              <span>
                {googleLoading
                  ? 'Memproses...'
                  : 'Daftar dengan Google'
                }
              </span>
            </button>

            {!googleScriptReady && (
              <p className="text-xs text-white/40 text-center -mt-2">
                Memuat Google Sign-In...
              </p>
            )}
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-white/60 text-sm">
              Sudah punya akun?{' '}
              <Link
                to="/auth/login"
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Masuk
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SimpleRegister;
