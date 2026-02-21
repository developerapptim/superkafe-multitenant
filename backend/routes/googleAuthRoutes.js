const express = require('express');
const router = express.Router();
const GoogleAuthController = require('../controllers/GoogleAuthController');

/**
 * Routes untuk Google Authentication
 * 
 * Supported Redirect URIs:
 * - Production: https://superkafe.com/api/auth/google/callback
 * - Development: http://localhost:5001/api/auth/google/callback
 * - Frontend Dev: http://localhost:5174
 */

// POST /api/auth/google - Login/Register dengan Google (Token-based)
router.post('/google', GoogleAuthController.googleAuth);

// GET /api/auth/google/callback - OAuth Callback (untuk redirect flow)
router.get('/google/callback', GoogleAuthController.googleCallback);

module.exports = router;
