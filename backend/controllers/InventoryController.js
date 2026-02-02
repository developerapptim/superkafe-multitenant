const Ingredient = require('../models/Ingredient');
const Gramasi = require('../models/Gramasi');
const StockHistory = require('../models/StockHistory');
const MenuItem = require('../models/MenuItem'); // For error msg
const Recipe = require('../models/Recipe'); // For safety check
const logActivity = require('../utils/activityLogger'); // NEW: Activity Logger

exports.getInventory = async (req, res) => {
    try {
        const items = await Ingredient.find().sort({ nama: 1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getInventoryById = async (req, res) => {
    try {
        const item = await Ingredient.findOne({ id: req.params.id });
        if (!item) return res.status(404).json({ error: 'Not found' });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.addInventory = async (req, res) => {
    try {
        const item = new Ingredient(req.body);
        await item.save();
        await logActivity({ req, action: 'ADD_ITEM', module: 'INVENTORY', description: `Added item: ${item.nama}`, metadata: { itemId: item.id } });
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateInventory = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        // 1. Fetch Existing Item
        const oldItem = await Ingredient.findOne({ id });
        if (!oldItem) return res.status(404).json({ error: 'Not found' });

        // 2. SECURITY: Prevent Stock Manipulation via Edit
        // User must use 'Stock Opname' or 'Restock' for stock changes.
        // We force the stock to remain as it was in the database.
        if (updates.stok !== undefined && Number(updates.stok) !== Number(oldItem.stok)) {
            console.warn(`[Security] Attempt to change stock for ${oldItem.nama} via Edit detected. Ignored.`);
            delete updates.stok; // Remove from update payload
        }

        // 3. Detect Price Change for Logging
        const oldPrice = Number(oldItem.harga_beli);
        const newPrice = Number(updates.harga_beli);

        if (newPrice !== oldPrice) {
            await logActivity({
                req,
                action: 'UPDATE_PRICE',
                module: 'INVENTORY',
                description: `Mengubah harga ${oldItem.nama} dari ${oldPrice} menjadi ${newPrice}`,
                metadata: {
                    itemId: id,
                    oldPrice,
                    newPrice,
                    oldHpp: oldItem.harga_modal,
                    newHpp: updates.harga_modal || oldItem.harga_modal
                }
            });
        }

        // 4. Perform Update
        const item = await Ingredient.findOneAndUpdate(
            { id },
            { $set: updates },
            { new: true }
        );

        await logActivity({
            req,
            action: 'UPDATE_ITEM',
            module: 'INVENTORY',
            description: `Updated item: ${item.nama}`,
            metadata: { itemId: item.id, changes: updates }
        });

        res.json(item);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteInventory = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Find ALL recipes using this ingredient
        const recipes = await Recipe.find({ 'ingredients.ing_id': id });

        let validUsageMenus = [];

        // 2. Check each recipe
        for (const recipe of recipes) {
            const menu = await MenuItem.findOne({ id: recipe.menuId });

            if (!menu) {
                // ORPHAN DETECTED: Menu is gone, but recipe remains.
                // Auto-cleanup this ghost recipe
                await Recipe.deleteOne({ _id: recipe._id });
                console.log(`[Cleanup] Deleted orphan recipe for disconnected Menu ID: ${recipe.menuId}`);
            } else {
                // VALID USAGE: Menu exists
                validUsageMenus.push(menu.name);
            }
        }

        // 3. If valid usages exist, block deletion
        if (validUsageMenus.length > 0) {
            // Unique names only
            const uniqueMenus = [...new Set(validUsageMenus)];
            return res.status(400).json({
                error: `Bahan ini tidak bisa dihapus karena digunakan dalam resep menu: ${uniqueMenus.join(', ')}. Silakan hapus dari resep terlebih dahulu.`
            });
        }

        // 4. Safe to delete
        const result = await Ingredient.deleteOne({ id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Bahan tidak ditemukan' });
        }

        await logActivity({ req, action: 'DELETE_ITEM', module: 'INVENTORY', description: `Deleted item ID: ${id}`, metadata: { itemId: id } });

        res.json({ ok: true, message: 'Bahan berhasil dihapus' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
};

exports.restockIngredient = async (req, res) => {
    try {
        // 1. Inputs
        const { id, amount, totalPrice, conversionRate } = req.body;
        // amount: Qty Beli (e.g., 2), conversionRate: (e.g., 1000g per pack), totalPrice: (e.g., 50000)

        // 2. Find Ingredient
        const item = await Ingredient.findOne({ id });
        if (!item) return res.status(404).json({ error: 'Ingredient not found' });

        if (item.type === 'non_physical') {
            return res.status(400).json({ error: 'Cannot restock non-physical items' });
        }

        // 3. Current Values
        const currentStock = Number(item.stok) || 0;
        const currentCostPerUnit = Number(item.harga_modal) || 0;

        // 4. New Values (Calculations)
        const purchaseQty = Number(amount);
        const addedStock = purchaseQty * (Number(conversionRate) || 1); // Convert purchase unit to base unit
        const purchaseCost = Number(totalPrice);

        // Moving Average Formula
        // Old Value (Asset) + New Value (Purchase) = Total Asset Value
        const currentAssetValue = currentStock * currentCostPerUnit;
        const newAssetValue = currentAssetValue + purchaseCost;

        const newTotalStock = currentStock + addedStock;

        // Prevent division by zero
        const newCostPerUnit = newTotalStock > 0 ? (newAssetValue / newTotalStock) : purchaseCost / addedStock;

        // 5. Update Database
        item.stok = newTotalStock;
        item.harga_modal = newCostPerUnit;

        // Update reference fields
        // User Request: 'Harga Beli' must reflect the Moving Average for accurate HPP calculations
        item.harga_beli = newCostPerUnit * (Number(conversionRate) || 1);

        item.lastBuyPrice = purchaseCost / purchaseQty; // Use this for "Last Market Price" tracking
        item.lastBuyDate = new Date(); // Track when this price occurred

        await item.save();

        // 6. Record History
        const history = new StockHistory({
            id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            ing_id: item.id,
            ingName: item.nama,
            type: 'in', // Keep 'in' for logic, or change to 'restock' if needed, but 'in' is standard for generic adds. Let's use 'restock' to be specific as requested? The user asked for 'Restock' badge. logic might rely on 'in'. Let's keep 'in' but add note. Or better, use specific type if schema allows. Schema says enum ['in', 'out', 'opname', 'restock']. Let's use 'restock'.
            type: 'restock',
            qty: addedStock,
            price: purchaseCost, // Legacy field
            hargaBeli: purchaseCost, // New specific field for Total Belanja
            modalLama: currentCostPerUnit,
            modalBaru: newCostPerUnit,
            stokSebelum: currentStock,
            stokSesudah: newTotalStock,
            note: `Restock: ${purchaseQty} x ${conversionRate || 1} unit @ ${purchaseCost}`,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('id-ID', { hour12: false }),
            timestamp: Date.now()
        });
        await history.save();

        await logActivity({
            req,
            action: 'RESTOCK_ITEM',
            module: 'INVENTORY',
            description: `Restock item: ${item.nama}, Qty: ${purchaseQty}, Cost: ${purchaseCost}`,
            metadata: { itemId: item.id, addedStock, newTotalStock }
        });

        res.json({
            success: true,
            item,
            history
        });
    } catch (err) {
        console.error('Restock error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { qty, note } = req.body; // qty can be positive (add) or negative (adjust)

        const item = await Ingredient.findOne({ id });
        if (!item) return res.status(404).json({ error: 'Ingredient not found' });

        if (item.type === 'non_physical') {
            return res.status(400).json({ error: 'Cannot update stock for non-physical items' });
        }

        const oldStock = Number(item.stok);
        const adjustment = Number(qty);
        const newStock = oldStock + adjustment;

        item.stok = newStock;
        await item.save();

        // Record History
        const history = new StockHistory({
            id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            ing_id: item.id,
            ingName: item.nama,
            type: adjustment > 0 ? 'in' : 'opname', // 'opname' or 'koreksi'
            qty: Math.abs(adjustment),
            stokSebelum: oldStock,
            stokSesudah: newStock,
            note: note || 'Manual Adjustment',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('id-ID', { hour12: false }),
            timestamp: Date.now()
        });
        await history.save();

        await logActivity({
            req,
            action: 'ADJUST_STOCK',
            module: 'INVENTORY',
            description: `Stock adjustment: ${item.nama}, change: ${adjustment}, note: ${note || '-'}`,
            metadata: { itemId: item.id, adjustment, newStock }
        });

        res.json(item);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getStockHistory = async (req, res) => {
    try {
        const items = await StockHistory.find().sort({ timestamp: -1 });
        res.json(items);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getHistoryByIngredientId = async (req, res) => {
    try {
        const { id } = req.params;
        const history = await StockHistory.find({ ing_id: id }).sort({ timestamp: -1 });
        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.addStockHistory = async (req, res) => {
    try {
        const item = new StockHistory(req.body);
        await item.save();
        res.status(201).json(item);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// New: Top Usage for Inventory Dashboard
exports.getTopUsage = async (req, res) => {
    try {
        // Aggregate 'out' types from StockHistory
        const usage = await StockHistory.aggregate([
            { $match: { type: 'out' } },
            {
                $group: {
                    _id: "$ing_id",
                    ingName: { $first: "$ingName" },
                    totalUsed: { $sum: "$qty" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { totalUsed: -1 } },
            { $limit: 5 }
        ]);

        res.json(usage);
    } catch (err) {
        console.error('Top usage error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// GRAMASI CRUD
exports.getGramasi = async (req, res) => {
    try {
        const items = await Gramasi.find();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.addGramasi = async (req, res) => {
    try {
        const item = new Gramasi(req.body);
        await item.save();
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.addGramasiBulk = async (req, res) => {
    try {
        const items = req.body;
        const result = await Gramasi.insertMany(items);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteGramasi = async (req, res) => {
    try {
        await Gramasi.deleteOne({ id: req.params.id });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
