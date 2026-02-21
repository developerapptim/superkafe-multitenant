const express = require('express');
const router = express.Router();
const SetupController = require('../controllers/SetupController');
const { checkJwt } = require('../middleware/auth');

/**
 * Setup Routes
 * 
 * Tenant setup wizard
 */

// POST /api/setup/tenant - Setup tenant baru (requires auth)
router.post('/tenant', checkJwt, SetupController.setupTenant);

// GET /api/setup/check-slug/:slug - Cek ketersediaan slug
router.get('/check-slug/:slug', SetupController.checkSlug);

module.exports = router;
