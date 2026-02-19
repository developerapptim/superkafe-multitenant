import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShoppingBag, FiCheck, FiArrowLeft, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { tenantAPI } from '../../services/api';

const TenantRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    slug: ''
  });
  const [loading, setLoading] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'slug') {
      // Auto-format slug: lowercase, replace spaces with dash
      const formattedSlug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      setFormData({
        ...formData,
        slug: formattedSlug
      });
      setSlugAvailable(null); // Reset availability check
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
      
      // Auto-generate slug from name
      if (name === 'name' && !formData.slug) {
        const autoSlug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        setFormData(prev => ({
          ...prev,
          name: value,
          slug: autoSlug
        }));
      }
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
      if (!formData.name || !formData.slug) {
        toast.error('Nama dan slug wajib diisi');
        setLoading(false);
        return;
      }

      // Validasi format slug
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(formData.slug)) {
        toast.error('Slug hanya boleh mengandung huruf kecil, angka, dan tanda hubung');
        setLoading(false);
        return;
      }

      // Register tenant
      const response = await tenantAPI.register({
        name: formData.name,
        slug: formData.slug
      });

      if (response.data.success) {
        toast.success('Tenant berhasil didaftarkan!');
        
        // Simpan tenant_slug ke localStorage
        localStorage.setItem('tenant_slug', formData.slug);
        
        // Redirect ke login dengan slug yang sudah terisi
        setTimeout(() => {
          navigate('/auth/login', { 
            state: { 
              tenant_slug: formData.slug,
              message: 'Tenant berhasil dibuat! Silakan login dengan kredensial admin Anda.' 
            } 
          });
        }, 1500);
      }
    } catch (error) {
      console.error('Register error:', error);
      
      if (error.response?.status === 409) {
        toast.error('Slug sudah digunakan. Silakan pilih slug lain.');
        setSlugAvailable(false);
      } else {
        toast.error(error.response?.data?.message || 'Registrasi gagal. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
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

            {/* Tenant Slug */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Slug Tenant
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
                  URL unik untuk tenant Anda (hanya huruf kecil, angka, dan tanda hubung)
                </p>
                {formData.slug && (
                  <p className="text-xs text-purple-400">
                    URL Anda: {window.location.origin}/{formData.slug}
                  </p>
                )}
                {slugAvailable === false && (
                  <p className="text-xs text-red-400">
                    Slug sudah digunakan, silakan pilih yang lain
                  </p>
                )}
                {slugAvailable === true && (
                  <p className="text-xs text-green-400">
                    Slug tersedia!
                  </p>
                )}
              </div>
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
                <li>• Support email</li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || slugAvailable === false}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memproses...' : 'Daftar Sekarang'}
            </button>
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
