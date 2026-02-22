const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const MenuItemSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    category: String, // legacy
    categoryId: String,
    imageUrl: String,
    is_active: { type: Boolean, default: true },
    use_stock_check: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    label: {
        type: String,
        enum: ['none', 'best-seller', 'signature', 'new'],
        default: 'none'
    },

    // Marketing & Bundling fields
    base_price: { type: Number, default: 0 }, // Harga coret (harga asli sebelum diskon)
    is_bundle: { type: Boolean, default: false }, // Penanda produk paket bundling
    bundle_items: [{
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
        quantity: { type: Number, default: 1 }
    }],

    // Calculated fields (virtuals not stored, but good to know)
    // stock & hpp are calculated at runtime
});

// MenuItemSchema.pre('validate', function (next) {
//     console.log('🔍 Validating MenuItem:', this);
//     next();
// });

// Apply tenant scoping plugin for automatic tenant isolation
MenuItemSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('MenuItem', MenuItemSchema);
