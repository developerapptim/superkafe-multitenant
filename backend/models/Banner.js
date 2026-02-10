const mongoose = require('mongoose');

// Model Banner untuk slider promo di halaman pelanggan
const BannerSchema = new mongoose.Schema({
    image_url: { type: String, required: true },
    title: { type: String, default: '' },
    is_active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Banner', BannerSchema);
