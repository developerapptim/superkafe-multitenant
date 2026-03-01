const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const merchantCode = process.env.DUITKU_MERCHANT_CODE;
const apiKey = process.env.DUITKU_API_KEY;

const timestamp = new Date().getTime();
const signature = crypto.createHash('sha256').update(`${merchantCode}${timestamp}${apiKey}`).digest('hex');

const amount = 200000;
const merchantOrderId = 'TEST-UI-' + Date.now();

const payload = {
    paymentAmount: amount,
    merchantOrderId: merchantOrderId,
    productDetails: 'Test Duitku UI',
    email: 'test@example.com',
    additionalParam: '',
    merchantUserInfo: '',
    customerVaName: 'Test Customer',
    phoneNumber: '08123456789',
    itemDetails: [
        {
            name: 'Test Plan',
            price: amount,
            quantity: 1
        }
    ],
    customerDetail: {
        firstName: 'Test',
        lastName: 'Customer',
        email: 'test@example.com',
        phoneNumber: '08123456789',
        billingAddress: {
            firstName: "Test",
            lastName: "Customer",
            address: "Jl. Sudirman",
            city: "Jakarta",
            postalCode: "12345",
            phone: "08123456789",
            countryCode: "ID"
        },
        shippingAddress: {
            firstName: "Test",
            lastName: "Customer",
            address: "Jl. Sudirman",
            city: "Jakarta",
            postalCode: "12345",
            phone: "08123456789",
            countryCode: "ID"
        }
    },
    callbackUrl: 'http://localhost:5001/api/payments/callback',
    returnUrl: 'http://localhost:5174/admin',
    expiryPeriod: 60
    // NO paymentMethod
};

const endpoint = 'https://api-sandbox.duitku.com/api/merchant/createInvoice';

async function testDuitku() {
    console.log('Sending payload to:', endpoint);
    try {
        const res = await axios({
            method: 'POST',
            url: endpoint,
            data: payload,
            headers: {
                "Accept": "application/json",
                "Content-type": "application/json; charset=UTF-8",
                "x-duitku-signature": signature,
                "x-duitku-timestamp": `${timestamp}`,
                "x-duitku-merchantcode": `${merchantCode}`
            }
        });
        console.log('Response:', res.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testDuitku();
