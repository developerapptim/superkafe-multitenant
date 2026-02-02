const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    number: { type: String, required: true, unique: true },
    capacity: { type: Number, default: 4 },
    status: { type: String, enum: ['Available', 'Occupied', 'Reserved', 'Dirty'], default: 'Available' },
    location: { type: String, default: 'indoor' }, // indoor/outdoor
    currentOrderId: String, // Link to active order
    occupiedSince: Date
}, { timestamps: true });

module.exports = mongoose.models.Table || mongoose.model('Table', TableSchema);
