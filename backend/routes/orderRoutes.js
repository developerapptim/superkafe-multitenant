const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');
const { checkApiKey } = require('../middleware/auth');
const { uploadPayment, optimizePayment } = require('../middleware/uploadMiddleware');
const { strictLimiter } = require('../middleware/rateLimiter');
const { validateRequest, orderSchema } = require('../middleware/validator');
const tenantResolver = require('../middleware/tenantResolver');
const { checkSubscription } = require('../middleware/subscriptionGuard');
const checkIdempotency = require('../middleware/idempotency');

// Apply tenantResolver globally to all order routes
router.use(tenantResolver);

// router.use(checkApiKey); // Optional: if some are public, don't use global use

router.get('/', checkApiKey, OrderController.getOrders);
router.get('/today', OrderController.getTodayOrders); // Public status sync
router.get('/pending-count', checkApiKey, OrderController.getPendingCount); // New: Pending count for badge
router.post('/merge', checkApiKey, OrderController.mergeOrders); // New: Merge orders
router.get('/:id', checkApiKey, OrderController.getOrderById); // New
// Public-ish endpoint (secured by API Key) to check existing orders
router.post('/check-phone', checkApiKey, OrderController.checkPhone);

router.post('/', strictLimiter, checkIdempotency, checkSubscription, uploadPayment.single('paymentProof'), optimizePayment, validateRequest(orderSchema), OrderController.createOrder);

router.patch('/:id/status', checkApiKey, OrderController.updateOrderStatus);
router.patch('/:id/pay', checkApiKey, OrderController.payOrder); // Fix: Add pay route
router.post('/:id/void', checkApiKey, OrderController.voidOrder); // New: Secure Void Route
router.delete('/:id', checkApiKey, OrderController.deleteOrder); // New: Delete Route

module.exports = router;
