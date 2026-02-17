require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

const operationalExpenseSchema = new mongoose.Schema({
    id: String,
    category: String,
    amount: Number,
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: String
}, { strict: false });

const OperationalExpense = mongoose.model('OperationalExpense', operationalExpenseSchema, 'operationalexpenses'); // Explicit collection Name matching debug result

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');

        const result = await OperationalExpense.updateMany(
            { isDeleted: false },
            {
                $set: {
                    isDeleted: true,
                    deletedAt: new Date(),
                    deletedBy: 'System_Fix_Script'
                }
            }
        );

        console.log(`Updated ${result.modifiedCount} items to isDeleted: true`);

        mongoose.connection.close();
    })
    .catch(err => {
        console.error('❌ Error:', err);
        mongoose.connection.close();
    });
