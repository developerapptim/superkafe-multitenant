const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/ExpenseController');
const { checkApiKey, checkJwt } = require('../middleware/auth');

// Apply Auth Middleware (JWT is preferred for RBAC, but supporting API Key if needed by legacy)
// RBAC is handled inside controller or we can add specific middleware here.
// Assuming /api/expenses is protected.

router.use(checkJwt); // Enforce Login

router.get('/', expenseController.getExpenses);
router.get('/:id', expenseController.getExpenseById);
router.post('/', expenseController.createExpense);
router.put('/:id', expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
