require('dotenv').config();
const mongoose = require('mongoose');
const OperationalExpense = require('./models/OperationalExpenses');
const Order = require('./models/Order');
const FinanceController = require('./controllers/FinanceController');

// Mock Request/Response
const mockRes = {
    json: (data) => console.log('RESPONSE JSON:', JSON.stringify(data, null, 2)),
    status: (code) => {
        console.log('RESPONSE STATUS:', code);
        return { json: (data) => console.log('RESPONSE ERROR:', data) };
    }
};

const mockReq = (body = {}, query = {}, user = { role: 'owner', name: 'Tester' }) => ({
    body,
    query,
    user,
    params: {}
});

async function runVerification() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('✅ Connected.');

        // 1. Create Expense
        console.log('\n--- 1. Testing Create Expense ---');
        const expenseData = {
            category: 'Listrik',
            amount: 500000,
            description: 'Test Listrik Bulan Ini',
            paymentMethod: 'Tunai',
            date: new Date()
        };
        const createReq = mockReq(expenseData);

        let createdId = null;
        // Direct Controller Call needs slight adjustment as it sends Response.
        // We will intercept it.
        // Actually, let's just use the Model directly for setup, then Controller for logic if complex.

        // Let's instantiate controller methods wrapper
        const expenseController = require('./controllers/ExpenseController');

        // We need to capture the ID from the response. 
        // Let's redefine mockRes for this specific call
        let captureRes = {
            status: (c) => ({ json: (d) => console.log(`Status ${c}`, d) }),
            json: (data) => {
                console.log('Created:', data.id);
                createdId = data.id;
            }
        };
        await expenseController.createExpense(createReq, captureRes);

        if (!createdId) throw new Error('Failed to create expense');

        // 2. Read
        console.log('\n--- 2. Testing Read Expense ---');
        const readReq = mockReq({}, {}, { role: 'owner' });
        readReq.params.id = createdId;
        await expenseController.getExpenseById(readReq, mockRes);

        // 3. Update
        console.log('\n--- 3. Testing Update Expense ---');
        const updateReq = mockReq({ amount: 550000, description: 'Updated Listrik' });
        updateReq.params.id = createdId;
        await expenseController.updateExpense(updateReq, mockRes);

        // 4. Soft Delete
        console.log('\n--- 4. Testing Soft Delete ---');
        const deleteReq = mockReq();
        deleteReq.params.id = createdId;
        await expenseController.deleteExpense(deleteReq, mockRes);

        // Verify it's gone from standard fetch
        console.log('Verifying deletion...');
        const check = await OperationalExpense.findOne({ id: createdId, isDeleted: false });
        console.log('Should be null:', check);

        // 5. P&L Report
        console.log('\n--- 5. Testing Profit & Loss Logic ---');
        // We need some dummy Orders to make it interesting.
        // Check if there are orders.
        const orderCount = await Order.countDocuments();
        console.log(`Found ${orderCount} orders in DB.`);

        if (orderCount === 0) {
            console.log('Creating dummy order for P&L test...');
            await Order.create({
                id: 'ord_test_pnl',
                total: 100000,
                paymentStatus: 'paid',
                status: 'done',
                items: [{ id: 'itm_1', qty: 2, hpp_locked: 20000 }], // HPP = 40000
                timestamp: Date.now()
            });
        }

        // Create a non-deleted expense for P&L
        await OperationalExpense.create({
            id: 'opex_test_pnl',
            category: 'Gaji',
            amount: 100000,
            description: 'Test Gaji',
            createdBy: 'Tester'
        });

        const pnlReq = mockReq({}, { startDate: new Date(Date.now() - 86400000).toISOString(), endDate: new Date().toISOString() });
        const financeController = require('./controllers/FinanceController');

        await financeController.getProfitLoss(pnlReq, mockRes);

        // Cleanup
        console.log('\n--- Cleanup ---');
        await OperationalExpense.deleteMany({ description: { $regex: 'Test' } });
        await Order.deleteOne({ id: 'ord_test_pnl' });
        console.log('Cleanup done.');

    } catch (err) {
        console.error('Verification Failed:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

runVerification();
