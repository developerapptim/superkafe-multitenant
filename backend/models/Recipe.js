const mongoose = require('mongoose');

// Recipe Model (for auto-depletion & HPP)
const RecipeSchema = new mongoose.Schema({
    menuId: { type: String, required: true, index: true }, // Linked to MenuItem.id
    ingredients: [{
        ing_id: String, // Linked to Ingredient.id
        jumlah: Number  // Quantity in Ingredient.satuan_prod
    }],
    last_updated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Recipe', RecipeSchema);
