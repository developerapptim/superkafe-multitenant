require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is undefined. Check .env');
    process.exit(1);
}

const operationalExpenseSchema = new mongoose.Schema({
    id: String,
    category: String,
    amount: Number,
    description: String,
    date: Date,
    isDeleted: { type: Boolean, default: false }
}, { strict: false });

const OperationalExpense = mongoose.model('OperationalExpense', operationalExpenseSchema, 'operational_expenses');
const fs = require('fs');

function log(msg) {
    console.log(msg);
    fs.appendFileSync('debug_result.txt', msg + '\n');
}

// Clear previous result
if (fs.existsSync('debug_result.txt')) fs.unlinkSync('debug_result.txt');

mongoose.connect(MONGODB_URI)
    .then(async () => {
        log('✅ Connected to MongoDB');

        const collections = await mongoose.connection.db.listCollections().toArray();
        log('\n--- EXISTING COLLECTIONS ---');
        collections.forEach(c => log(`- ${c.name}`));
        log('----------------------------\n');

        // Check both potential collection names
        const namesToCheck = ['operationalexpenses', 'operational_expenses'];

        for (const name of namesToCheck) {
            const count = await mongoose.connection.db.collection(name).countDocuments();
            log(`Collection '${name}': ${count} documents`);

            if (count > 0) {
                const active = await mongoose.connection.db.collection(name).find({
                    $or: [
                        { isDeleted: false },
                        { isDeleted: { $exists: false } }
                    ]
                }).toArray();

                if (active.length > 0) {
                    log(`\n!!! FOUND ACTIVE EXPENSES IN '${name}' !!!`);
                    active.forEach(ex => {
                        log(`[${ex.id}] ${ex.category} - Rp ${ex.amount} | Date: ${ex.date} | isDeleted: ${ex.isDeleted}`);
                    });
                } else {
                    log(`No active expenses in '${name}' (all deleted).`);
                }
            }
        }

        log('\n---------------------------------------------------------');
        mongoose.connection.close();
    })
    .catch(err => {
        log('❌ Error: ' + err);
        mongoose.connection.close();
    });
