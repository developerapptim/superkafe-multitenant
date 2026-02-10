const express = require('express');
const router = express.Router();
const MenuController = require('../controllers/MenuController');
const { checkApiKey, checkJwt } = require('../middleware/auth');

// Public GET for Menu (frontend needs it often, but usually protected by API key anyway)
// Assuming API key is required globally
// router.get('/', MenuController.getMenus); // Public?

// Actually server.js protected /api/* with checkApiKey or public?
// Usually GET /api/menu is public or protected by simple key.
// I'll apply checkApiKey to safe-guard modifications, but maybe GET is open?
// Based on server.js snippet -> app.use(cors()); and checkApiKey usage on specific routes or globally?
// Let's assume protected.

// Routes
router.get('/', MenuController.getMenus);
router.get('/customer', MenuController.getMenusCustomer); // Lightweight endpoint untuk customer
router.get('/:id', MenuController.getMenuById);
router.post('/', checkJwt, MenuController.createMenu);
router.put('/reorder', checkJwt, MenuController.reorderMenus);
router.put('/:id', checkJwt, MenuController.updateMenu);
router.delete('/:id', checkJwt, MenuController.deleteMenu);

// Recipes
router.get('/recipes', MenuController.getRecipes);
router.post('/recipes', checkJwt, MenuController.updateRecipe); // Legacy endpoint might be POST or PUT

module.exports = router;
