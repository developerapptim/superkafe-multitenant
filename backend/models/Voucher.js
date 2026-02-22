const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

// Model Voucher untuk kode diskon
const VoucherSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discount_type: { type: String, enum: ['percent', 'nominal'], required: true },
    discount_value: { type: Number, required: true },
    min_purchase: { type: Number, default: 0 },
    max_discount: { type: Number, default: null }, // Hanya relevan untuk tipe percent
    quota: { type: Number, default: 0 }, // 0 = unlimited
    used_count: { type: Number, default: 0 },
    valid_until: { type: Date, required: true },
    is_active: { type: Boolean, default: true },
}, { timestamps: true });

// Apply tenant scoping plugin for automatic tenant isolation
VoucherSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('Voucher', VoucherSchema);
