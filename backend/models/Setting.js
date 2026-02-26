const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

// Generic Setting Model for flexible keys
const SettingSchema = new mongoose.Schema({
    key: { type: String, required: true }, // REMOVED unique: true - will use compound index instead
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: String,
    updatedAt: { type: Date, default: Date.now }
});

// CRITICAL: Compound unique index for multi-tenancy
// Each tenant can have their own 'store_name', 'currency', etc.
SettingSchema.index({ tenantId: 1, key: 1 }, { unique: true });

// Time-based queries per tenant
SettingSchema.index({ tenantId: 1, updatedAt: -1 });

// Apply tenant scoping plugin for automatic tenant isolation
SettingSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);
