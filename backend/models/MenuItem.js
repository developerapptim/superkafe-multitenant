const mongoose = require('mongoose');

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

    // Calculated fields (virtuals not stored, but good to know)
    // stock & hpp are calculated at runtime
});

module.exports = mongoose.model('MenuItem', MenuItemSchema);
