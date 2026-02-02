const Shift = require('../models/Shift');
const Order = require('../models/Order');
const ActivityLog = require('../models/ActivityLog'); // NEW: Activity Log Model
const logActivity = require('../utils/activityLogger'); // NEW: Activity Logger

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

        res.json({
            shiftId: shift.id,
            startCash: shift.startCash || 0,
            currentCash: shift.currentCash || 0,
            currentNonCash: shift.currentNonCash || 0, // This is tracked in OrderController now
            cashSales: shift.cashSales || 0, // Or calculate from orders?
            nonCashSales: shift.nonCashSales || 0
        });

    } catch (err) {
        console.error('Get balance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.endShift = async (req, res) => {
    try {
        const { endCash } = req.body; // Actual cash in drawer

        const shift = await Shift.findOne({ status: 'OPEN' });
        if (!shift) {
            return res.status(404).json({ error: 'No open shift found' });
        }

        const expectedCash = shift.currentCash || 0;
        const actualEndCash = Number(endCash) || 0;
        const difference = actualEndCash - expectedCash;

        shift.status = 'CLOSED';
        shift.endTime = new Date();
        shift.endCash = actualEndCash;
        shift.expectedCash = expectedCash;
        shift.difference = difference;

        await shift.save();

        await shift.save();

        await logActivity({ req, action: 'CLOSE_SHIFT', module: 'SHIFT', description: `Shift closed. Expected: ${expectedCash}, Actual: ${actualEndCash}, Diff: ${difference}`, metadata: { shiftId: shift.id, difference } });

        res.json({ success: true, shift });
    } catch (err) {
        console.error('End shift error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Alias for Close Shift (Request Requirement)
exports.closeShift = exports.endShift;

exports.getActivities = async (req, res) => {
    try {
        const logs = await ActivityLog.find().sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (err) {
        console.error('Get activities error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
