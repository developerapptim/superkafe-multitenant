require('dotenv').config();
const DuitkuProvider = require('./services/payment/providers/DuitkuProvider');

async function testDuitku() {
    const provider = new DuitkuProvider({
        merchantCode: process.env.DUITKU_MERCHANT_CODE,
        apiKey: process.env.DUITKU_API_KEY,
        mode: process.env.DUITKU_MODE || 'sandbox'
    });

    try {
        const result = await provider.createInvoice({
            merchantOrderId: 'SUB-TEST-' + Date.now(),
            amount: 225000,
            productDetails: 'Test Plan',
            email: 'admin@example.com',
            customerName: 'Admin Test',
            phoneNumber: '08123456789',
            callbackUrl: 'https://superkafe.com/api/payments/callback',
            returnUrl: 'https://superkafe.com/admin',
            expiryPeriod: 60
        });
        console.log('Success:', result);
    } catch (error) {
        console.error('Test Error:', error.message);
    }
}

testDuitku();
