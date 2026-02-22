const express = require('express');
const router = express.Router();
const UnifiedAuthController = require('../controllers/UnifiedAuthController');

/**
 * Unified Auth Routes
 * 
 * Simplified registration & login (no tenant required)
 */

// POST /api/auth/register - Register user baru
router.post('/register', UnifiedAuthController.register);

// POST /api/auth/login - Login user
router.post('/login', UnifiedAuthController.login);

// POST /api/auth/google - Google OAuth
router.post('/google', UnifiedAuthController.googleAuth);

// POST /api/auth/verify-otp - Verify OTP
router.post('/verify-otp', UnifiedAuthController.verifyOTP);

// POST /api/auth/resend-otp - Resend OTP
router.post('/resend-otp', UnifiedAuthController.resendOTP);

module.exports = router;
