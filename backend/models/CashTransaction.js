const mongoose = require('mongoose');

const CashTransactionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    type: { type: String, enum: ['in', 'out'], required: true },
    amount: { type: Number, required: true },
    category: { type: String, default: 'General' },
    paymentMethod: { type: String, enum: ['cash', 'non-cash'], default: 'cash' },
    description: String,
    date: String,
    time: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.CashTransaction || mongoose.model('CashTransaction', CashTransactionSchema);
