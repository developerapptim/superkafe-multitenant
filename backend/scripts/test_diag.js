const crypto = require('crypto');
const axios = require('axios');

const merchantCode = 'D21880';
const apiKey = '19b0f7d8fe9d930e21545ad18637d0b3';

const orderId = 'SUB-TEST-' + Date.now();
const amount = 200000;

async function testStandardV1() {
  const stringToHash = `${merchantCode}${orderId}${amount}${apiKey}`;
  const signature = crypto.createHash('md5').update(stringToHash).digest('hex');

  const payload = {
    merchantCode,
    paymentAmount: amount,
    merchantOrderId: orderId,
    productDetails: 'Paket Starter SuperKafe - 30 Hari',
    email: 'negoesdiamond@gmail.com',
    customerVaName: 'Aldy Jabir',
    phoneNumber: '08123456789',
    itemDetails: [{ name: 'Paket Starter', price: amount, quantity: 1 }],
    customerDetail: { firstName: 'Aldy', lastName: 'Jabir', email: 'negoesdiamond@gmail.com', phoneNumber: '08123456789' },
    callbackUrl: 'https://api.superkafe.com/api/payments/callback',
    returnUrl: 'https://superkafe.com/',
    expiryPeriod: 60,
    signature
  };

  try {
    const res = await axios.post('https://passport.duitku.com/webapi/api/merchant/createInvoice', payload, {
      headers: { "Content-Type": "application/json" }
    });
    console.log('STANDARD V1 (passport.duitku) SUCCESS:', res.data);
    return true;
  } catch (err) {
    console.log('STANDARD V1 (passport.duitku) ERROR:', err.response?.data?.Message || err.response?.data?.statusMessage || err.message);
  }

  try {
    const res2 = await axios.post('https://api-prod.duitku.com/api/merchant/createInvoice', payload, {
      headers: { "Content-Type": "application/json" }
    });
    console.log('STANDARD V1 (api-prod.duitku) SUCCESS:', res2.data);
    return true;
  } catch (err) {
    console.log('STANDARD V1 (api-prod.duitku) ERROR:', err.response?.data || err.message);
  }
}

async function testPassportV2() {
  const timestamp = new Date().getTime();
  const stringToHash = `${merchantCode}${timestamp}${apiKey}`;
  const signature = crypto.createHash('sha256').update(stringToHash).digest('hex');

  const payload = {
    paymentAmount: amount,
    merchantOrderId: orderId,
    productDetails: 'Paket Starter SuperKafe - 30 Hari',
    email: 'negoesdiamond@gmail.com',
    customerVaName: 'Aldy Jabir',
    phoneNumber: '08123456789',
    itemDetails: [{ name: 'Paket Starter', price: amount, quantity: 1 }],
    customerDetail: { firstName: 'Aldy', lastName: 'Jabir', email: 'negoesdiamond@gmail.com', phoneNumber: '08123456789' },
    callbackUrl: 'https://api.superkafe.com/api/payments/callback',
    returnUrl: 'https://superkafe.com/',
    expiryPeriod: 60
  };

  try {
    const res = await axios.post('https://passport.duitku.com/webapi/api/merchant/v2/inquiry', payload, {
      headers: {
        "x-duitku-signature": signature,
        "x-duitku-timestamp": `${timestamp}`,
        "x-duitku-merchantcode": merchantCode,
        "Content-Type": "application/json"
      }
    });
    console.log('PASSPORT V2 SUCCESS:', res.data);
  } catch (err) {
    console.log('PASSPORT V2 ERROR:', err.response?.data?.Message || err.response?.data?.statusMessage || err.message);
  }
}

async function run() {
  console.log("== TESTING STANDARD V1 ==");
  await testStandardV1();
  console.log("\n== TESTING PASSPORT V2 ==");
  await testPassportV2();
}

run();
