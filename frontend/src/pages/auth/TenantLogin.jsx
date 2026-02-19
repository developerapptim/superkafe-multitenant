import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShoppingBag, FiUser, FiLock, FiArrowLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TenantLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    tenant_slug: '',
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

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
      if (!formData.tenant_slug || !formData.username || !formData.password) {
        toast.error('Semua field wajib diisi');
        setLoading(false);
        return;
      }

      // Simpan tenant_slug ke localStorage untuk axios interceptor
      localStorage.setItem('tenant_slug', formData.tenant_slug.toLowerCase());

      // Login request
      const response = await api.post('/login', {
        username: formData.username,
        password: formData.password
      });

      if (response.data.success) {
        // Simpan token dan user data
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        toast.success('Login berhasil!');
        
        // Redirect ke admin dashboard
        navigate('/admin/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      
      if (error.response?.status === 404) {
        toast.error('Tenant tidak ditemukan atau tidak aktif');
      } else if (error.response?.status === 401) {
        toast.error('Username atau password salah');
      } else {
        toast.error(error.response?.data?.message || 'Login gagal. Silakan coba lagi.');
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

        {/* Login Card */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
              <FiShoppingBag className="w-8 h-8" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center mb-2">Masuk ke SuperKafe</h1>
          <p className="text-white/60 text-center mb-8">
            Masukkan kredensial tenant Anda
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tenant Slug */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Tenant Slug
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiShoppingBag className="text-white/40" />
                </div>
                <input
                  type="text"
                  name="tenant_slug"
                  value={formData.tenant_slug}
                  onChange={handleChange}
                  placeholder="warkop-pusat"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-white/30"
                  required
                />
              </div>
              <p className="text-xs text-white/40 mt-1">
                Slug unik untuk tenant/cabang Anda
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiUser className="text-white/40" />
                </div>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="admin"
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
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-white/30"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-white/60 text-sm">
              Belum punya akun?{' '}
              <Link
                to="/auth/register"
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Daftar Sekarang
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default TenantLogin;
