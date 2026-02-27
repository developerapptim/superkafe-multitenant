import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiClock, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import api from '../services/api';

/**
 * Smart Trial Status Badge 
 * Hanya muncul ketika sisa masa trial/aktif <= 10 hari.
 * Bentuk badge pil kecil yang memunculkan dropdown interaktif ketika di-klik.
 */
const TrialStatusBanner = () => {
  const [trialInfo, setTrialInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchTrialStatus();

    // Close dropdown on outside click
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      console.error('Error fetching subscription status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Jangan render sama sekali jika loading atau data kosong
  if (loading || !trialInfo) return null;

  const { daysRemaining, status, trialExpiresAt } = trialInfo;

  // LOGIKA UTAMA SMART BANNER: Hide jika sisa hari > 10
  if (daysRemaining > 10) return null;

  // Menentukan styling dan pesan urgency
  let bgColor, borderColor, textColor, badgeBgColor, icon, statusText;
  const isCritical = daysRemaining <= 0;
  const isWarning = daysRemaining > 0 && daysRemaining <= 3;

  if (isCritical) {
    bgColor = 'bg-red-500/10';
    borderColor = 'border-red-500/30';
    textColor = 'text-red-400';
    badgeBgColor = 'bg-red-500/20 text-red-500 border-red-500/30';
    icon = <FiClock className="w-4 h-4" />;
    statusText = status === 'trial' ? 'Trial Habis' : 'Paket Habis';
  } else if (isWarning) {
    bgColor = 'bg-yellow-500/10';
    borderColor = 'border-yellow-500/30';
    textColor = 'text-yellow-400';
    badgeBgColor = 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
    icon = <FiAlertTriangle className="w-4 h-4" />;
    statusText = 'Segera Habis';
  } else {
    // 4-10 days
    bgColor = 'bg-green-500/10';
    borderColor = 'border-green-500/30';
    textColor = 'text-green-400';
    badgeBgColor = 'bg-white/10 text-gray-300 border-white/20';
    icon = <FiCheckCircle className="w-4 h-4" />;
    statusText = status === 'trial' ? 'Trial Aktif' : 'Paket Aktif';
  }

  const expiryDate = new Date(trialExpiresAt).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* CUTE SMART PILL BADGE */}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm cursor-pointer transition-colors ${badgeBgColor} ${showDropdown ? 'shadow-lg brightness-125' : ''}`}
        title="Info Langganan"
      >
        <span className={isCritical || isWarning ? "animate-pulse" : ""}>{icon}</span>
        <span>{statusText}: {daysRemaining} Hari</span>
      </motion.button>

      {/* DROPDOWN POPUP INFO */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-50 left-0 mt-2 w-72 backdrop-blur-xl ${bgColor} border ${borderColor} rounded-2xl p-4 shadow-2xl origin-top-left`}
          >
            <div className="flex gap-3">
              <div className={`mt-1 ${textColor}`}>
                {icon}
              </div>
              <div>
                <h4 className={`font-bold ${textColor} text-sm mb-1`}>
                  {isCritical ? "Akses Terkunci. Segera Upgrade!"
                    : isWarning ? "Peringatan Kedaluwarsa!"
                      : "Informasi Langganan"}
                </h4>
                <p className="text-xs text-white/70 leading-relaxed mb-3">
                  Kelanjutan akses aplikasi Admin Panel akan terhenti pada <strong>{expiryDate}</strong> ({daysRemaining} hari lagi).
                </p>

                <button
                  onClick={() => window.location.href = `/${localStorage.getItem('tenant_slug')}/admin/pengaturan`}
                  className="w-full py-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg font-semibold text-white text-xs hover:shadow-lg transition-all active:scale-95"
                >
                  Lihat Opsi Upgrade
                </button>
              </div>
            </div>

            {/* Progress Bar Visual (Hardcoded to 10 max due to <= 10 condition) */}
            {!isCritical && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, (daysRemaining / 10) * 100)}%` }}
                    className={`h-full ${daysRemaining > 3
                      ? 'bg-gradient-to-r from-green-400 to-emerald-400'
                      : 'bg-gradient-to-r from-yellow-400 to-red-400'
                      }`}
                  />
                </div>
                <p className="text-[10px] text-white/40 mt-1 text-right font-medium tracking-wide">
                  Sisa {daysRemaining} / 10 Hari Akhir
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrialStatusBanner;
