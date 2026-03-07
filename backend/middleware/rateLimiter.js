const rateLimit = require('express-rate-limit');

// Helper to use User ID if available, otherwise fallback to Tenant ID or IP Address
const keyGenerator = (req) => {
    return req.user?.id || req.tenant?.id || req.ip;
};

// Global Limiter (Optional/General use)
const globalLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100, // 100 requests per 10 mins per User/IP
    message: { error: 'Terlalu banyak request, silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator
});

// Strict Limiter for sensitive endpoints (Login, Register, Checkout)
const strictLimiter = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: 5, // Limit each User/IP to 5 requests per windowMs
    message: { error: 'Terlalu banyak percobaan pada endpoint sensitif. Silakan coba lagi setelah 3 menit.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator
});

module.exports = {
    globalLimiter,
    strictLimiter
};
