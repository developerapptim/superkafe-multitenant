const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const CategorySchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    emoji: String,
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

// Apply tenant scoping plugin for automatic tenant isolation
CategorySchema.plugin(tenantScopingPlugin);

module.exports = mongoose.models.Category || mongoose.model('Category', CategorySchema);
