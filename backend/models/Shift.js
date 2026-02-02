const mongoose = require('mongoose');

// Shift Model
const ShiftSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    cashierName: String, // New field
    startCash: { type: Number, default: 0 },
    endCash: Number,
    expectedCash: { type: Number, default: 0 }, // New field: Calculated system cash
    difference: { type: Number, default: 0 }, // New field: endCash - expectedCash
    currentCash: { type: Number, default: 0 }, // Synced with drawer
    currentNonCash: { type: Number, default: 0 }, // New field tracked in OrderController
    cashSales: { type: Number, default: 0 },
    nonCashSales: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 }, // Total sales for easy access

    // Track order IDs to prevent double counting
    orders: [{ type: String }],

    adjustments: [{
        amount: Number,
        description: String,
        timestamp: { type: Date, default: Date.now }
    }],
    expenseIds: [{ type: String }], // Link to expenses paid from drawer
    openingCash: Number // Alias or same as startCash
});

module.exports = mongoose.model('Shift', ShiftSchema);
