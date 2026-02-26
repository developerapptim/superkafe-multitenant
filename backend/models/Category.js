const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const CategorySchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    emoji: String,
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

// Tenant-scoped compound indexes for optimal query performance
CategorySchema.index({ tenantId: 1, id: 1 }, { unique: true }); // Tenant-scoped unique id
CategorySchema.index({ tenantId: 1, createdAt: -1 }); // Time-based queries per tenant

// Apply tenant scoping plugin for automatic tenant isolation
CategorySchema.plugin(tenantScopingPlugin);

module.exports = mongoose.models.Category || mongoose.model('Category', CategorySchema);
