const express = require('express');
const router = express.Router();
const InventoryController = require('../controllers/InventoryController');
const { checkApiKey, checkJwt } = require('../middleware/auth');

// Apply JWT check to all for tracking user actions
router.use(checkJwt);

router.get('/', InventoryController.getInventory);
router.get('/stats', InventoryController.getInventoryStats);
router.post('/', InventoryController.addInventory);
router.put('/:id', InventoryController.updateInventory);
router.delete('/:id', InventoryController.deleteInventory);
router.put('/:id/stock', InventoryController.updateStock);
router.post('/restock', InventoryController.restockIngredient); // Restock with Moving Average
router.get('/top-usage', InventoryController.getTopUsage); // New Endpoint


// Stock History API (Moved from server.js)
router.get('/:id/history', InventoryController.getHistoryByIngredientId);
router.get('/history', InventoryController.getStockHistory);
router.post('/history', InventoryController.addStockHistory);

module.exports = router;
