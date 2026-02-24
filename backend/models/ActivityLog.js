const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const ActivityLogSchema = new mongoose.Schema({
    action: { type: String, required: true }, // e.g., 'ADD_MENU', 'OPEN_SHIFT'
    module: { type: String, required: true }, // e.g., 'INVENTORY', 'SHIFT'
    description: { type: String, required: true },
    user: {
        id: String,
        name: String,
        role: String
    },
    metadata: { type: mongoose.Schema.Types.Mixed }, // Flexible field for extra details (e.g. item ID, amount)
    timestamp: { type: Date, default: Date.now }
});

// Tenant-scoped compound indexes for optimal query performance
ActivityLogSchema.index({ tenantId: 1, timestamp: -1 }); // Time-based queries per tenant

// Apply tenant scoping plugin for automatic tenant isolation
ActivityLogSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
