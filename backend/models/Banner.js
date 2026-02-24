const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

// Model Banner untuk slider promo di halaman pelanggan
const BannerSchema = new mongoose.Schema({
    image_url: { type: String, required: true },
    title: { type: String, default: '' },
    is_active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
}, { timestamps: true });

// Tenant-scoped compound indexes for optimal query performance
BannerSchema.index({ tenantId: 1, createdAt: -1 }); // Time-based queries per tenant

// Apply tenant scoping plugin for automatic tenant isolation
BannerSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('Banner', BannerSchema);
