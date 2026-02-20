const express = require('express');
const router = express.Router();
const GlobalAuthController = require('../controllers/GlobalAuthController');
const { checkJwt } = require('../middleware/auth');

/**
 * Global Authentication Routes
 * Modern authentication system untuk SuperKafe
 */

// Global login dengan email (auto-detect tenant)
router.post('/global-login', GlobalAuthController.globalLogin);

// Login dengan PIN untuk shared tablet
router.post('/login-pin', GlobalAuthController.loginWithPIN);

// Get staff list untuk selection screen
router.get('/staff-list/:tenantSlug', GlobalAuthController.getStaffList);

// Verify admin PIN untuk override actions
router.post('/verify-admin-pin', GlobalAuthController.verifyAdminPIN);

// Set/update PIN untuk employee (requires authentication)
router.post('/set-pin', checkJwt, GlobalAuthController.setPIN);

module.exports = router;
