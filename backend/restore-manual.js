require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Models
const MenuItem = require('./models/MenuItem');
const Category = require('./models/Category');
const Order = require('./models/Order');
const Table = require('./models/Table');
const Employee = require('./models/Employee');
const CashTransaction = require('./models/CashTransaction');
const Customer = require('./models/Customer');
const Ingredient = require('./models/Ingredient');
const Gramasi = require('./models/Gramasi');
const StockHistory = require('./models/StockHistory');
const Recipe = require('./models/Recipe');
const Shift = require('./models/Shift');
const Settings = require('./models/Settings');

// CONFIG
const BACKUP_FILE = 'Warkop - FullBackup - 1770919198934.json';
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/warkop';

// CONNECT
mongoose.connect(URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    });

const restore = async () => {
    try {
        const filePath = path.join(__dirname, BACKUP_FILE);
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        console.log(`📖 Reading backup file: ${BACKUP_FILE}...`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

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
            // Settings is likely a single document or object. insertMany expects array.
            // Check if settings exists first
            try {
                // Try update first to avoid duplicate key extraction error if it exists
                await Settings.findOneAndUpdate({ key: 'businessSettings' }, data.businessSettings, { upsert: true });
                console.log('✅ Sukses import Settings');
            } catch (err) {
                console.error('❌ Failed settings:', err.message);
            }
        }

        console.log('\n🎉 RESTORE COMPLETED!');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ CRITICAL ERROR:', err.message);
        process.exit(1);
    }
};

// Run
restore();
