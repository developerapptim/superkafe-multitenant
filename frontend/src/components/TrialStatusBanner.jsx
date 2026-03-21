import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiClock, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import api from '../services/api';
import usePlatform from '../hooks/usePlatform';

/**
 * Smart Subscription Status Badge
 * Shows when remaining days ≤ 10, or during grace period.
 * Pill badge with dropdown on click.
 */
const TrialStatusBanner = ({ subscriptionData }) => {
  const [trialInfo, setTrialInfo] = useState(subscriptionData || null);
  const [loading, setLoading] = useState(!subscriptionData);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const { isNative, isWeb } = usePlatform();

  useEffect(() => {
    if (!subscriptionData) fetchTrialStatus();

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update when external data changes (Socket.io)
  useEffect(() => {
    if (subscriptionData) {
      setTrialInfo(subscriptionData);
      setLoading(false);
    }
  }, [subscriptionData]);

  const fetchTrialStatus = async () => {
    try {
      const tenantSlug = localStorage.getItem('tenant_slug');
      if (!tenantSlug) { setLoading(false); return; }
      const response = await api.get(`/tenants/${tenantSlug}/trial-status`);
      if (response.data.success) setTrialInfo(response.data.data);
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !trialInfo) return null;

  const { daysRemaining, status, expiresAt, trialExpiresAt, isGracePeriod, gracePeriodEndsAt } = trialInfo;

  // Show badge for: grace period, expired, or ≤ 1 days remaining
  const isExpiredOrGrace = status === 'grace' || status === 'expired';
  if (!isExpiredOrGrace && daysRemaining > 1) return null;

  // Determine styling
  let bgColor, borderColor, textColor, badgeBgColor, icon, statusText;
  const isCritical = daysRemaining <= 0 || status === 'expired';
  const isWarning = isGracePeriod || (daysRemaining > 0 && daysRemaining <= 1);

  if (isGracePeriod) {
    bgColor = 'bg-orange-500/10';
    borderColor = 'border-orange-500/30';
    textColor = 'text-orange-400';
    badgeBgColor = 'bg-orange-500/20 text-orange-500 border-orange-500/30';
    icon = <FiAlertTriangle className="w-4 h-4" />;
    statusText = 'Masa Tenggang';
  } else if (isCritical) {
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
    bgColor = 'bg-green-500/10';
    borderColor = 'border-green-500/30';
    textColor = 'text-green-400';
    badgeBgColor = 'bg-white/10 text-gray-300 border-white/20';
    icon = <FiCheckCircle className="w-4 h-4" />;
    statusText = status === 'trial' ? 'Trial Aktif' : 'Paket Aktif';
  }

  const displayDate = expiresAt || trialExpiresAt;
  const expiryDate = new Date(displayDate).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const badgeLabel = isGracePeriod
    ? 'Masa Tenggang'
    : `${statusText}: ${daysRemaining} Hari`;

  const tenantSlug = localStorage.getItem('tenant_slug');

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* PILL BADGE */}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] md:text-xs font-medium border backdrop-blur-sm cursor-pointer transition-colors max-w-[130px] sm:max-w-none ${badgeBgColor} ${showDropdown ? 'shadow-lg brightness-125' : ''}`}
        title="Info Langganan"
      >
        <span className={`shrink-0 ${isCritical || isWarning || isGracePeriod ? "animate-pulse" : ""}`}>{icon}</span>
        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{badgeLabel}</span>
      </motion.button>

      {/* DROPDOWN */}
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
              <div className={`mt-1 ${textColor}`}>{icon}</div>
              <div>
                <h4 className={`font-bold ${textColor} text-sm mb-1`}>
                  {isGracePeriod ? "Masa Tenggang Aktif"
                    : isCritical ? "Akses Terkunci. Segera Upgrade!"
                      : isWarning ? "Peringatan Kedaluwarsa!"
                        : "Informasi Langganan"}
                </h4>
                <p className="text-xs text-white/70 leading-relaxed mb-3">
                  {isGracePeriod
                    ? `Langganan Anda sudah habis. Anda memiliki masa tenggang hingga ${gracePeriodEndsAt ? new Date(gracePeriodEndsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}. Segera perpanjang sebelum akses dibekukan.`
                    : `Kelanjutan akses aplikasi akan terhenti pada ${expiryDate} (${daysRemaining} hari lagi).`}
                </p>

                {isWeb ? (
                  <button
                    onClick={() => window.location.href = `/${tenantSlug}/admin/subscription/upgrade`}
                    className="w-full py-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg font-semibold text-white text-xs hover:shadow-lg transition-all active:scale-95"
                  >
                    {isGracePeriod ? 'Perpanjang Sekarang' : 'Lihat Opsi Upgrade'}
                  </button>
                ) : (
                  <p className="text-[10px] text-purple-300/70 leading-relaxed">
                    Perpanjang via browser: superkafe.com/{tenantSlug}/admin/subscription/upgrade
                  </p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {!isCritical && !isGracePeriod && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, (daysRemaining / 1) * 100)}%` }}
                    className={`h-full bg-gradient-to-r from-yellow-400 to-red-400`}
                  />
                </div>
                <p className="text-[10px] text-white/40 mt-1 text-right font-medium tracking-wide">
                  Sisa {daysRemaining} Hari Akhir
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
