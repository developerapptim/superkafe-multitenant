const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

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

DebtSchema.index({ status: 1, type: 1 });

// Tenant-scoped compound indexes for optimal query performance
DebtSchema.index({ tenantId: 1, createdAt: -1 }); // Time-based queries per tenant
DebtSchema.index({ tenantId: 1, status: 1 }); // Status-based queries per tenant

// Apply tenant scoping plugin for automatic tenant isolation
DebtSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.models.Debt || mongoose.model('Debt', DebtSchema);
