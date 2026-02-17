require('dotenv').config({ path: '../.env' }); // Adjust path if needed
const mongoose = require('mongoose');

// Models
const StockHistory = require('./models/StockHistory');
const MenuItem = require('./models/MenuItem');
const Order = require('./models/Order');
const Table = require('./models/Table');
const Category = require('./models/Category');
const CashTransaction = require('./models/CashTransaction');
const Customer = require('./models/Customer');
const Ingredient = require('./models/Ingredient');
const Gramasi = require('./models/Gramasi');
const Recipe = require('./models/Recipe');
const Shift = require('./models/Shift');
const Settings = require('./models/Settings');
const OperationalExpense = require('./models/OperationalExpenses');

const RESET_PIN = '123456'; // Default safety PIN

const resetDatabase = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment');
        }

        await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('🔌 Connected to MongoDB');

        console.log('⚠️ DELETING ALL DATA...');

        await Promise.all([
            MenuItem.deleteMany({}),
            Category.deleteMany({}),
            Order.deleteMany({}),
            Table.deleteMany({}),
            // Employee.deleteMany({}), // Keep employees for login safety
            CashTransaction.deleteMany({}),
            Customer.deleteMany({}),
            Ingredient.deleteMany({}),
            Gramasi.deleteMany({}),
            StockHistory.deleteMany({}),
            Recipe.deleteMany({}),
            Shift.deleteMany({}),
            OperationalExpense.deleteMany({})
        ]);

        console.log('✅ All data cleared successfully!');

        // Optional: Reseed initial data here if needed

        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding/resetting:', err);
        process.exit(1);
    }
};

// Check for command line argument safety
if (process.argv[2] === '--force') {
    resetDatabase();
} else {
    console.log('⚠️  Safety Check: Run with --force to execute reset.');
    console.log('Example: node seed.js --force');
    process.exit(0);
}
