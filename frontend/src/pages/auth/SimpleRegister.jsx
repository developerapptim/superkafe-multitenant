import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUser, FiMail, FiLock, FiArrowLeft, FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { loadGoogleScript } from '../../utils/googleAuth';

// Detect if running inside Capacitor native app
const isNativePlatform = Capacitor.isNativePlatform();

const SimpleRegister = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Handle pending plan from URL
  useEffect(() => {
    if (planParam) {
      console.log('[REGISTER] Pending plan detected:', planParam);
      localStorage.setItem('pendingPlan', planParam);
    }
  }, [planParam]);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(isNativePlatform); // Native is always ready
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(true);

  // Initialize Google Sign-In (native or web)
  useEffect(() => {
    if (isNativePlatform) {
      // Native: Initialize Capacitor GoogleAuth plugin
      console.log('[Google Auth] Initializing native GoogleAuth...');
      try {
        GoogleAuth.initialize({
          clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          scopes: ['profile', 'email'],
          grantOfflineAccess: false
        });
        setGoogleReady(true);
        console.log('[Google Auth] Native plugin initialized');
      } catch (error) {
        console.error('[Google Auth] Native init error:', error);
        setGoogleReady(false);
      }
    } else {
      // Web: Load Google Sign-In script (fallback)
      console.log('[Google Auth] Loading web Google script...');
      loadGoogleScript()
        .then(() => {
          setGoogleReady(true);
          console.log('[Google Auth] Web script ready');
        })
        .catch((error) => {
          console.error('[Google Auth] Web script failed:', error);
          setGoogleReady(false);
        });
    }
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

        const pendingPlan = localStorage.getItem('pendingPlan');

        // Redirect ke halaman verifikasi OTP
        setTimeout(() => {
          navigate('/auth/verify-otp', {
            state: {
              email: formData.email,
              plan: pendingPlan
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

  // Helper: process Google auth response from backend
  const processGoogleAuthResponse = (backendResponse) => {
    if (backendResponse.data.success) {
      // Simpan token dan user data
      localStorage.setItem('token', backendResponse.data.token);
      localStorage.setItem('user', JSON.stringify(backendResponse.data.user));

      // Simpan tenant data jika ada (termasuk theme)
      if (backendResponse.data.tenant) {
        localStorage.setItem('tenant', JSON.stringify(backendResponse.data.tenant));
      }

      // Show success message
      if (backendResponse.data.isNewUser) {
        toast.success('Akun berhasil dibuat dengan Google! Selamat datang!');
      } else {
        toast.success('Login dengan Google berhasil!');
      }

      // Redirect berdasarkan hasCompletedSetup
      const pendingPlan = localStorage.getItem('pendingPlan');
      
      if (pendingPlan) {
        console.log('[Google Auth] Pending plan found, redirecting to checkout');
        setTimeout(() => {
          navigate('/checkout');
        }, 1500);
      } else if (backendResponse.data.user.hasCompletedSetup) {
        localStorage.setItem('tenant_slug', backendResponse.data.user.tenantSlug);
        setTimeout(() => {
          navigate('/admin');
        }, 1500);
      } else {
        setTimeout(() => {
          navigate('/setup-cafe');
        }, 1500);
      }
    }
  };

  const handleGoogleSignUp = async () => {
    if (!googleReady) {
      toast.error('Google Sign-In tidak tersedia saat ini. Silakan gunakan registrasi email/password.', {
        duration: 5000
      });
      return;
    }

    setGoogleLoading(true);

    try {
      if (isNativePlatform) {
        // ===== NATIVE: Use Capacitor GoogleAuth plugin =====
        console.log('[Google Auth] Starting native sign-up...');
        const googleUser = await GoogleAuth.signIn();
        console.log('[Google Auth] Native sign-up result:', googleUser);

        // Send to backend
        const backendResponse = await api.post('/auth/google', {
          idToken: googleUser.authentication?.idToken || googleUser.id,
          email: googleUser.email,
          name: googleUser.name || `${googleUser.givenName || ''} ${googleUser.familyName || ''}`.trim(),
          picture: googleUser.imageUrl
        });

        processGoogleAuthResponse(backendResponse);
      } else {
        // ===== WEB: Use Google Identity Services =====
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
                headers: { Authorization: `Bearer ${response.access_token}` }
              });
              const userInfo = await userInfoResponse.json();

              // Kirim ke backend
              const backendResponse = await api.post('/auth/google', {
                idToken: userInfo.sub,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture
              });

              processGoogleAuthResponse(backendResponse);
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
        return; // Callback handles loading state
      }
    } catch (error) {
      console.error('[Google Auth] Sign-up error:', error);

      // Handle user cancellation
      if (error.error === 'popup_closed_by_user' || error.type === 'userCancel') {
        console.log('[Google Auth] User cancelled sign-up');
      } else {
        toast.error('Gagal menginisialisasi Google Sign-In. Silakan coba lagi.', { duration: 4000 });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
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

        {/* Register Card */}
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <img
              src="https://res.cloudinary.com/dhjqb65mf/image/upload/v1771859487/SuperKafe_i51g7i.png"
              alt="SuperKafe Logo"
              className="h-16 w-auto"
            />
          </div>

          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">Daftar Akun Baru</h1>
          <p className="text-gray-600 text-center mb-8">
            Buat akun untuk memulai bisnis Anda
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Nama Lengkap
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiUser className="text-gray-400" />
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent transition-all placeholder:text-gray-400 text-gray-900"
                  required
                />
              </div>
            </div>

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
                />
              </div>
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
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent transition-all placeholder:text-gray-400 text-gray-900"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Konfirmasi Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiLock className="text-gray-400" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Ketik ulang password"
                  className={`w-full pl-12 pr-12 py-3 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 text-gray-900 ${passwordMatch
                      ? 'border-gray-300 focus:ring-amber-700 focus:border-transparent'
                      : 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    }`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
              {!passwordMatch && formData.confirmPassword && (
                <p className="text-xs text-red-600 mt-1">
                  Password tidak cocok
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !passwordMatch}
              className="w-full py-3 bg-gradient-to-r from-amber-700 to-amber-800 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-amber-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memproses...' : 'Daftar Sekarang'}
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">atau</span>
              </div>
            </div>

            {/* Google Sign-Up Button */}
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={googleLoading || !googleReady}
              className="w-full py-3 px-4 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border border-gray-300 shadow-sm"
            >
              <FcGoogle className="w-5 h-5" />
              <span>
                {googleLoading
                  ? 'Memproses...'
                  : !googleReady
                    ? 'Google Sign-In Tidak Tersedia'
                    : 'Daftar dengan Google'
                }
              </span>
            </button>

            {!googleReady && !isNativePlatform && (
              <p className="text-xs text-gray-500 text-center -mt-2">
                Memuat Google Sign-In...
              </p>
            )}
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Sudah punya akun?{' '}
              <Link
                to="/auth/login"
                className="text-amber-700 hover:text-amber-800 font-medium transition-colors"
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
