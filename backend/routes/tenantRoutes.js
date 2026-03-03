const express = require('express');
const router = express.Router();
const TenantController = require('../controllers/TenantController');
const { checkJwt } = require('../middleware/auth');

/**
 * Routes untuk manajemen tenant
 * Mengikuti THE TRINITY RULE dari AI_RULES.md
 */

// POST /api/tenants/register - Registrasi tenant baru
router.post('/register', TenantController.registerTenant);

// GET /api/tenants - Daftar semua tenant
router.get('/', TenantController.getAllTenants);

// GET /api/tenants/:slug - Detail tenant berdasarkan slug
router.get('/:slug', TenantController.getTenantBySlug);

// GET /api/tenants/:slug/trial-status - Status trial tenant
router.get('/:slug/trial-status', TenantController.getTrialStatus);

// PATCH /api/tenants/:id/toggle - Toggle status aktif/nonaktif tenant
router.patch('/:id/toggle', TenantController.toggleTenantStatus);

// PUT /api/tenants/:id/faqs - Update FAQs (Protected)
router.put('/:id/faqs', checkJwt, TenantController.updateFaqs);

module.exports = router;
