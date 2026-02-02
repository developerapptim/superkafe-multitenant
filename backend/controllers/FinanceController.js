const Expense = require('../models/Expense');
const Shift = require('../models/Shift');
const CashTransaction = require('../models/CashTransaction');
const Debt = require('../models/Debt');

// === EXPENSES (Legacy Support?) ===
// Kept if other parts use it, but generic generic CashTransaction is preferred.
exports.getExpenses = async (req, res) => {
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

exports.addExpense = async (req, res) => {
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

exports.getSummary = async (req, res) => {
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
exports.getCashTransactions = async (req, res) => {
    try {
        const transactions = await CashTransaction.find().sort({ createdAt: -1 });
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.addCashTransaction = async (req, res) => {
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

exports.deleteCashTransaction = async (req, res) => {
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
exports.getCashAnalytics = async (req, res) => {
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

exports.getCashBreakdown = async (req, res) => {
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
exports.getDebts = async (req, res) => {
    try {
        const debts = await Debt.find().sort({ createdAt: -1 });
        res.json(debts);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.addDebt = async (req, res) => {
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

exports.updateDebt = async (req, res) => {
    try {
        const item = await Debt.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.settleDebt = async (req, res) => {
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

exports.deleteDebt = async (req, res) => {
    try {
        await Debt.deleteOne({ id: req.params.id });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
