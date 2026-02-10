const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');
const { checkApiKey } = require('../middleware/auth');
const { uploadPayment } = require('../middleware/uploadMiddleware');

// router.use(checkApiKey); // Optional: if some are public, don't use global use

router.get('/', checkApiKey, OrderController.getOrders);
router.get('/today', OrderController.getTodayOrders); // Public status sync
router.get('/pending-count', checkApiKey, OrderController.getPendingCount); // New: Pending count for badge
router.post('/merge', checkApiKey, OrderController.mergeOrders); // New: Merge orders
router.get('/:id', checkApiKey, OrderController.getOrderById); // New
// Public-ish endpoint (secured by API Key) to check existing orders
router.post('/check-phone', checkApiKey, OrderController.checkPhone);

router.post('/', uploadPayment.single('paymentProof'), OrderController.createOrder);

router.patch('/:id/status', checkApiKey, OrderController.updateOrderStatus);
router.patch('/:id/pay', checkApiKey, OrderController.payOrder); // Fix: Add pay route

module.exports = router;
