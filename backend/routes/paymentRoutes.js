const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
const { checkJwt } = require('../middleware/auth');

/**
 * Payment Routes
 * Mengikuti THE TRINITY RULE dari AI_RULES.md
 */

// POST /api/payments/create-invoice - Create payment invoice
router.post('/create-invoice', checkJwt, PaymentController.createInvoice);

// POST /api/payments/callback - Handle payment callback (no auth - dari Duitku)
router.post('/callback', PaymentController.handleCallback);

// GET /api/payments/status/:merchantOrderId - Check payment status
router.get('/status/:merchantOrderId', checkJwt, PaymentController.checkStatus);

// GET /api/payments/pricing - Get pricing plans
router.get('/pricing', PaymentController.getPricing);

// POST /api/payments/guest-checkout - Guest checkout (no auth required)
// Used for Duitku verification and landing page checkout
router.post('/guest-checkout', PaymentController.createGuestInvoice);

module.exports = router;
