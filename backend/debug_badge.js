const mongoose = require('mongoose');
const Order = require('./models/Order');
const axios = require('axios');

// Connect to MongoDB (Adjust URI if needed, checking server.js env usually)
// Assuming standard local mongo or env
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/superkafe_db';

async function checkOrders() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        const count = await Order.countDocuments({
            status: { $in: ['pending', 'new'] }
        });

        console.log(`DB Verification: Found ${count} pending/new orders.`);

        if (count === 0) {
            console.log('Creating a dummy pending order...');
            await Order.create({
                id: `ord_test_${Date.now()}`,
                items: [{ name: 'Test Item', qty: 1, price: 10000 }],
                total: 10000,
                status: 'pending',
                paymentStatus: 'unpaid',
                tableNumber: '99',
                timestamp: Date.now()
            });
            console.log('Dummy order created.');
        }

        // Check API
        // Assuming server is running on port 5000 based on previous context
        try {
            const res = await axios.get('http://localhost:5000/api/orders/pending-count');
            console.log('API Response:', res.data);
        } catch (apiErr) {
            console.error('API call failed:', apiErr.message);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

checkOrders();
