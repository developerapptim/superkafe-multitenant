const mongoose = require('mongoose');

const IngredientSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    nama: { type: String, required: true },
    stok: { type: Number, default: 0 },
    satuan: String, // e.g. gram, ml, pcs

    // Purchasing & Costing
    harga_beli: { type: Number, default: 0 },
    stok_min: { type: Number, default: 5 },

    // Unit Conversion (Beli -> Pakai)
    satuan_beli: String, // e.g. Pack, Galon, Kg
    isi_prod: { type: Number, default: 1 }, // Conversion rate (e.g. 1000 for 1kg -> 1000g)
    satuan_prod: String, // e.g. ml, gram (Unit used in Recipes)
    use_konversi: { type: Boolean, default: false }, // Persist check status

    // Calculated Fields
    harga_modal: Number, // Cost per production unit

    // Custom Attributes
    type: {
        type: String,
        enum: ['physical', 'non_physical'],
        default: 'physical'
    },

    // Price Tracking
    lastBuyPrice: Number,
    lastBuyDate: Date,

    last_updated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ingredient', IngredientSchema);
