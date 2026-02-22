import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheckCircle } from 'react-icons/fi';
import confetti from 'canvas-confetti';
import { useTenant } from '../../components/TenantRouter';

/**
 * Subscription Success Page
 * Halaman sukses setelah pembayaran berhasil
 */
const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const { tenantSlug } = useTenant();

  useEffect(() => {
    // Trigger confetti animation - lebih meriah!
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Confetti dari kiri
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      
      // Confetti dari kanan
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    // Redirect ke dashboard setelah 5 detik
    const timer = setTimeout(() => {
      const dashboardPath = tenantSlug ? `/${tenantSlug}/admin/dashboard` : '/admin/dashboard';
      navigate(dashboardPath);
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full backdrop-blur-xl bg-white/80 border border-gray-200 rounded-3xl p-8 shadow-2xl text-center"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <FiCheckCircle className="w-12 h-12 text-white" />
        </motion.div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Pembayaran Berhasil!
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          Selamat! Akun Anda telah berhasil diupgrade ke Premium. 
          Anda sekarang dapat menikmati semua fitur SuperKafe tanpa batasan.
        </p>

        {/* Info */}
        <div className="backdrop-blur-md bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-700">
            ✨ Akses premium Anda aktif selama 30 hari
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            const dashboardPath = tenantSlug ? `/${tenantSlug}/admin/dashboard` : '/admin/dashboard';
            navigate(dashboardPath);
          }}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/50 transition-all"
        >
          Kembali ke Dashboard
        </button>

        <p className="text-sm text-gray-500 mt-4">
          Redirect otomatis dalam 5 detik...
        </p>
      </motion.div>
    </div>
  );
};

export default SubscriptionSuccess;
