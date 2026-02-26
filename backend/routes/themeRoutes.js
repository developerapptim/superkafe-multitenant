const express = require('express');
const router = express.Router();
const ThemeController = require('../controllers/ThemeController');
const { checkJwt } = require('../middleware/auth');

// Apply JWT authentication middleware to all theme routes
router.use(checkJwt);

// GET /api/tenants/:tenantId/theme - Get current theme
router.get('/:tenantId/theme', ThemeController.getTheme);

// PUT /api/tenants/:tenantId/theme - Update theme
router.put('/:tenantId/theme', ThemeController.updateTheme);

module.exports = router;
