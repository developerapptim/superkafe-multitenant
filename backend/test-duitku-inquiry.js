const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const merchantCode = process.env.DUITKU_MERCHANT_CODE;
const apiKey = process.env.DUITKU_API_KEY;

const amount = 200000;
const merchantOrderId = 'TEST-INQ-' + Date.now();
const stringToHash = `${merchantCode}${merchantOrderId}${amount}${apiKey}`;
const signature = crypto.createHash('md5').update(stringToHash).digest('hex');

const payload = {
    merchantCode: merchantCode,
    paymentAmount: amount,
    merchantOrderId: merchantOrderId,
    productDetails: 'Test Duitku Inquiry',
    email: 'test@example.com',
    customerVaName: 'Test Customer',
    phoneNumber: '08123456789',
    callbackUrl: 'http://localhost:5001/api/payments/callback',
    returnUrl: 'http://localhost:5174/admin',
    signature: signature,
    expiryPeriod: 60,
    paymentMethod: '' // Test empty payment method
};

const endpoint = 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry';

async function testDuitku() {
    console.log('Sending inquiry payload to:', endpoint);
    try {
        const res = await axios.post(endpoint, payload);
        console.log('Response:', res.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testDuitku();
