const Expense = require('../models/Expense');
const Shift = require('../models/Shift');
const CashTransaction = require('../models/CashTransaction');
const Debt = require('../models/Debt');
const Order = require('../models/Order');
const OperationalExpense = require('../models/OperationalExpenses');

// === EXPENSES (Legacy Support?) ===
// Kept if other parts use it, but generic generic CashTransaction is preferred.
const getExpenses = async (req, res) => {
    try {
        const { startDate, endDate, category } = req.query;
        let query = {};
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }
        if (category) query.category = category;
        const expenses = await Expense.find(query).sort({ date: -1 });
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

const addExpense = async (req, res) => {
    try {
        const { category, amount, description, paymentMethod, date } = req.body;
        const newExpense = new Expense({
            id: `exp_${Date.now()}`,
            category,
            amount: Number(amount),
            description,
            paymentMethod: paymentMethod || 'Tunai',
            date: date || new Date()
        });
        await newExpense.save();

        // Also log as CashTransaction if Tunai
        if (newExpense.paymentMethod === 'Tunai') {
            // ... Logic duplication? ideally we unify.
            // But for now let's just save Expense.
        }
        res.status(201).json(newExpense);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

const getSummary = async (req, res) => {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const expenses = await Expense.aggregate([
            { $match: { date: { $gte: startOfMonth } } },
            { $group: { _id: '$category', total: { $sum: '$amount' } } }
        ]);
        const totalExpense = expenses.reduce((sum, item) => sum + item.total, 0);
        res.json({
            month: startOfMonth.toLocaleString('default', { month: 'long' }),
            total: totalExpense,
            breakdown: expenses
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// === CASH TRANSACTION CRUD (New for /api/cash-transactions) ===
const getCashTransactions = async (req, res) => {
    try {
        const transactions = await CashTransaction.find().sort({ createdAt: -1 });
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

const addCashTransaction = async (req, res) => {
    try {
        const { type, amount, category, description, paymentMethod } = req.body;

        const newItem = new CashTransaction({
            id: `trans_${Date.now()}`,
            type, // 'in' or 'out'
            amount: Number(amount),
            category,
            description,
            paymentMethod: paymentMethod || 'cash',
            date: new Date().toISOString(),
            time: new Date().toLocaleTimeString('id-ID', { hour12: false })
        });

        await newItem.save();

        // Update Active Shift if Cash
        if (newItem.paymentMethod === 'cash') {
            const activeShift = await Shift.findOne({ status: 'OPEN' }); // Check 'OPEN' or 'active' (Shift model usually uses 'endTime: null')
            // Let's assume endTime: null is the check based on OrderController
            // But ShiftController usually manages this. 
            // Let's safe check active shift logic from OrderController: await Shift.findOne({ endTime: null });

            const shift = await Shift.findOne({ endTime: null });
            if (shift) {
                if (type === 'in') {
                    shift.currentCash = (shift.currentCash || 0) + newItem.amount;
                } else {
                    shift.currentCash = (shift.currentCash || 0) - newItem.amount;
                }

                // Add to adjustments log in shift?
                if (!shift.adjustments) shift.adjustments = [];
                shift.adjustments.push({
                    amount: type === 'in' ? newItem.amount : -newItem.amount,
                    description: `${type === 'in' ? 'Masuk' : 'Keluar'}: ${description || category}`,
                    timestamp: new Date()
                });

                await shift.save();
            }
        }

        res.status(201).json(newItem);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const deleteCashTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await CashTransaction.findOne({ id });

        if (item) {
            // Revert Shift balance if cash?
            if (item.paymentMethod === 'cash') {
                const shift = await Shift.findOne({ endTime: null });
                if (shift) {
                    if (item.type === 'in') {
                        shift.currentCash -= item.amount;
                    } else {
                        shift.currentCash += item.amount;
                    }
                    await shift.save();
                }
            }
            await CashTransaction.deleteOne({ id });
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// === CASH ANALYTICS ===
const getCashAnalytics = async (req, res) => {
    try {
        // Real Aggregation from CashTransactions
        // 1. Daily Data (Last 7 Days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const transactions = await CashTransaction.find({
            createdAt: { $gte: sevenDaysAgo }
        });

        // Group by Date for Chart
        // TODO: Implement proper grouping. For now return empty or simple.

        // 2. Totals
        // We can aggregate all time or this month? User prompt screenshot shows "Estimasi Laba Bersih".
        // Let's just return basic sums for now.

        const allTrans = await CashTransaction.find();
        const totalIncome = allTrans.filter(t => t.type === 'in').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = allTrans.filter(t => t.type === 'out').reduce((sum, t) => sum + t.amount, 0);

        res.json({
            dailyData: [], // Populate if needed
            totalIncome,
            totalExpense,
            netProfit: totalIncome - totalExpense,
            totalSales: totalIncome, // Approx
            totalOperationalExpense: totalExpense // Approx
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const getCashBreakdown = async (req, res) => {
    try {
        // Need to return: { cashBalance, nonCashBalance, totalKasbon, totalPiutang }

        // 1. Shift Balance (Current Cash)
        const shift = await Shift.findOne({ endTime: null });
        const cashBalance = shift ? shift.currentCash : 0;
        const nonCashBalance = shift ? shift.currentNonCash : 0; // or calculate from transactions

        // 2. Debts
        const debts = await Debt.find({ status: 'pending' });
        const totalKasbon = debts.filter(d => d.type === 'kasbon').reduce((sum, d) => sum + d.amount, 0);
        const totalPiutang = debts.filter(d => d.type === 'piutang').reduce((sum, d) => sum + d.amount, 0);

        res.json({
            cashBalance,
            nonCashBalance,
            totalKasbon,
            totalPiutang
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// === DEBTS ===
const getDebts = async (req, res) => {
    try {
        const debts = await Debt.find().sort({ createdAt: -1 });
        res.json(debts);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

const addDebt = async (req, res) => {
    try {
        const { type, amount } = req.body;
        const item = new Debt({
            ...req.body,
            id: `debt_${Date.now()}`
        });
        await item.save();

        // If Kasbon (Employee Loan), money leaves Cash drawer
        if (type === 'kasbon') {
            const shift = await Shift.findOne({ endTime: null });
            if (shift) {
                shift.currentCash = (shift.currentCash || 0) - Number(amount);
                // Add adjustment?
                if (!shift.adjustments) shift.adjustments = [];
                shift.adjustments.push({
                    amount: -Number(amount),
                    description: `Kasbon: ${item.personName}`,
                    timestamp: new Date()
                });
                await shift.save();
            }
        }

        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

const updateDebt = async (req, res) => {
    try {
        const item = await Debt.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

const settleDebt = async (req, res) => {
    try {
        const item = await Debt.findOne({ id: req.params.id });
        if (!item) return res.status(404).json({ error: 'Not found' });

        item.status = 'settled';
        item.settledAt = new Date();
        await item.save();

        // If Kasbon settled (Employee pays back), money enters Cash
        // If Piutang settled (Customer pays), money enters Cash

        const shift = await Shift.findOne({ endTime: null });
        if (shift) {
            shift.currentCash = (shift.currentCash || 0) + item.amount;
            if (!shift.adjustments) shift.adjustments = [];
            shift.adjustments.push({
                amount: item.amount,
                description: `Pelunasan ${item.type}: ${item.personName}`,
                timestamp: new Date()
            });
            await shift.save();
        }

        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

const deleteDebt = async (req, res) => {
    try {
        await Debt.deleteOne({ id: req.params.id });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// === UNIFIED EXPENSE SYSTEM ===
const unifiedExpense = async (req, res) => {
    try {
        const { amount, category, paymentMethod, description, date, proofImage, notes, personName } = req.body;
        const numAmount = Number(amount);

        if (!amount || numAmount <= 0) {
            return res.status(400).json({ error: 'Jumlah harus lebih dari 0' });
        }

        const dateObj = date ? new Date(date) : new Date();
        const actionsTaken = [];
        let newOpEx = null;
        let newCashTx = null;
        let newDebt = null;

        // 1. Determine if OpEx (Operational Expense)
        // Non-OpEx categories: 'Tarik Tunai', 'Setor Bank', 'Kasbon', 'Lainnya (Non-OpEx)'
        // Note: 'Lainnya' usually OpEx, so we specify 'Lainnya (Non-OpEx)' if strictly non-expense
        const nonOpExCategories = ['Tarik Tunai', 'Setor Bank', 'Kasbon', 'Lainnya (Non-OpEx)'];
        const isOpEx = !nonOpExCategories.includes(category);

        // 2. Determine Transaction Type & Source
        // paymentMethod: 'cash_drawer', 'cash_main', 'transfer'
        // Backward compatibility: 'Tunai' -> 'cash_drawer', 'Transfer' -> 'transfer'

        let normalizedPaymentMethod = paymentMethod;
        if (paymentMethod === 'Tunai') normalizedPaymentMethod = 'cash_drawer';
        if (paymentMethod === 'Transfer') normalizedPaymentMethod = 'transfer';
        if (!normalizedPaymentMethod) normalizedPaymentMethod = 'cash_drawer'; // Default

        const isCashDrawer = normalizedPaymentMethod === 'cash_drawer';
        const isCashMain = normalizedPaymentMethod === 'cash_main';

        // 3. Handle Cash Flow Logic FIRST (Consistency Check)
        // We create CashTransaction for BOTH Drawer and Main for recording purposes, 
        // BUT only Drawer outcome affects the active Shift balance.
        if (isCashDrawer || isCashMain) {
            const shift = await Shift.findOne({ endTime: null });

            // Create Cash Transaction
            newCashTx = new CashTransaction({
                id: `trans_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'out',
                amount: numAmount,
                category: category,
                description: description || `Pengeluaran: ${category}`,
                paymentMethod: normalizedPaymentMethod, // Save specific method
                date: dateObj.toISOString(),
                time: dateObj.toLocaleTimeString('id-ID', { hour12: false })
            });
            await newCashTx.save();
            actionsTaken.push(`CashTransaction Created (${isCashDrawer ? 'Drawer' : 'Main Office'})`);

            // Update Shift ONLY if Cash Drawer
            if (isCashDrawer && shift) {
                shift.currentCash = (shift.currentCash || 0) - numAmount;
                if (!shift.expenseIds) shift.expenseIds = [];
                shift.expenseIds.push(newCashTx.id);

                await shift.save();
                actionsTaken.push('Shift Balance Deducted');
            }
        }

        // 4. Handle Kasbon (Debt) Logic
        const isKasbon = category === 'Kasbon Karyawan' || category === 'Kasbon';

        if (isKasbon) {
            if (!personName) {
                return res.status(400).json({ error: 'Nama pegawai wajib diisi untuk kasbon' });
            }

            newDebt = new Debt({
                id: `debt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: 'kasbon',
                personName: personName,
                amount: numAmount,
                description: description || 'Kasbon via Unified Expense',
                status: 'pending',
                createdAt: dateObj
            });
            await newDebt.save();
            actionsTaken.push('Debt (Kasbon) Created');
        }

        // 5. Handle Operational Expense Logic
        if (isOpEx) {
            newOpEx = new OperationalExpense({
                id: `opex_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                category,
                amount: numAmount,
                description: description || '-',
                paymentMethod: normalizedPaymentMethod,
                date: dateObj,
                notes,
                proofImage,
                createdBy: req.user ? (req.user.name || req.user.username) : 'System'
            });
            await newOpEx.save();
            actionsTaken.push('OperationalExpense Created');
        }

        res.status(201).json({
            message: 'Pengeluaran berhasil dicatat',
            actions: actionsTaken,
            data: {
                opex: newOpEx,
                cashTx: newCashTx,
                debt: newDebt,
                paymentMethod: normalizedPaymentMethod
            }
        });

    } catch (err) {
        console.error('Unified Expense Error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
};

// === PROFIT & LOSS REPORT (Global Margin System) ===
const getProfitLoss = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let dateFilter = {};
        let orderDateFilter = {};

        if (startDate || endDate) {
            dateFilter.date = {};
            orderDateFilter.timestamp = {};

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                dateFilter.date.$gte = start;
                orderDateFilter.timestamp.$gte = start.getTime();
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateFilter.date.$lte = end;
                orderDateFilter.timestamp.$lte = end.getTime();
            }
        }

        // 1. Calculate Gross Sales & COGS (HPP) from Orders
        // Only count PAID or DONE orders
        const orders = await Order.find({
            ...orderDateFilter,
            $or: [{ status: 'done' }, { paymentStatus: 'paid' }]
        }).select('total items.hpp_locked subtotal voucherDiscount');

        let totalSales = 0;
        let totalHPP = 0;
        let totalDiscounts = 0;

        orders.forEach(o => {
            totalSales += (o.total || 0);
            totalDiscounts += (o.voucherDiscount || 0);

            // Sum up HPP from items
            if (o.items && Array.isArray(o.items)) {
                o.items.forEach(item => {
                    totalHPP += (Number(item.hpp_locked) * Number(item.qty || item.count || 0)) || 0;
                });
            }
        });

        // 2. Calculate Operational Expenses (OpEx)
        const opexQuery = { ...dateFilter, isDeleted: false };
        const opexList = await OperationalExpense.aggregate([
            { $match: opexQuery },
            { $group: { _id: '$category', total: { $sum: '$amount' } } }
        ]);

        let totalOpEx = 0;
        const opexBreakdown = {};

        opexList.forEach(op => {
            totalOpEx += op.total;
            opexBreakdown[op._id] = op.total;
        });

        // 3. Final Calculations
        const grossProfit = totalSales - totalHPP;
        const netProfit = grossProfit - totalOpEx;

        // Margin Percentages
        const grossMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
        const netMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

        res.json({
            period: { startDate, endDate },
            sales: {
                totalRevenue: totalSales,
                totalDiscounts,
                transactionCount: orders.length
            },
            cogs: {
                totalHPP,
                percentOfSales: totalSales > 0 ? (totalHPP / totalSales) * 100 : 0
            },
            expenses: {
                totalOpEx,
                breakdown: opexBreakdown
            },
            profit: {
                grossProfit,
                grossMargin: parseFloat(grossMargin.toFixed(2)),
                netProfit,
                netMargin: parseFloat(netMargin.toFixed(2))
            }
        });

    } catch (err) {
        console.error('P&L Error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
};

module.exports = {
  getExpenses,
  addExpense,
  getSummary,
  getCashTransactions,
  addCashTransaction,
  deleteCashTransaction,
  getCashAnalytics,
  getCashBreakdown,
  getDebts,
  addDebt,
  updateDebt,
  settleDebt,
  deleteDebt,
  unifiedExpense,
  getProfitLoss
};
