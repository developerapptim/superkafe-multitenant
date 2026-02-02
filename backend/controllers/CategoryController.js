const Category = require('../models/Category');

// Get all categories
exports.getAll = async (req, res) => {
    try {
        const categories = await Category.find().sort({ order: 1, name: 1 });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Create category
exports.create = async (req, res) => {
    try {
        const { id, name, emoji } = req.body;
        const newCategory = new Category({
            id: id || `cat_${Date.now()}`,
            name,
            emoji: emoji || '📦'
        });
        await newCategory.save();
        res.status(201).json(newCategory);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Update category
exports.update = async (req, res) => {
    try {
        const { name, emoji } = req.body;
        const category = await Category.findOneAndUpdate(
            { id: req.params.id },
            { name, emoji: emoji || '📦' },
            { new: true }
        );
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json(category);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete category
exports.delete = async (req, res) => {
    try {
        const categoryId = req.params.id;

        // 1. Find Category First
        const category = await Category.findOne({ id: categoryId });
        if (!category) {
            console.log(`[DELETE CATEGORY] Category not found: ${categoryId}`);
            return res.status(404).json({ error: 'Category not found' });
        }

        console.log(`[DELETE CATEGORY] Attempting to delete: ${category.name} (${category.id})`);

        // 2. Safety Check: Check if any menu items use this category ID OR Name
        // We check BOTH because:
        // - Older data might store the Category Name.
        // - Newer data stores the Category ID (from Frontend Select).
        const MenuItem = require('../models/MenuItem');

        const query = {
            $or: [
                { category: category.id },           // Match by ID
                { category: category.name },         // Match by Name (Exact)
                { category: { $regex: new RegExp(`^${category.name}$`, 'i') } } // Match by Name (Case Insensitive)
            ]
        };

        const count = await MenuItem.countDocuments(query);
        console.log(`[DELETE CATEGORY] Query:`, JSON.stringify(query));
        console.log(`[DELETE CATEGORY] Found ${count} related menu items.`);

        if (count > 0) {
            console.log(`[DELETE CATEGORY] Blocked. Reason: In use.`);
            return res.status(400).json({
                error: `Gagal hapus! Kategori '${category.name}' masih digunakan oleh ${count} menu. Harap pindahkan atau hapus menu terkait terlebih dahulu.`
            });
        }

        // 3. Delete
        await Category.findOneAndDelete({ id: categoryId });
        res.json({ message: 'Kategori berhasil dihapus.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
