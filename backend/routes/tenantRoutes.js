const express = require('express');
const router = express.Router();
const TenantController = require('../controllers/TenantController');

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

// PATCH /api/tenants/:id/toggle - Toggle status aktif/nonaktif tenant
router.patch('/:id/toggle', TenantController.toggleTenantStatus);

module.exports = router;
