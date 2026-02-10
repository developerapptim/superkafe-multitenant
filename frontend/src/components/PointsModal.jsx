import { createPortal } from 'react-dom';
import {
    calculateTier,
    getTierColor,
    getTierIcon,
    getTierName,
    getTierBenefits,
    calculateTierProgress,
    formatCurrency,
    DEFAULT_THRESHOLDS
} from '../utils/tierUtils';

/**
 * Points Detail Modal Component
 * Shows full loyalty points information with stats, progress, and benefits
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.customerData - { name, phone, points, tier, totalSpent, recentActivities }
 * @param {Object} props.settings - Loyalty settings from admin
 * @param {boolean} props.loading - Loading state
 */
export default function PointsModal({ isOpen, onClose, customerData, settings, loading }) {
    if (!isOpen || !customerData) return null;

    const { name, phone, points, totalSpent, recentActivities = [] } = customerData;
    const thresholds = settings?.loyaltySettings?.tierThresholds || DEFAULT_THRESHOLDS;

    // Calculate tier from totalSpent (don't rely on backend tier which might be 'regular' or invalid)
    const calculatedTier = calculateTier(totalSpent || 0, thresholds);
    const progress = calculateTierProgress(totalSpent || 0, thresholds);
    const tierColor = getTierColor(calculatedTier);
    const benefits = getTierBenefits(calculatedTier);

    // Format phone for display (e.g., 6281999378385 -> 0819-9937-8385)
    const formatPhone = (phoneNum) => {
        if (!phoneNum) return '-';
        let cleaned = phoneNum.replace(/\D/g, '');
        // Remove leading 62 if present
        if (cleaned.startsWith('62')) {
            cleaned = '0' + cleaned.slice(2);
        }
        // Add dashes for readability
        if (cleaned.length >= 10) {
            return cleaned.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
        }
        return cleaned;
    };

    return createPortal(
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden border border-purple-500/30 shadow-2xl animate-scale-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Header with Tier Badge */}
                <div
                    className="p-6 text-center relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${tierColor.bg}, transparent)` }}
                >
                    {/* Background decoration */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white to-transparent rounded-full -translate-y-1/2 translate-x-1/2"></div>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                    >
                        ✕
                    </button>

                    {/* Loading Overlay */}
                    {loading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}

                    {/* Tier Icon */}
                    <div
                        className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl shadow-lg"
                        style={{
                            background: `linear-gradient(135deg, ${tierColor.primary}, ${tierColor.primary}99)`,
                            boxShadow: `0 8px 32px ${tierColor.primary}40`
                        }}
                    >
                        {getTierIcon(calculatedTier)}
                    </div>

                    {/* Customer Name */}
                    <p className="text-gray-400 text-sm mb-1">Halo,</p>
                    <h2 className="text-2xl font-bold text-white mb-1">{name || 'Pelanggan'}</h2>

                    {/* Phone Number - Member ID */}
                    {phone && (
                        <p className="text-gray-500 text-xs mb-3 flex items-center justify-center gap-1">
                            <span>📱</span>
                            <span>ID Member: {formatPhone(phone)}</span>
                        </p>
                    )}

                    {/* Tier Badge */}
                    <span
                        className="inline-block px-4 py-1 rounded-full text-sm font-bold uppercase tracking-wider"
                        style={{
                            background: tierColor.bg,
                            color: tierColor.primary,
                            border: `1px solid ${tierColor.border}`
                        }}
                    >
                        Member {getTierName(calculatedTier)}
                    </span>
                </div>

                {/* Stats Cards */}
                <div className="p-4 grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                        <p className="text-2xl font-bold text-purple-400">{points || 0}</p>
                        <p className="text-xs text-gray-400">Total Poin</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                        <p className="text-2xl font-bold" style={{ color: tierColor.primary }}>{getTierIcon(calculatedTier)}</p>
                        <p className="text-xs text-gray-400">{getTierName(calculatedTier)}</p>
                    </div>
                </div>

                {/* Tier Progress */}
                {progress.nextTier && (
                    <div className="px-4 pb-4">
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Progress ke {getTierName(progress.nextTier)}</span>
                                <span className="font-bold">{Math.round(progress.percentage)}%</span>
                            </div>
                            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                    style={{
                                        width: `${progress.percentage}%`,
                                        background: `linear-gradient(90deg, ${tierColor.primary}, ${getTierColor(progress.nextTier).primary})`
                                    }}
                                ></div>
                            </div>

                        </div>
                    </div>
                )}

                {/* Content scrollable area */}
                <div className="px-4 pb-4 overflow-y-auto max-h-[40vh] space-y-4">
                    {/* Benefits */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                            <span>🎁</span>
                            <span>Keuntungan {getTierName(calculatedTier)}</span>
                        </h3>
                        <ul className="space-y-2">
                            {benefits.map((benefit, idx) => (
                                <li key={idx} className="flex items-center gap-3 text-sm">
                                    <span className="text-lg">{benefit.icon}</span>
                                    <span className="text-gray-300">{benefit.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Recent Activities */}
                    {recentActivities.length > 0 && (
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                                <span>📊</span>
                                <span>Aktivitas Terakhir</span>
                            </h3>
                            <ul className="space-y-2">
                                {recentActivities.slice(0, 5).map((activity, idx) => (
                                    <li key={idx} className="flex justify-between items-center text-sm py-2 border-b border-white/5 last:border-0">
                                        <div>
                                            <p className="text-gray-300">
                                                {new Date(activity.date).toLocaleDateString('id-ID', {
                                                    day: 'numeric',
                                                    month: 'short'
                                                })}
                                            </p>
                                            <p className="text-xs text-gray-500">{formatCurrency(activity.total)}</p>
                                        </div>
                                        <span className="text-green-400 font-bold">+{activity.pointsEarned} poin</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold transition-all shadow-lg"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
