const express = require('express');
const router = express.Router();
const VerificationController = require('../controllers/VerificationController');

/**
 * Routes untuk email verification
 */

// POST /api/verify/otp - Verifikasi OTP code
router.post('/otp', VerificationController.verifyOTP);

// POST /api/verify/resend-otp - Kirim ulang OTP code
router.post('/resend-otp', VerificationController.resendOTP);

module.exports = router;
