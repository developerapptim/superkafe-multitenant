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
        if (user && user.name) {
          setInitialAdminName(user.name);
        }

        // Redirect to dashboard if user already has tenant
        if (user && user.tenantSlug) {
          toast.info('Anda sudah memiliki tenant');
          // Store tenant slug before redirect
          localStorage.setItem('tenant_slug', user.tenantSlug);
          // Redirect to tenant-specific dashboard
          navigate(`/${user.tenantSlug}/admin/dashboard`);
          return;
        }

        // IMPORTANT: Only clear tenant_slug if user doesn't have a tenant yet
        // This prevents issues when user is setting up their first tenant
        const existingSlug = localStorage.getItem('tenant_slug');
        if (existingSlug && !user.tenantSlug) {
          localStorage.removeItem('tenant_slug');
          console.log('[SETUP WIZARD] Cleared stale tenant_slug from localStorage');
        }

        setCheckingAuth(false);
      } catch (error) {
        console.error('Auth check error:', error);
        toast.error('Terjadi kesalahan, silakan login kembali');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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
  }, [initialAdminName, formData.adminName]);

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

        // Extract tenant slug from response and redirect to tenant-specific dashboard
        const tenantSlug = response.data.tenant.slug;
        
        // Redirect to tenant-specific dashboard
        setTimeout(() => {
          navigate(`/${tenantSlug}/admin/dashboard`);
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <FiLoader className="w-8 h-8 animate-spin text-amber-700" />
          <p className="text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Setup Card */}
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <img 
              src="https://res.cloudinary.com/dhjqb65mf/image/upload/v1771859487/SuperKafe_i51g7i.png" 
              alt="SuperKafe Logo" 
              className="h-16 w-auto"
            />
          </div>

          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">Setup Kafe Anda</h1>
          <p className="text-gray-600 text-center mb-8">
            Lengkapi informasi berikut untuk memulai
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cafe Name */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Nama Kafe <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiShoppingBag className="text-gray-400" />
                </div>
                <input
                  type="text"
                  name="cafeName"
                  value={formData.cafeName}
                  onChange={handleChange}
                  placeholder="Warkop Kopi Kenangan"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent transition-all placeholder:text-gray-400 text-gray-900"
                  required
                />
              </div>
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                URL Slug <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiLink className="text-gray-400" />
                </div>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  placeholder="warkop-kopi-kenangan"
                  className={`w-full pl-12 pr-12 py-3 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 transition-all placeholder:text-gray-400 text-gray-900 ${
                    slugStatus.available === true
                      ? 'border-green-500 focus:ring-green-500'
                      : slugStatus.available === false
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-amber-700 focus:border-transparent'
                  }`}
                  required
                  minLength={3}
                  maxLength={50}
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  {slugStatus.checking ? (
                    <FiLoader className="text-gray-400 animate-spin" />
                  ) : slugStatus.available === true ? (
                    <FiCheck className="text-green-500" />
                  ) : slugStatus.available === false ? (
                    <FiX className="text-red-500" />
                  ) : null}
                </div>
              </div>
              {slugStatus.message && (
                <p className={`text-xs mt-1 ${
                  slugStatus.available === true
                    ? 'text-green-600'
                    : slugStatus.available === false
                    ? 'text-red-600'
                    : 'text-gray-500'
                }`}>
                  {slugStatus.message}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                URL kafe Anda: {window.location.origin}/{formData.slug || 'slug-anda'}
              </p>
            </div>

            {/* Admin Name */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Nama Admin (Opsional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiUser className="text-gray-400" />
                </div>
                <input
                  type="text"
                  name="adminName"
                  value={formData.adminName}
                  onChange={handleChange}
                  placeholder="Nama Anda"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent transition-all placeholder:text-gray-400 text-gray-900"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Kosongkan untuk menggunakan nama akun Anda
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || slugStatus.checking || slugStatus.available === false || !formData.cafeName || !formData.slug}
              className="w-full py-3 bg-gradient-to-r from-amber-700 to-amber-800 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-amber-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-xs text-blue-800">
              <strong>Info:</strong> Anda akan mendapatkan trial gratis selama 10 hari untuk mencoba semua fitur SuperKafe.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SetupWizard;
