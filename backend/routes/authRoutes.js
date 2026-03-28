const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const PinAuthController = require('../controllers/PinAuthController');
const { checkJwt } = require('../middleware/auth'); // Use existing checkJwt from middleware
const { strictLimiter } = require('../middleware/rateLimiter');
const tenantResolver = require('../middleware/tenantResolver');

// Public
router.post('/login', strictLimiter, AuthController.login);

// PIN Auth Public
router.post('/auth/verify-google-pin', strictLimiter, PinAuthController.verifyGooglePin);
router.post('/auth/request-pin-reset', strictLimiter, PinAuthController.requestPinReset);
router.post('/auth/reset-google-pin', strictLimiter, PinAuthController.verifyPinResetCodeAndSetNew);

// Protected (Verify Token)
router.get('/check', checkJwt, AuthController.checkAuth);
router.post('/logout', checkJwt, AuthController.logout);

// PIN Settings Protected (tenantResolver required for Employee tenant-scoped queries)
router.get('/auth/pin-status', checkJwt, tenantResolver, PinAuthController.getPinStatus);
router.post('/auth/toggle-pin-security', checkJwt, tenantResolver, PinAuthController.togglePinSecurity);
router.post('/auth/change-pin', checkJwt, tenantResolver, PinAuthController.changePin);
router.post('/auth/set-pin-security', checkJwt, PinAuthController.setPin);

module.exports = router;
