const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { checkJwt } = require('../middleware/auth');

// Protected Routes
// Protected Routes
router.put('/change-password', checkJwt, UserController.changePassword);
router.post('/reset-sessions', checkJwt, UserController.resetSessions);

module.exports = router;
