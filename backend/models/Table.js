const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const TableSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    number: { type: String, required: true, unique: true },
    capacity: { type: Number, default: 4 },
    status: { type: String, enum: ['available', 'occupied', 'reserved'], default: 'available' },
    location: { type: String, default: 'indoor' }, // indoor/outdoor
    currentOrderId: String, // Link to active order
    occupiedSince: Date
}, { timestamps: true });

// Apply tenant scoping plugin for automatic tenant isolation
TableSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.models.Table || mongoose.model('Table', TableSchema);
