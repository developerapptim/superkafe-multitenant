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
exports.restoreData = async (req, res) => {
    try {
        const data = req.body;

        // Helper for upsert
        const upsertMany = async (Model, items) => {
            if (!items || !items.length) return;
            for (const item of items) {
                await Model.findOneAndUpdate({ id: item.id }, item, { upsert: true });
            }
        };

        await upsertMany(MenuItem, data.menuItems);

        if (data.categories) {
            for (const c of data.categories) {
                const cat = typeof c === 'string' ? { id: c, name: c } : c;
                await Category.findOneAndUpdate({ id: cat.id || cat.name }, cat, { upsert: true });
            }
        }

        await upsertMany(Order, data.orders);
        await upsertMany(Table, data.tables);
        await upsertMany(Employee, data.employees);
        await upsertMany(CashTransaction, data.cashTransactions);
        await upsertMany(Customer, data.customers);
        await upsertMany(Ingredient, data.ingredients);
        await upsertMany(Gramasi, data.gramasiData);
        await upsertMany(StockHistory, data.stockHistory);
        await upsertMany(Shift, data.shifts); // Assuming 'shifts' might be in backup

        if (data.recipes) {
            for (const [menuId, ingredients] of Object.entries(data.recipes)) {
                await Recipe.findOneAndUpdate({ menuId }, { menuId, ingredients }, { upsert: true });
            }
        }

        if (data.businessSettings || data.customUnits) {
            const settingsUpdate = { ...(data.businessSettings || {}), updatedAt: new Date() };
            if (data.customUnits) settingsUpdate.customUnits = data.customUnits;
            await Settings.findOneAndUpdate({ key: 'businessSettings' }, settingsUpdate, { upsert: true });
        }

        // Return updated data
        exports.getAllData(req, res);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
