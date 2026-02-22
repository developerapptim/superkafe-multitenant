import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShoppingBag, FiUser, FiLink, FiCheck, FiX, FiLoader } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../services/api';

const SetupWizard = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    cafeName: '',
    slug: '',
    adminName: ''
  });
  const [slugStatus, setSlugStatus] = useState({
    checking: false,
    available: null,
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [initialAdminName, setInitialAdminName] = useState('');

  // Check authentication and existing tenant
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');

      // Redirect to login with return URL if unauthenticated
      if (!token || !userStr) {
        toast.error('Silakan login terlebih dahulu');
        navigate('/auth/login?returnUrl=/setup-cafe');
        return;
      }

      try {
        const user = JSON.parse(userStr);
        
        // Set default admin name from user (only once)
        setInitialAdminName(user.name || '');

        // Redirect to dashboard if user already has tenant
        if (user.tenantSlug) {
          toast.info('Anda sudah memiliki tenant');
          navigate('/admin/dashboard');
          return;
        }

        setCheckingAuth(false);
      } catch (error) {
        console.error('Auth check error:', error);
        toast.error('Terjadi kesalahan, silakan login kembali');
        navigate('/auth/login?returnUrl=/setup-cafe');
      }
    };

    checkAuth();
  }, [navigate]);

  // Set initial admin name after it's loaded
  useEffect(() => {
    if (initialAdminName && !formData.adminName) {
      setFormData(prev => ({
        ...prev,
        adminName: initialAdminName
      }));
    }
  }, [initialAdminName]);

  // Debounced slug availability check
  useEffect(() => {
    if (!formData.slug || formData.slug.length < 3) {
      setSlugStatus({ checking: false, available: null, message: '' });
      return;
    }

    const timeoutId = setTimeout(() => {
      checkSlugAvailability(formData.slug);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.slug]);

  const checkSlugAvailability = async (slug) => {
    setSlugStatus({ checking: true, available: null, message: '' });

    try {
      const response = await api.get(`/setup/check-slug/${slug}`);
      
      if (response.data.success) {
        setSlugStatus({
          checking: false,
          available: response.data.available,
          message: response.data.message
        });
      }
    } catch (error) {
      console.error('Slug check error:', error);
      setSlugStatus({
        checking: false,
        available: null,
        message: 'Gagal memeriksa ketersediaan slug'
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Auto-generate slug from cafe name
    if (name === 'cafeName') {
      const autoSlug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
      
      setFormData({
        ...formData,
        cafeName: value,
        slug: autoSlug
      });
    } else if (name === 'slug') {
      // Normalize slug input
      const normalizedSlug = value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .substring(0, 50);
      
      setFormData({
        ...formData,
        slug: normalizedSlug
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validasi input
      if (!formData.cafeName || !formData.slug) {
        toast.error('Nama kafe dan slug wajib diisi');
        setLoading(false);
        return;
      }

      // Validasi slug minimal 3 karakter
      if (formData.slug.length < 3) {
        toast.error('Slug minimal 3 karakter');
        setLoading(false);
        return;
      }

      // Validasi slug tersedia
      if (slugStatus.available === false) {
        toast.error('Slug tidak tersedia, silakan pilih slug lain');
        setLoading(false);
        return;
      }

      // Submit form
      const response = await api.post('/setup/tenant', {
        cafeName: formData.cafeName.trim(),
        slug: formData.slug.trim(),
        adminName: formData.adminName.trim() || undefined
      });

      if (response.data.success) {
        // Save new token and user data
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('tenant_slug', response.data.tenant.slug);

        toast.success(response.data.message || 'Setup berhasil! Selamat datang!');

        // Redirect to dashboard
        setTimeout(() => {
          navigate('/admin/dashboard');
        }, 1500);
      }
    } catch (error) {
      console.error('Setup error:', error);

      if (error.response?.status === 409) {
        toast.error(error.response.data.message || 'Slug sudah digunakan');
      } else if (error.response?.status === 400) {
        toast.error(error.response.data.message || 'Data tidak valid');
      } else {
        toast.error(error.response?.data?.message || 'Setup gagal. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <FiLoader className="w-8 h-8 animate-spin" />
          <p className="text-white/60">Memuat...</p>
        </div>
      </div>
    );
  }

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
        {/* Setup Card */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
              <FiShoppingBag className="w-8 h-8" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center mb-2">Setup Kafe Anda</h1>
          <p className="text-white/60 text-center mb-8">
            Lengkapi informasi berikut untuk memulai
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cafe Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Nama Kafe <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiShoppingBag className="text-white/40" />
                </div>
                <input
                  type="text"
                  name="cafeName"
                  value={formData.cafeName}
                  onChange={handleChange}
                  placeholder="Warkop Kopi Kenangan"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-white/30"
                  required
                />
              </div>
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium mb-2">
                URL Slug <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiLink className="text-white/40" />
                </div>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  placeholder="warkop-kopi-kenangan"
                  className={`w-full pl-12 pr-12 py-3 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 transition-all placeholder:text-white/30 ${
                    slugStatus.available === true
                      ? 'border-green-500 focus:ring-green-500'
                      : slugStatus.available === false
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-white/10 focus:ring-purple-500 focus:border-transparent'
                  }`}
                  required
                  minLength={3}
                  maxLength={50}
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  {slugStatus.checking ? (
                    <FiLoader className="text-white/40 animate-spin" />
                  ) : slugStatus.available === true ? (
                    <FiCheck className="text-green-400" />
                  ) : slugStatus.available === false ? (
                    <FiX className="text-red-400" />
                  ) : null}
                </div>
              </div>
              {slugStatus.message && (
                <p className={`text-xs mt-1 ${
                  slugStatus.available === true
                    ? 'text-green-400'
                    : slugStatus.available === false
                    ? 'text-red-400'
                    : 'text-white/40'
                }`}>
                  {slugStatus.message}
                </p>
              )}
              <p className="text-xs text-white/40 mt-1">
                URL kafe Anda: {window.location.origin}/{formData.slug || 'slug-anda'}
              </p>
            </div>

            {/* Admin Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Nama Admin (Opsional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiUser className="text-white/40" />
                </div>
                <input
                  type="text"
                  name="adminName"
                  value={formData.adminName}
                  onChange={handleChange}
                  placeholder="Nama Anda"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-white/30"
                />
              </div>
              <p className="text-xs text-white/40 mt-1">
                Kosongkan untuk menggunakan nama akun Anda
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || slugStatus.checking || slugStatus.available === false || !formData.cafeName || !formData.slug}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <FiLoader className="animate-spin" />
                  Memproses...
                </span>
              ) : (
                'Buat Kafe Saya'
              )}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-xs text-blue-200">
              <strong>Info:</strong> Anda akan mendapatkan trial gratis selama 10 hari untuk mencoba semua fitur SuperKafe.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SetupWizard;
