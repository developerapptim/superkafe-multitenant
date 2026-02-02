const mongoose = require('mongoose');

const GramasiSchema = new mongoose.Schema({
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    ingredient: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    amount: { type: Number, required: true }
});

module.exports = mongoose.models.Gramasi || mongoose.model('Gramasi', GramasiSchema);
