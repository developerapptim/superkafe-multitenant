import { useState, useEffect } from 'react';
import PointsModal from './PointsModal';
import { customersAPI } from '../services/api';
import {
    calculateTier,
    getTierColor,
    getTierIcon,
    getTierName,
    calculateTierProgress,
    DEFAULT_THRESHOLDS
} from '../utils/tierUtils';

/**
 * Points Quick Card Component
 * Compact card showing customer points summary on PesananSaya page
 * Only visible when loyalty is enabled in settings
 * 
 * @param {Object} props
 * @param {string} props.phone - Customer phone number
 * @param {Object} props.settings - App settings including loyaltySettings
 */
export default function PointsQuickCard({ phone, settings }) {
    const [customerData, setCustomerData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Check if loyalty is enabled
    const loyaltyEnabled = settings?.loyaltySettings?.enableLoyalty;

    useEffect(() => {
        // Only fetch if loyalty is enabled and phone exists
        if (loyaltyEnabled && phone) {
            fetchCustomerPoints();
        } else {
            setLoading(false);
        }
    }, [phone, loyaltyEnabled]);

    const fetchCustomerPoints = async () => {
        try {
            const res = await customersAPI.getPoints(phone);
            setCustomerData(res.data);
        } catch (err) {
            console.error('Failed to fetch points:', err);
        } finally {
            setLoading(false);
        }
    };

    // Don't render if loyalty is disabled (after hooks)
    if (!loyaltyEnabled) return null;

    // Loading skeleton
    if (loading) {
        return (
            <div className="mb-6 animate-pulse">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-white/10"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-white/10 rounded w-24"></div>
                            <div className="h-3 bg-white/10 rounded w-32"></div>
                        </div>
                        <div className="w-20 h-8 bg-white/10 rounded-lg"></div>
                    </div>
                </div>
            </div>
        );
    }

    // Don't show if no phone number provided
    if (!phone || !customerData) return null;

    const { points, tier, totalSpent } = customerData;
    const thresholds = settings?.loyaltySettings?.tierThresholds || DEFAULT_THRESHOLDS;
    // Calculate tier from totalSpent (don't rely on backend tier which might be 'regular' or invalid)
    const calculatedTier = calculateTier(totalSpent || 0, thresholds);
    const progress = calculateTierProgress(totalSpent || 0, thresholds);
    const tierColor = getTierColor(calculatedTier);

    return (
        <>
            <div className="mb-6">
                <div
                    className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-2xl p-4 border border-purple-500/20 cursor-pointer hover:border-purple-500/40 transition-all"
                    onClick={() => setShowModal(true)}
                >
                    <div className="flex items-center gap-4">
                        {/* Tier Badge */}
                        <div
                            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg flex-shrink-0"
                            style={{
                                background: `linear-gradient(135deg, ${tierColor.primary}, ${tierColor.primary}99)`,
                                boxShadow: `0 4px 20px ${tierColor.primary}30`
                            }}
                        >
                            {getTierIcon(calculatedTier)}
                        </div>

                        {/* Points Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl font-bold text-white">{points || 0}</span>
                                <span className="text-gray-400 text-sm">Poin</span>
                                <span
                                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                                    style={{
                                        background: tierColor.bg,
                                        color: tierColor.primary,
                                        border: `1px solid ${tierColor.border}`
                                    }}
                                >
                                    {getTierName(calculatedTier)}
                                </span>
                            </div>

                            {/* Progress bar */}
                            {progress.nextTier && (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${progress.percentage}%`,
                                                background: `linear-gradient(90deg, ${tierColor.primary}, ${getTierColor(progress.nextTier).primary})`
                                            }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-gray-500">{Math.round(progress.percentage)}%</span>
                                </div>
                            )}
                        </div>

                        {/* View Detail Button */}
                        <button
                            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-purple-300 text-sm font-medium hover:bg-white/10 transition-all flex-shrink-0"
                        >
                            Detail →
                        </button>
                    </div>
                </div>
            </div>

            {/* Points Modal */}
            <PointsModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                customerData={customerData}
                settings={settings}
            />
        </>
    );
}
