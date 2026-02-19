const mongoose = require('mongoose');
const Order = require('./models/Order');
const axios = require('axios');

require('dotenv').config();

// Use the exact URI from .env if possible, or fallback
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://developerapptim:developerapptim1@cluster0.6ifoomz.mongodb.net/?appName=Cluster0';

async function run() {
    console.log('Connecting to:', MONGO_URI);
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        const now = new Date();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        console.log('Server Time:', now.toString());
        console.log('Start of Day:', startOfDay.toString());

        const allPending = await Order.find({
            status: { $in: ['pending', 'new'] },
            $or: [
                { createdAt: { $gte: startOfDay } },
                { timestamp: { $gte: startOfDay.getTime() } }
            ]
        }).select('id status createdAt timestamp is_archived_from_pos');

        console.log(`--- Breakdown of ${allPending.length} Matches ---`);
        const breakdown = {
            new: 0,
            pending: 0,
            archived: 0,
            visible: 0
        };

        allPending.forEach(o => {
            if (o.status === 'new') breakdown.new++;
            if (o.status === 'pending') breakdown.pending++;
            if (o.is_archived_from_pos) breakdown.archived++;
            else breakdown.visible++;

            console.log(`[${o.status}] ${o.id} | Archived: ${!!o.is_archived_from_pos} | Visible in POS: ${!o.is_archived_from_pos}`);
        });
        console.table(breakdown);

        const count = await Order.countDocuments({
            status: { $in: ['pending', 'new'] },
            createdAt: { $gte: startOfDay }
        });
        console.log('Filtered Count (Expected):', count);

        // Test API
        try {
            const res = await axios.get('http://localhost:5001/api/orders/pending-count', {
                headers: { 'x-api-key': 'warkop_secret_123' } // Add API Key
            });
            console.log('API Response:', res.data);
        } catch (e) {
            console.error('API Error:', e.message);
            if (e.response) console.error('Status:', e.response.status);
        }

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Done');
        process.exit(0);
    }
}

run();
