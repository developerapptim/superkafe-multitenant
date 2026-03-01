const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const merchantCode = process.env.DUITKU_MERCHANT_CODE;
const apiKey = process.env.DUITKU_API_KEY;

const amount = 200000;
const merchantOrderId = 'TEST-API-' + Date.now();
const stringToHash = `${merchantCode}${merchantOrderId}${amount}${apiKey}`;
const signature = crypto.createHash('md5').update(stringToHash).digest('hex');

const payload = {
    merchantCode: merchantCode,
    paymentAmount: amount,
    merchantOrderId: merchantOrderId,
    productDetails: 'Test Duitku API Sandbox',
    email: 'test@example.com',
    customerVaName: 'Test Customer',
    phoneNumber: '08123456789',
    callbackUrl: 'http://localhost:5001/api/payments/callback',
    returnUrl: 'http://localhost:5174/admin',
    signature: signature,
    expiryPeriod: 60
};

// Trying the api-sandbox subdomain
const endpoint = 'https://api-sandbox.duitku.com/api/merchant/createinvoice';

async function testDuitku() {
    console.log('Sending payload to:', endpoint);
    try {
        const res = await axios.post(endpoint, payload);
        console.log('Response:', res.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testDuitku();
