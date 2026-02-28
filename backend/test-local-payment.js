require('dotenv').config();
const mongoose = require('mongoose');
const PaymentService = require('./services/payment/PaymentService');

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const result = await PaymentService.createSubscriptionPayment({
            tenantSlug: 'sulkopi',
            planType: 'bisnis',
            email: 'sulasrar@gmail.com',
            customerName: 'Admin',
            phoneNumber: '08123456789'
        });
        console.log('Result:', result);
    } catch (err) {
        console.error('TEST ERROR:', err);
    } finally {
        mongoose.disconnect();
    }
}

test();
