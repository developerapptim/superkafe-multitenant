const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { checkJwt } = require('../middleware/auth'); // Use existing checkJwt from middleware
const { strictLimiter } = require('../middleware/rateLimiter');

// Public
router.post('/login', strictLimiter, AuthController.login);
router.post('/auth/login', strictLimiter, AuthController.login); // Legacy

// Protected (Verify Token)
// Protected (Verify Token)
router.get('/check', checkJwt, AuthController.checkAuth);
router.post('/logout', checkJwt, AuthController.logout);

module.exports = router;
