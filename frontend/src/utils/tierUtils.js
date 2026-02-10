/**
 * Tier Utility Functions for Loyalty Points System
 * Uses dynamic thresholds from admin settings
 */

/**
 * Default tier thresholds (used if settings not available)
 */
export const DEFAULT_THRESHOLDS = {
    silver: 500000,  // Rp 500.000
    gold: 2000000    // Rp 2.000.000
};

export const DEFAULT_POINT_RATIO = 10000; // 1 point per Rp 10.000

/**
 * Tier colors for UI
 */
export const TIER_COLORS = {
    bronze: {
        primary: '#CD7F32',
        bg: 'rgba(205, 127, 50, 0.2)',
        border: 'rgba(205, 127, 50, 0.4)',
        gradient: 'from-amber-700 to-amber-500'
    },
    silver: {
        primary: '#C0C0C0',
        bg: 'rgba(192, 192, 192, 0.2)',
        border: 'rgba(192, 192, 192, 0.4)',
        gradient: 'from-gray-400 to-gray-300'
    },
    gold: {
        primary: '#FFD700',
        bg: 'rgba(255, 215, 0, 0.2)',
        border: 'rgba(255, 215, 0, 0.4)',
        gradient: 'from-yellow-500 to-yellow-300'
    }
};

/**
 * Calculate tier based on total spent
 * @param {number} totalSpent - Customer's total spending
 * @param {object} thresholds - { silver, gold } from settings
 * @returns {string} 'bronze' | 'silver' | 'gold'
 */
export function calculateTier(totalSpent, thresholds = DEFAULT_THRESHOLDS) {
    if (totalSpent >= thresholds.gold) return 'gold';
    if (totalSpent >= thresholds.silver) return 'silver';
    return 'bronze';
}

/**
 * Calculate progress to next tier
 * @param {number} totalSpent - Customer's total spending
 * @param {object} thresholds - { silver, gold } from settings
 * @returns {object} { percentage, currentTier, nextTier, remaining }
 */
export function calculateTierProgress(totalSpent, thresholds = DEFAULT_THRESHOLDS) {
    const currentTier = calculateTier(totalSpent, thresholds);

    if (currentTier === 'gold') {
        return {
            percentage: 100,
            currentTier: 'gold',
            nextTier: null,
            remaining: 0
        };
    }

    if (currentTier === 'silver') {
        const progress = ((totalSpent - thresholds.silver) / (thresholds.gold - thresholds.silver)) * 100;
        return {
            percentage: Math.min(progress, 100),
            currentTier: 'silver',
            nextTier: 'gold',
            remaining: thresholds.gold - totalSpent
        };
    }

    // Bronze
    const progress = (totalSpent / thresholds.silver) * 100;
    return {
        percentage: Math.min(progress, 100),
        currentTier: 'bronze',
        nextTier: 'silver',
        remaining: thresholds.silver - totalSpent
    };
}

export const TIER_MULTIPLIERS = {
    bronze: 1,
    silver: 1.25,
    gold: 1.5
};

/**
 * Calculate points earned from order total
 * @param {number} orderTotal - Order total amount
 * @param {number} pointRatio - Amount per 1 point (e.g., 10000 = 1 point per Rp 10.000)
 * @param {string} tier - Customer tier ('bronze' | 'silver' | 'gold')
 * @returns {number} Points earned
 */
export function calculatePointsEarned(orderTotal, pointRatio = DEFAULT_POINT_RATIO, tier = 'bronze') {
    const basePoints = Math.floor(orderTotal / pointRatio);
    const multiplier = TIER_MULTIPLIERS[tier] || 1;
    return Math.floor(basePoints * multiplier);
}

/**
 * Get tier color configuration
 * @param {string} tier - 'bronze' | 'silver' | 'gold'
 * @returns {object} Color config
 */
export function getTierColor(tier) {
    return TIER_COLORS[tier] || TIER_COLORS.bronze;
}

/**
 * Get tier icon emoji
 * @param {string} tier - 'bronze' | 'silver' | 'gold'
 * @returns {string} Emoji
 */
export function getTierIcon(tier) {
    switch (tier) {
        case 'gold': return '🥇';
        case 'silver': return '🥈';
        default: return '🥉';
    }
}

/**
 * Get tier display name in Indonesian
 * @param {string} tier - 'bronze' | 'silver' | 'gold'
 * @returns {string} Display name
 */
export function getTierName(tier) {
    switch (tier) {
        case 'gold': return 'Gold';
        case 'silver': return 'Silver';
        default: return 'Bronze';
    }
}

/**
 * Get benefits for current tier
 * @param {string} tier - 'bronze' | 'silver' | 'gold'
 * @returns {Array} Benefits list
 */
export function getTierBenefits(tier) {
    const benefits = {
        bronze: [
            { icon: '🎁', text: 'Kumpulkan poin setiap transaksi (1x)' },
            { icon: '📊', text: 'Lacak riwayat transaksi' }
        ],
        silver: [
            { icon: '🎁', text: 'Kumpulkan poin lebih cepat (1.25x)' },
            { icon: '📊', text: 'Lacak riwayat transaksi' },
            { icon: '🎂', text: 'Bonus poin di hari ulang tahun' },
            { icon: '⚡', text: 'Prioritas antrian' }
        ],
        gold: [
            { icon: '🎁', text: 'Kumpulkan poin maksimal (1.5x)' },
            { icon: '📊', text: 'Lacak riwayat transaksi' },
            { icon: '🎂', text: 'Bonus poin 2x di hari ulang tahun' },
            { icon: '⚡', text: 'Prioritas antrian VIP' },
            { icon: '🏷️', text: 'Diskon eksklusif member Gold' },
            { icon: '☕', text: 'Free upgrade minuman' }
        ]
    };
    return benefits[tier] || benefits.bronze;
}

/**
 * Format currency to Indonesian Rupiah
 * @param {number} value - Currency value
 * @returns {string} Formatted currency
 */
export function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(value || 0);
}
