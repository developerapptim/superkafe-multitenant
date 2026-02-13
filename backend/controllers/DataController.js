const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Table = require('../models/Table');
const Employee = require('../models/Employee');
const CashTransaction = require('../models/CashTransaction');
const Customer = require('../models/Customer');
const Ingredient = require('../models/Ingredient');
const Gramasi = require('../models/Gramasi');
const StockHistory = require('../models/StockHistory');
const Recipe = require('../models/Recipe');
const Shift = require('../models/Shift');
const Settings = require('../models/Settings');

const MASTER_PIN = process.env.MASTER_PIN || '123456';

// Reset Database (Delete All Data)
exports.resetDatabase = async (req, res) => {
    try {
        const { masterPin, confirmText } = req.body;

        if (masterPin !== MASTER_PIN) {
            return res.status(401).json({ error: 'Master PIN salah!' });
        }

        if (confirmText !== 'HAPUS SEMUA DATA') {
            return res.status(400).json({ error: 'Teks konfirmasi salah. Ketik: HAPUS SEMUA DATA' });
        }

        await Promise.all([
            MenuItem.deleteMany({}),
            Category.deleteMany({}),
            Order.deleteMany({}),
            Table.deleteMany({}),
            CashTransaction.deleteMany({}),
            Customer.deleteMany({}),
            Ingredient.deleteMany({}),
            Gramasi.deleteMany({}),
            StockHistory.deleteMany({}),
            Recipe.deleteMany({}),
            Shift.deleteMany({})
        ]);

        console.log('⚠️ DATABASE RESET by admin');
        res.json({ success: true, message: 'Semua data berhasil dihapus!' });
    } catch (err) {
        console.error('Reset error:', err);
        res.status(500).json({ error: 'Gagal mereset database: ' + err.message });
    }
};

// Delete specific collection
exports.deleteCollection = async (req, res) => {
    try {
        const { masterPin } = req.body;
        const collectionName = req.params.name;

        if (masterPin !== MASTER_PIN) {
            return res.status(401).json({ error: 'Master PIN salah!' });
        }

        const collections = {
            'menu': MenuItem,
            'categories': Category,
            'orders': Order,
            'tables': Table,
            'cash': CashTransaction,
            'customers': Customer,
            'ingredients': Ingredient,
            'gramasi': Gramasi,
            'stockhistory': StockHistory,
            'recipes': Recipe,
            'shifts': Shift
        };

        const Model = collections[collectionName];
        if (!Model) {
            return res.status(400).json({ error: 'Koleksi tidak ditemukan: ' + collectionName });
        }

        const result = await Model.deleteMany({});
        res.json({ success: true, deleted: result.deletedCount });
    } catch (err) {
        res.status(500).json({ error: 'Gagal menghapus: ' + err.message });
    }
};

// Get All Data (Backup)
exports.getAllData = async (req, res) => {
    try {
        const [menuItems, categories, orders, tables, employees, cashTransactions, customers, ingredients, gramasiData, stockHistory, recipesRaw, settings] = await Promise.all([
            MenuItem.find(),
            Category.find(),
            Order.find(),
            Table.find(),
            Employee.find(),
            CashTransaction.find(),
            Customer.find(),
            Ingredient.find(),
            Gramasi.find(),
            StockHistory.find(),
            Recipe.find(),
            Settings.findOne({ key: 'businessSettings' })
        ]);

        const recipes = {};
        recipesRaw.forEach(r => { recipes[r.menuId] = r.ingredients; });

        res.json({
            menuItems,
            categories: categories.map(c => c.name || c.id),
            orders,
            activeShifts: [], // Simplified
            tables,
            employees,
            cashTransactions,
            customers,
            ingredients,
            gramasiData,
            stockHistory,
            recipes,
            customUnits: settings?.customUnits || [],
            businessSettings: settings || {}
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Restore Data (Post)
// Restore Data (Post)
exports.restoreData = async (req, res) => {
    try {
        const data = req.body;
        console.log('📥 Receiving Restore Data...');

        // Helper to insert
        const insert = async (Model, items, name) => {
            if (!items || items.length === 0) return;
            try {
                // Use ordered: false to continue even if some docs duplicate
                await Model.insertMany(items, { ordered: false });
                console.log(`✅ Sukses import ${name} (${items.length} items)`);
            } catch (err) {
                if (err.code === 11000) {
                    console.log(`⚠️ Partial import ${name}: Some items skipped (Duplicates)`);
                    console.log(`✅ Sukses import ${name} (Remaining items)`);
                } else {
                    console.error(`❌ Failed import ${name}:`, err.message);
                }
            }
        };

        // 1. Menu Items
        await insert(MenuItem, data.menuItems, 'MenuItem');

        // 2. Categories (Handle String vs Object)
        if (data.categories && data.categories.length > 0) {
            const formattedCats = data.categories.map(c =>
                typeof c === 'string' ? { id: c, name: c } : c
            );
            await insert(Category, formattedCats, 'Category');
        }

        // 3. Orders
        await insert(Order, data.orders, 'Order');

        // 4. Tables
        await insert(Table, data.tables, 'Table');

        // 5. Employees
        await insert(Employee, data.employees, 'Employee');

        // 6. Cash Transactions
        await insert(CashTransaction, data.cashTransactions, 'CashTransaction');

        // 7. Customers
        await insert(Customer, data.customers, 'Customer');

        // 8. Ingredients
        await insert(Ingredient, data.ingredients, 'Ingredient');

        // 9. Gramasi
        await insert(Gramasi, data.gramasiData, 'Gramasi');

        // 10. Stock History
        await insert(StockHistory, data.stockHistory, 'StockHistory');

        // 11. Recipes (Transform Object -> Array)
        if (data.recipes) {
            const recipeDocs = Object.entries(data.recipes).map(([menuId, ingredients]) => ({
                menuId,
                ingredients
            }));
            await insert(Recipe, recipeDocs, 'Recipe');
        }

        // 12. Shifts
        await insert(Shift, data.shifts, 'Shift');

        // 13. Settings
        if (data.businessSettings) {
            try {
                await Settings.findOneAndUpdate({ key: 'businessSettings' }, data.businessSettings, { upsert: true });
                console.log('✅ Sukses import Settings');
            } catch (err) {
                console.error('❌ Failed settings:', err.message);
            }
        }

        console.log('🎉 RESTORE COMPLETED via Dashboard');

        // Return updated data to refresh frontend
        exports.getAllData(req, res);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error saat restore: ' + err.message });
    }
};
// Delete Transactions Only
exports.deleteTransactions = async (req, res) => {
    try {
        const { confirmText } = req.body;

        if (confirmText !== 'HAPUS TRANSAKSI') {
            return res.status(400).json({ error: 'Konfirmasi teks salah!' });
        }

        await Promise.all([
            Order.deleteMany({}),
            StockHistory.deleteMany({}),
            CashTransaction.deleteMany({}),
            Shift.deleteMany({}) // Also clear shifts as they are transactional
        ]);

        console.log('⚠️ TRANSACTIONS DELETED by admin');
        res.json({ success: true, message: 'Data transaksi berhasil dihapus!' });
    } catch (err) {
        console.error('Delete transactions error:', err);
        res.status(500).json({ error: 'Gagal menghapus transaksi: ' + err.message });
    }
};
