const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/CustomerController');
const { checkApiKey } = require('../middleware/auth');

router.use(checkApiKey);

router.get('/search', CustomerController.searchCustomers);
router.get('/points/:phone', CustomerController.getCustomerPoints); // Loyalty points lookup
router.get('/', CustomerController.getCustomers);
router.post('/', CustomerController.upsertCustomer); // Combined Create/Update
router.get('/:id/analytics', CustomerController.getAnalytics);

module.exports = router;
