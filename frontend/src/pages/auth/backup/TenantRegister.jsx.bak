import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShoppingBag, FiCheck, FiArrowLeft, FiAlertCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import toast from 'react-hot-toast';
import { tenantAPI } from '../../services/api';
import { loadGoogleScript } from '../../utils/googleAuth';
import api from '../../services/api';

const TenantRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email: '',
    password: '',
    confirmPassword: '',
    adminName: ''
  });
  const [loading, setLoading] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [isSlugEdited, setIsSlugEdited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);

  // Fungsi slugify - convert text ke URL-friendly slug
  const slugify = (text) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Hapus karakter spesial
      .replace(/\s+/g, '-') // Ganti spasi dengan dash
      .replace(/-+/g, '-') // Ganti multiple dash dengan single dash
      .replace(/^-+|-+$/g, ''); // Hapus dash di awal/akhir
  };

  // Auto-sync slug dari nama kafe
  useEffect(() => {
    if (!isSlugEdited && formData.name) {
      const autoSlug = slugify(formData.name);
      setFormData(prev => ({
        ...prev,
        slug: autoSlug
      }));
      setSlugAvailable(null); // Reset availability check
    }
  }, [formData.name, isSlugEdited]);

  // Check password match
  useEffect(() => {
    if (formData.confirmPassword) {
      setPasswordMatch(formData.password === formData.confirmPassword);
    } else {
      setPasswordMatch(true); // Reset jika confirm password kosong
    }
  }, [formData.password, formData.confirmPassword]);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'slug') {
      // Manual edit slug - stop auto-sync
      setIsSlugEdited(true);
      const formattedSlug = slugify(value);
      setFormData({
        ...formData,
        slug: formattedSlug
      });
      setSlugAvailable(null); // Reset availability check
    } else if (name === 'name') {
      // Update nama kafe
      setFormData({
        ...formData,
        name: value
      });
      // Auto-sync akan handle slug update via useEffect
    } else {
      // Update field lainnya
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const checkSlugAvailability = async () => {
    if (!formData.slug) return;

    try {
      const response = await tenantAPI.getBySlug(formData.slug);
      // Jika tenant ditemukan, slug tidak tersedia
      setSlugAvailable(false);
    } catch (error) {
      // Jika 404, slug tersedia
      if (error.response?.status === 404) {
        setSlugAvailable(true);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validasi input
      if (!formData.name || !formData.slug || !formData.email || !formData.password || !formData.confirmPassword) {
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

      // Validasi format slug
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(formData.slug)) {
        toast.error('Alamat Link hanya boleh mengandung huruf kecil, angka, dan tanda hubung');
        setLoading(false);
        return;
      }

      // Register tenant
      const response = await tenantAPI.register({
        name: formData.name,
        slug: formData.slug,
        email: formData.email,
        password: formData.password,
        adminName: formData.adminName || 'Administrator'
      });

      if (response.data.success) {
        toast.success('Registrasi berhasil! Silakan cek email Anda untuk kode verifikasi.');
        
        // Simpan tenant_slug dan email ke localStorage untuk proses verifikasi
        localStorage.setItem('tenant_slug', formData.slug);
        localStorage.setItem('pending_email', formData.email);
        
        // Redirect ke halaman verifikasi OTP
        setTimeout(() => {
          navigate('/auth/verify-otp', { 
            state: { 
              email: formData.email,
              tenantSlug: formData.slug,
              tenantName: formData.name
            } 
          });
        }, 1500);
      }
    } catch (error) {
      console.error('Register error:', error);
      
      if (error.response?.status === 409) {
        toast.error('Alamat Link sudah digunakan. Silakan pilih yang lain.');
        setSlugAvailable(false);
      } else {
        toast.error(error.response?.data?.message || 'Registrasi gagal. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = (e) => {
    // Prevent form submission
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setGoogleLoading(true);

    // Validasi slug terlebih dahulu
    if (!formData.slug) {
      toast.error('Alamat Link (URL) wajib diisi terlebih dahulu');
      setGoogleLoading(false);
      return;
    }

    // Validasi format slug
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(formData.slug)) {
      toast.error('Alamat Link hanya boleh mengandung huruf kecil, angka, dan tanda hubung');
      setGoogleLoading(false);
      return;
    }

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

          // Kirim ke backend untuk registrasi tenant + user
          const backendResponse = await tenantAPI.register({
            name: formData.name || `Kafe ${userInfo.name}`,
            slug: formData.slug,
            email: userInfo.email,
            adminName: userInfo.name,
            googleId: userInfo.sub,
            googlePicture: userInfo.picture,
            authProvider: 'google',
            // Password tidak dikirim untuk Google auth
            password: null
          });

          if (backendResponse.data.success) {
            toast.success('Registrasi dengan Google berhasil! Selamat datang!');
            
            // Simpan data
            localStorage.setItem('token', backendResponse.data.token);
            localStorage.setItem('user', JSON.stringify(backendResponse.data.user));
            localStorage.setItem('tenant_slug', formData.slug.toLowerCase());
            
            // Redirect ke dashboard
            setTimeout(() => {
              navigate('/admin/dashboard');
            }, 1500);
          }
        } catch (error) {
          console.error('Backend registration error:', error);
          
          if (error.response?.status === 409) {
            toast.error('Alamat Link sudah digunakan. Silakan pilih yang lain.');
            setSlugAvailable(false);
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
        className="relative z-10 w-full max-w-2xl"
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

          <h1 className="text-3xl font-bold text-center mb-2">Daftar Tenant Baru</h1>
          <p className="text-white/60 text-center mb-8">
            Buat tenant untuk bisnis kafe Anda
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tenant Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Nama Kafe/Warkop
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Warkop Pusat"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-white/30"
                required
              />
              <p className="text-xs text-white/40 mt-1">
                Nama bisnis yang akan ditampilkan
              </p>
            </div>

            {/* Tenant Slug (Alamat Link) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Alamat Link (URL)
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  onBlur={checkSlugAvailability}
                  placeholder="warkop-pusat"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-white/30 pr-12"
                  required
                />
                {slugAvailable !== null && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    {slugAvailable ? (
                      <FiCheck className="text-green-400 w-5 h-5" />
                    ) : (
                      <FiAlertCircle className="text-red-400 w-5 h-5" />
                    )}
                  </div>
                )}
              </div>
              <div className="mt-1 space-y-1">
                <p className="text-xs text-white/40">
                  {isSlugEdited 
                    ? 'URL unik untuk tenant Anda (diedit manual)'
                    : 'Otomatis dibuat dari nama kafe (bisa diedit manual)'
                  }
                </p>
                {formData.slug && (
                  <p className="text-xs text-purple-400">
                    URL Anda: {window.location.origin}/{formData.slug}
                  </p>
                )}
                {slugAvailable === false && (
                  <p className="text-xs text-red-400">
                    Alamat Link sudah digunakan, silakan pilih yang lain
                  </p>
                )}
                {slugAvailable === true && (
                  <p className="text-xs text-green-400">
                    Alamat Link tersedia!
                  </p>
                )}
              </div>
            </div>

            {/* Admin Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Nama Admin
              </label>
              <input
                type="text"
                name="adminName"
                value={formData.adminName}
                onChange={handleChange}
                placeholder="Administrator"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-white/30"
              />
              <p className="text-xs text-white/40 mt-1">
                Opsional - default: Administrator
              </p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Email Admin
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@warkop.com"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-white/30"
                required
              />
              <p className="text-xs text-white/40 mt-1">
                Email untuk login dan verifikasi akun
              </p>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-white/30"
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
              <p className="text-xs text-white/40 mt-1">
                Password untuk login (minimal 6 karakter)
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Konfirmasi Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Ketik ulang password"
                  className={`w-full px-4 py-3 pr-12 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 transition-all placeholder:text-white/30 ${
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
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <FiAlertCircle size={12} />
                  Password tidak cocok
                </p>
              )}
              {passwordMatch && formData.confirmPassword && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <FiCheck size={12} />
                  Password cocok
                </p>
              )}
            </div>

            {/* Info Box */}
            <div className="backdrop-blur-md bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <FiCheck className="text-blue-400" />
                Yang Anda Dapatkan:
              </h3>
              <ul className="space-y-1 text-sm text-white/70">
                <li>• Database terpisah untuk tenant Anda</li>
                <li>• Akses penuh ke semua fitur dasar</li>
                <li>• Dashboard analitik real-time</li>
                <li>• Verifikasi email untuk keamanan</li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || slugAvailable === false || !passwordMatch}
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
              disabled={googleLoading || !googleScriptReady || !formData.slug}
              className="w-full py-3 px-4 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border border-gray-300 shadow-sm"
            >
              <FcGoogle className="w-5 h-5" />
              <span>
                {googleLoading 
                  ? 'Memproses...' 
                  : !formData.slug
                    ? 'Isi Alamat Link terlebih dahulu'
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

export default TenantRegister;
