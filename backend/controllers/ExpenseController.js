const fs = require('fs');
const path = require('path');

const isOwner = (req) => {
    const logPath = path.join(__dirname, '../debug_rbac.txt');
    const logMsg = `[${new Date().toISOString()}] User: ${JSON.stringify(req.user)} | Role: ${req.user?.role}\n`;
    fs.appendFileSync(logPath, logMsg);

    // Allow Owner, Admin, or Administrator (case-insensitive just in case)
    const role = req.user?.role?.toLowerCase();
    return req.user && (role === 'owner' || role === 'admin' || role === 'administrator');
};

exports.getExpenses = async (req, res) => {
    try {
        const { startDate, endDate, category, search, page, limit } = req.query;
        let query = { isDeleted: false };

        // Date Filter
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        // Category Filter
        if (category && category !== 'all') {
            query.category = category;
        }

        // Search (Description)
        if (search) {
            query.description = { $regex: search, $options: 'i' };
        }

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const skip = (pageNum - 1) * limitNum;

        const totalItems = await OperationalExpense.countDocuments(query);
        const expenses = await OperationalExpense.find(query)
            .sort({ date: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            data: expenses,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalItems / limitNum),
                totalItems,
                hasMore: pageNum < Math.ceil(totalItems / limitNum)
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getExpenseById = async (req, res) => {
    try {
        const item = await OperationalExpense.findOne({ id: req.params.id, isDeleted: false });
        if (!item) return res.status(404).json({ error: 'Not found' });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createExpense = async (req, res) => {
    try {
        // RBAC Check (Extra safety if middleware fails/missed)
        if (!isOwner(req)) {
            return res.status(403).json({ error: 'Access denied. Owner only.' });
        }

        const { category, amount, description, paymentMethod, date, notes } = req.body;

        if (Number(amount) < 0) {
            return res.status(400).json({ error: 'Amount cannot be negative' });
        }

        const newItem = new OperationalExpense({
            id: `opex_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            category,
            amount: Number(amount),
            description,
            paymentMethod: paymentMethod || 'Tunai',
            date: date || new Date(),
            notes,
            createdBy: req.user.name || req.user.username || 'System'
        });

        // Image Upload (handled via middleware/req.file if applicable, here assuming URL passed or implemented later)
        if (req.body.proofImage) {
            newItem.proofImage = req.body.proofImage;
        }

        await newItem.save();

        await logActivity({
            req,
            action: 'CREATE_EXPENSE',
            module: 'FINANCE',
            description: `Created expense: ${category} - Rp ${amount}`,
            metadata: { id: newItem.id, amount, category }
        });

        res.status(201).json(newItem);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateExpense = async (req, res) => {
    try {
        if (!isOwner(req)) return res.status(403).json({ error: 'Access denied' });

        const { id } = req.params;
        const updates = req.body;

        const item = await OperationalExpense.findOne({ id, isDeleted: false });
        if (!item) return res.status(404).json({ error: 'Not found' });

        // Backup for log
        const oldAmount = item.amount;

        // Prevent changing ID or isDeleted manually
        delete updates.id;
        delete updates.isDeleted;
        delete updates.createdBy;

        updates.updatedBy = req.user.name || 'System';

        const updatedItem = await OperationalExpense.findOneAndUpdate(
            { id },
            { $set: updates },
            { new: true }
        );

        await logActivity({
            req,
            action: 'UPDATE_EXPENSE',
            module: 'FINANCE',
            description: `Updated expense: ${item.description}`,
            metadata: {
                id,
                oldAmount,
                newAmount: updatedItem.amount,
                changes: updates
            }
        });

        res.json(updatedItem);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        if (!isOwner(req)) return res.status(403).json({ error: 'Access denied' });

        const { id } = req.params;
        const item = await OperationalExpense.findOne({ id, isDeleted: false });

        if (!item) return res.status(404).json({ error: 'Not found' });

        // Soft Delete
        item.isDeleted = true;
        item.deletedAt = new Date();
        item.deletedBy = req.user.name || 'System';

        await item.save();

        await logActivity({
            req,
            action: 'DELETE_EXPENSE',
            module: 'FINANCE',
            description: `Deleted expense: ${item.category} - ${item.description}`,
            metadata: { id }
        });

        res.json({ message: 'Expense deleted successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
