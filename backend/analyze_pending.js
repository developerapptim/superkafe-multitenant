const mongoose = require('mongoose');
const Order = require('./models/Order');

require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/superkafe_db';

async function analyzePendingOrders() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        const pendingOrders = await Order.find({
            status: { $in: ['pending', 'new'] }
        }).select('id status timestamp createdAt tableNumber customerName');

        console.log(`Total Pending/New Orders: ${pendingOrders.length}`);

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let todayCount = 0;
        let oldCount = 0;

        console.log('\n--- Details ---');
        pendingOrders.forEach(o => {
            const orderDate = new Date(o.timestamp || o.createdAt);
            const isToday = orderDate >= startOfToday;

            if (isToday) todayCount++;
            else oldCount++;

            console.log(`[${isToday ? 'TODAY' : 'OLD'}] ${o.id} - ${orderDate.toLocaleString()} - ${o.status} - Table: ${o.tableNumber}`);
        });

        console.log('\n--- Summary ---');
        console.log(`Today's Pending: ${todayCount}`);
        console.log(`Old Pending (Ghost): ${oldCount}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

analyzePendingOrders();
