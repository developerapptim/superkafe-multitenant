const express = require('express');
const router = express.Router();
const FinanceController = require('../controllers/FinanceController');
const { checkJwt } = require('../middleware/auth');

router.use(checkJwt);

router.get('/expenses', FinanceController.getExpenses);
router.post('/expenses', FinanceController.addExpense);
// Reports
router.get('/summary', FinanceController.getSummary);
router.post('/unified-expense', FinanceController.unifiedExpense); // Unified Expense
router.get('/profit-loss', FinanceController.getProfitLoss); // New P&L Report

module.exports = router;
