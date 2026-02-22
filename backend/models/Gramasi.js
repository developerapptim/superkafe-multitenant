const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const GramasiSchema = new mongoose.Schema({
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    ingredient: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    amount: { type: Number, required: true }
});

// Apply tenant scoping plugin for automatic tenant isolation
GramasiSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.models.Gramasi || mongoose.model('Gramasi', GramasiSchema);
