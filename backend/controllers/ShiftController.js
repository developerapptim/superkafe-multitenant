const Shift = require('../models/Shift');
const Order = require('../models/Order');
const ActivityLog = require('../models/ActivityLog'); // NEW: Activity Log Model
const logActivity = require('../utils/activityLogger'); // NEW: Activity Logger
const Employee = require('../models/Employee'); // For auto-logout

exports.startShift = async (req, res) => {
    try {
        const { cashierName, startCash, userId } = req.body;

        // Check format 
        const openShift = await Shift.findOne({ status: 'OPEN' });
        if (openShift) {
            return res.status(400).json({ error: 'Shift already open', shift: openShift });
        }

        const newShift = new Shift({
            id: `shift_${Date.now()}`,
            cashierName,
            userId: userId || null, // Store userId if provided
            startCash: Number(startCash) || 0,
            currentCash: Number(startCash) || 0,
            status: 'OPEN',
            startTime: new Date()
        });

        await newShift.save();

        await logActivity({ req, action: 'OPEN_SHIFT', module: 'SHIFT', description: `Shift opened by ${cashierName}`, metadata: { shiftId: newShift.id, startCash } });

        res.status(201).json(newShift);
    } catch (err) {
        console.error('Start shift error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Alias for Open Shift (Request Requirement)
exports.openShift = exports.startShift;

exports.getCurrentShift = async (req, res) => {
    try {
        const shift = await Shift.findOne({ status: 'OPEN' });
        // Return null if no open shift (not 404, just null data)
        res.json(shift);
    } catch (err) {
        console.error('Get shift error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// New: Get Current Balance/Drawer Stats
exports.getCurrentBalance = async (req, res) => {
    try {
        const shift = await Shift.findOne({ status: 'OPEN' });

        if (!shift) {
            return res.json({
                shiftId: null,
                startCash: 0,
                currentCash: 0,
                currentNonCash: 0
            });
        }

        // Calculate Transaction Counts based on shiftId (Backend Source of Truth)
        const trxTotal = await Order.countDocuments({ shiftId: shift.id, status: { $ne: 'cancel' }, $or: [{ status: 'done' }, { paymentStatus: 'paid' }] });
        const trxCash = await Order.countDocuments({ shiftId: shift.id, paymentMethod: 'cash', status: { $ne: 'cancel' }, $or: [{ status: 'done' }, { paymentStatus: 'paid' }] });
        const trxNonCash = await Order.countDocuments({ shiftId: shift.id, paymentMethod: { $ne: 'cash' }, status: { $ne: 'cancel' }, $or: [{ status: 'done' }, { paymentStatus: 'paid' }] });

        res.json({
            shiftId: shift.id,
            startCash: shift.startCash || 0,
            currentCash: shift.currentCash || 0,
            currentNonCash: shift.currentNonCash || 0, // This is tracked in OrderController now
            cashSales: shift.cashSales || 0, // Or calculate from orders?
            nonCashSales: shift.nonCashSales || 0,
            cashierName: shift.cashierName, // Return cashier name for UI display
            startTime: shift.startTime, // Needed for filtering orders
            // Backend-calculated counts
            trxTotal,
            trxCash,
            trxNonCash
        });

    } catch (err) {
        console.error('Get balance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.endShift = async (req, res) => {
    try {
        const { endCash } = req.body; // Actual cash in drawer

        // 1. Find ALL open shifts (Handling potential duplicates/ghosts)
        const openShifts = await Shift.find({ status: 'OPEN' });

        if (openShifts.length === 0) {
            return res.status(404).json({ error: 'No open shift found' });
        }

        const actualEndCash = Number(endCash) || 0;
        const endTime = new Date();

        // 2. Close ALL of them
        for (const shift of openShifts) {
            const expectedCash = shift.currentCash || 0;
            // Note: The 'difference' here is calculated per shift based on the *same* actualEndCash
            // If endCash is meant for a single primary shift, this logic might need adjustment.
            // For closing all, it assumes actualEndCash is a global closing value or
            // that each shift's difference is calculated against this single endCash.
            const difference = actualEndCash - expectedCash;

            shift.status = 'CLOSED';
            shift.endTime = endTime;
            shift.endCash = actualEndCash; // This will be the same for all closed shifts
            shift.expectedCash = expectedCash;
            shift.difference = difference;
            await shift.save();

            // Auto-logout the user who owned this shift
            // Fallback to req.user.id if shift.userId is missing (legacy records)
            const targetUserId = shift.userId || req.user?.id;
            if (targetUserId) {
                await Employee.updateOne({ id: targetUserId }, { is_logged_in: false });
                console.log(`✅ Auto-logged out user ${targetUserId} for shift ${shift.id}`);
            }

            // Log for each closed shift
            await logActivity({ req, action: 'CLOSE_SHIFT', module: 'SHIFT', description: `Shift closed (Cleanup). Expected: ${expectedCash}, Actual: ${actualEndCash}, Diff: ${difference}`, metadata: { shiftId: shift.id, difference } });
        }

        res.json({ success: true, count: openShifts.length });
    } catch (err) {
        console.error('End shift error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Alias for Close Shift (Request Requirement)
exports.closeShift = exports.endShift;

exports.getShiftHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalItems = await Shift.countDocuments({ status: 'CLOSED' });
        const history = await Shift.find({ status: 'CLOSED' })
            .sort({ endTime: -1 })
            .skip(skip)
            .limit(limit);

        // Ensure variance is calculated if missing (backward compatibility)
        const processedHistory = history.map(shift => {
            const s = shift.toObject();
            if (s.variance === undefined && s.difference !== undefined) {
                s.variance = s.difference;
            }
            return s;
        });

        res.json({
            data: processedHistory,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                totalItems,
                hasMore: (page * limit) < totalItems
            }
        });
    } catch (err) {
        console.error('Get shift history error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getActivities = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20; // Default 20
        const skip = (page - 1) * limit;

        const totalItems = await ActivityLog.countDocuments();
        const logs = await ActivityLog.find()
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            data: logs,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                totalItems,
                hasMore: (page * limit) < totalItems
            }
        });
    } catch (err) {
        console.error('Get activities error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
