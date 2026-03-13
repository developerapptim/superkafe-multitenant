const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');

const merchantCode = 'D21880';
const apiKey = '19b0f7d8fe9d930e21545ad18637d0b3';
const paymentAmount = 10000;
const merchantOrderId = 'TEST_' + Date.now();

const timestamp = new Date().getTime();
const stringToHash = `${merchantCode}${timestamp}${apiKey}`;
const signature = crypto.createHash('sha256').update(stringToHash).digest('hex');

let out = "";

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
    out += `[${url}] SUCCESS: ${response.data.statusCode} ${response.data.statusMessage} ${response.data.paymentUrl}\n`;
  } catch (err) {
    let msg = err.response?.data || err.message;
    if (typeof msg === 'object') msg = JSON.stringify(msg);
    out += `[${url}] FAILED: ${msg}\n`;
  }
}

async function run() {
  await testV1('https://api-prod.duitku.com/api/merchant/createInvoice');
  await testV1('https://passport.duitku.com/webapi/api/merchant/v2/inquiry');
  await testV1('https://api-prod.duitku.com/api/merchant/v2/inquiry');
  
  fs.writeFileSync('duitku_urls_results.txt', out, 'utf8');
  console.log('Done!');
}

run();
