import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiClock, FiAlertTriangle, FiX, FiCheckCircle } from 'react-icons/fi';
import api from '../services/api';

/**
 * Trial Status Banner Component
 * Menampilkan informasi status trial di Dashboard Admin
 * Glassmorphism design sesuai tema SuperKafe
 */
const TrialStatusBanner = () => {
  const [trialInfo, setTrialInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchTrialStatus();
  }, []);

  const fetchTrialStatus = async () => {
    try {
      const tenantSlug = localStorage.getItem('tenant_slug');
      
      if (!tenantSlug) {
        setLoading(false);
        return;
      }

      const response = await api.get(`/tenants/${tenantSlug}/trial-status`);
      
      if (response.data.success) {
        setTrialInfo(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching trial status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Save dismiss state untuk session ini
    sessionStorage.setItem('trial_banner_dismissed', 'true');
  };

  // Jangan tampilkan jika loading atau dismissed
  if (loading || dismissed) return null;

  // Jangan tampilkan jika tidak ada info atau status paid
  if (!trialInfo || trialInfo.status === 'paid') return null;

  // Jangan tampilkan jika sudah di-dismiss di session ini
  if (sessionStorage.getItem('trial_banner_dismissed') === 'true') return null;

  const { daysRemaining, status, trialExpiresAt } = trialInfo;

  // Tentukan warna dan icon berdasarkan sisa hari
  let bgColor, borderColor, textColor, icon, message, urgency;

  if (status === 'trial' && daysRemaining > 3) {
    // Hijau - Masih aman
    bgColor = 'bg-green-500/10';
    borderColor = 'border-green-500/30';
    textColor = 'text-green-400';
    icon = <FiCheckCircle className="w-5 h-5" />;
    message = `Masa Trial: ${daysRemaining} Hari Lagi`;
    urgency = 'low';
  } else if (status === 'trial' && daysRemaining > 0) {
    // Kuning/Merah - Peringatan
    bgColor = 'bg-yellow-500/10';
    borderColor = 'border-yellow-500/30';
    textColor = 'text-yellow-400';
    icon = <FiAlertTriangle className="w-5 h-5" />;
    message = `⚠️ Peringatan: Masa Trial Sisa ${daysRemaining} Hari. Segera Aktivasi!`;
    urgency = 'high';
  } else {
    // Merah - Expired
    bgColor = 'bg-red-500/10';
    borderColor = 'border-red-500/30';
    textColor = 'text-red-400';
    icon = <FiClock className="w-5 h-5" />;
    message = '🔒 Masa Trial Habis. Akses Terkunci. Silakan Upgrade!';
    urgency = 'critical';
  }

  // Format tanggal expiry
  const expiryDate = new Date(trialExpiresAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`relative backdrop-blur-xl ${bgColor} border ${borderColor} rounded-2xl p-4 mb-6 shadow-lg`}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Icon & Message */}
          <div className="flex items-center gap-3 flex-1">
            <div className={textColor}>
              {icon}
            </div>
            <div className="flex-1">
              <p className={`font-semibold ${textColor}`}>
                {message}
              </p>
              <p className="text-sm text-white/60 mt-1">
                {status === 'trial' && daysRemaining > 0 
                  ? `Trial berakhir pada ${expiryDate}`
                  : status === 'trial' && daysRemaining === 0
                  ? `Trial berakhir pada ${expiryDate}`
                  : 'Hubungi admin untuk upgrade'
                }
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {urgency !== 'low' && (
              <button
                onClick={() => {
                  // Redirect ke halaman upgrade
                  window.location.href = '/admin/subscription/upgrade';
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg font-semibold text-white text-sm hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                Upgrade Sekarang
              </button>
            )}
            
            {urgency === 'low' && (
              <button
                onClick={handleDismiss}
                className="p-2 text-white/40 hover:text-white transition-colors"
                title="Tutup"
              >
                <FiX className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar untuk visual sisa hari */}
        {status === 'trial' && daysRemaining > 0 && (
          <div className="mt-3">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(daysRemaining / 10) * 100}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={`h-full ${
                  daysRemaining > 3 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                    : 'bg-gradient-to-r from-yellow-500 to-red-500'
                }`}
              />
            </div>
            <p className="text-xs text-white/40 mt-1 text-right">
              {daysRemaining} dari 10 hari trial
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default TrialStatusBanner;
