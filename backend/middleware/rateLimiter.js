const rateLimit = require('express-rate-limit');

// Global Limiter (Optional/General use)
const globalLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100, // 100 requests per 10 mins
    message: { error: 'Terlalu banyak request, silakan coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict Limiter for sensitive endpoints (Login, Register, Checkout)
const strictLimiter = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: { error: 'Terlalu banyak percobaan pada endpoint sensitif. Silakan coba lagi setelah 3 menit.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    globalLimiter,
    strictLimiter
};
