const express = require('express');
const router = express.Router();
const GoogleAuthController = require('../controllers/GoogleAuthController');

/**
 * Routes untuk Google Authentication
 */

// POST /api/auth/google - Login/Register dengan Google
router.post('/google', GoogleAuthController.googleAuth);

module.exports = router;
