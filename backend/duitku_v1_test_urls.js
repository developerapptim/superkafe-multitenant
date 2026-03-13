const crypto = require('crypto');
const axios = require('axios');

const merchantCode = 'D21880';
const apiKey = '19b0f7d8fe9d930e21545ad18637d0b3';
const paymentAmount = 10000;
const merchantOrderId = 'TEST_' + Date.now();

const timestamp = new Date().getTime();
const stringToHash = `${merchantCode}${timestamp}${apiKey}`;
const signature = crypto.createHash('sha256').update(stringToHash).digest('hex');

async function testV1(url) {
  const payload = {
    paymentAmount,
    merchantOrderId,
    productDetails: "Test Detail",
    additionalParam: "",
    merchantUserInfo: "",
    customerVaName: "Test User",
    email: "test@example.com",
    phoneNumber: "08123456789",
    itemDetails: [{ name: "Test Item", price: 10000, quantity: 1 }],
    customerDetail: {
      firstName: "Test", lastName: "User", email: "test@example.com", phoneNumber: "08123456789"
    },
    callbackUrl: "https://api.superkafe.com/api/payments/callback",
    returnUrl: "https://superkafe.com/return",
    expiryPeriod: 60
  };

  try {
    const response = await axios.post(url, payload, {
      headers: { 
        "Content-Type": "application/json",
        "x-duitku-signature": signature,
        "x-duitku-timestamp": `${timestamp}`,
        "x-duitku-merchantcode": merchantCode
      }
    });
    console.log(`[V1 ${url}] SUCCESS:`, response.data.statusCode, response.data.statusMessage, response.data.paymentUrl);
  } catch (err) {
    let msg = err.response?.data || err.message;
    console.log(`[V1 ${url}] FAILED:`, JSON.stringify(msg).replace(/\\r\\n|\\n/g, " "));
  }
}

async function run() {
  await testV1('https://api-prod.duitku.com/api/merchant/createInvoice');
  await testV1('https://passport.duitku.com/webapi/api/merchant/v2/inquiry');
  await testV1('https://api-prod.duitku.com/api/merchant/v2/inquiry');
}

run();
