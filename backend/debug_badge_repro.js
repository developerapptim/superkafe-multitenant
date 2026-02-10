const mongoose = require('mongoose');
const Order = require('./models/Order');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://developerapptim:developerapptim1@cluster0.6ifoomz.mongodb.net/?appName=Cluster0';

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        // --- Frontend Logic Simulation ---
        const todayUTC = new Date().toISOString().split('T')[0];
        console.log('Frontend "Today" (UTC String):', todayUTC);

        const allNewOrders = await Order.find({
            status: { $in: ['new', 'pending'] } // Fetch broader set to see what's filtered
        }).select('id status createdAt timestamp is_archived_from_pos date');

        let frontendCount = 0;
        let backendCount = 0;

        console.log('\n--- Discrepancy Analysis ---');
        console.log('ID | Status | Archived | Date (DB) | Timestamp (Local) | FE Date (UTC) | Backend Match? | Frontend Match?');

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        allNewOrders.forEach(o => {
            // Frontend Logic
            let feDate = 'N/A';
            if (o.timestamp) {
                feDate = new Date(o.timestamp).toISOString().split('T')[0];
            } else if (o.createdAt) {
                feDate = new Date(o.createdAt).toISOString().split('T')[0];
            }

            // Check Frontend Conditions
            const isNotArchived = !o.is_archived_from_pos;
            const isTodayUTC = (o.date === todayUTC) || (feDate === todayUTC);
            const isStatusNew = o.status === 'new';

            const feMatch = isNotArchived && isTodayUTC && isStatusNew;
            if (feMatch) frontendCount++;

            // Backend Logic (Current Implementation)
            const beStatusMatch = o.status === 'new'; // We changed to 'new' only
            const beArchivedMatch = o.is_archived_from_pos !== true;

            const oTime = o.timestamp ? new Date(o.timestamp).getTime() : 0;
            const oCreated = o.createdAt ? new Date(o.createdAt).getTime() : 0;

            const beDateMatch = (oCreated >= startOfDay.getTime() && oCreated <= endOfDay.getTime()) ||
                (oTime >= startOfDay.getTime() && oTime <= endOfDay.getTime());

            const beMatch = beStatusMatch && beArchivedMatch && beDateMatch;
            if (beMatch) backendCount++;

            // Log discrepancies
            if (feMatch !== beMatch) {
                console.log(`${o.id} | ${o.status} | ${o.is_archived_from_pos} | ${o.date} | ${new Date(o.timestamp).toLocaleString()} | ${feDate} | BE:${beMatch} | FE:${feMatch}`);
            }
        });

        console.log('\n--- Summary ---');
        console.log(`Frontend Count (Simulation): ${frontendCount}`);
        console.log(`Backend Count (Simulation): ${backendCount}`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
