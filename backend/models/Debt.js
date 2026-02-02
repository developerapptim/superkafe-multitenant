const mongoose = require('mongoose');

const DebtSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    type: { type: String, enum: ['kasbon', 'piutang'], required: true }, // kasbon = employee advance, piutang = customer debt
    personName: { type: String, required: true },
    personId: String, // link to Employee or Customer
    amount: { type: Number, required: true },
    description: String,
    status: { type: String, enum: ['pending', 'settled'], default: 'pending' },
    settledAt: Date,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Debt || mongoose.model('Debt', DebtSchema);
