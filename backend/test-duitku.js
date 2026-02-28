require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');

async function test(method, callbackUrl) {
    const merchantCode = process.env.DUITKU_MERCHANT_CODE;
    const apiKey = process.env.DUITKU_API_KEY;
    const merchantOrderId = 'SUB-TEST-' + Date.now();
    const amount = 2000000;

    const signatureString = `${merchantCode}${merchantOrderId}${amount}${apiKey}`;
    const signature = crypto.createHash('md5').update(signatureString).digest('hex');

    const payload = {
        merchantCode: merchantCode,
        paymentAmount: amount,
        paymentMethod: method,
        merchantOrderId: merchantOrderId,
        productDetails: 'Test Payload',
        email: 'admin@example.com',
        customerVaName: 'Admin',
        phoneNumber: '08123456789',
        callbackUrl: callbackUrl,
        returnUrl: 'https://superkafe.com/admin',
        signature: signature,
        expiryPeriod: 60
    };

    try {
        const baseURL = process.env.DUITKU_MODE === 'production'
            ? 'https://passport.duitku.com/webapi/api/merchant/v2'
            : 'https://sandbox.duitku.com/webapi/api/merchant/v2';

        const response = await axios.post(`${baseURL}/inquiry`, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(method, callbackUrl, 'SUCCESS', response.data);
    } catch (error) {
        if (error.response) {
            console.log(method, callbackUrl, 'ERROR DATA:', error.response.data);
        } else {
            console.log(method, callbackUrl, 'ERROR:', error.message);
        }
    }
}

async function run() {
    await test('SP', 'https://superkafe.com/api/payments/callback');
    await test('SP', 'http://localhost:5001/api/payments/callback');
}
run();