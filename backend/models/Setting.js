const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

// Generic Setting Model for flexible keys
const SettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // e.g., 'loyalty_config', 'store_info'
    value: { type: mongoose.Schema.Types.Mixed, required: true }, // Can store Object, String, Number, etc.
    description: String,
    updatedAt: { type: Date, default: Date.now }
});

// Apply tenant scoping plugin for automatic tenant isolation
SettingSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);
