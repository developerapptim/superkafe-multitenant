const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/CategoryController');
const { checkApiKey } = require('../middleware/auth');

// Public GET
router.get('/', CategoryController.getAll);

// Protected Write
router.post('/', checkApiKey, CategoryController.create);
// Reorder Update
router.put('/reorder', checkApiKey, CategoryController.reorder);

router.put('/:id', checkApiKey, CategoryController.update);
router.delete('/:id', checkApiKey, CategoryController.delete);

module.exports = router;
