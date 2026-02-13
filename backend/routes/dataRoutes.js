const express = require('express');
const router = express.Router();
const DataController = require('../controllers/DataController');
const { checkApiKey } = require('../middleware/auth');

// Protected Routes
router.use(checkApiKey);

// Backup/Restore
router.get('/', DataController.getAllData);
router.post('/restore', DataController.restoreData); // Changed from '/' to '/restore' for clarity

// Admin Reset
router.post('/admin/reset', DataController.resetDatabase);
router.post('/admin/delete-transactions', DataController.deleteTransactions);
router.delete('/admin/collection/:name', DataController.deleteCollection);

module.exports = router;
