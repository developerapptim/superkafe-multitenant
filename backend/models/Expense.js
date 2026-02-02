const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    category: { type: String, required: true }, // e.g., 'Listrik', 'Gaji', 'Operasional'
    amount: { type: Number, required: true },
    description: String,
    date: { type: Date, default: Date.now },
    paymentMethod: { type: String, enum: ['Tunai', 'Transfer', 'Lainnya'], default: 'Tunai' },
    pic: String, // Person In Charge
    shiftId: String // Optional: Link to specific shift
}, { timestamps: true });

module.exports = mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema);
