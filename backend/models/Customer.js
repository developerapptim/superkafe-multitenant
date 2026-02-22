const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

// Customer Model
const CustomerSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: String,
    email: String,
    address: String,
    notes: String,
    totalSpent: { type: Number, default: 0 },
    visitCount: { type: Number, default: 0 },
    points: { type: Number, default: 0 },           // Loyalty points
    tier: { type: String, default: 'regular' },     // regular, silver, gold
    lastOrderDate: Date,
    lastPointsEarned: Date,
    tags: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
});

// Apply tenant scoping plugin for automatic tenant isolation
CustomerSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('Customer', CustomerSchema);
