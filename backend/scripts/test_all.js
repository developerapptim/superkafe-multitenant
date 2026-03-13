const crypto = require('crypto');
const axios = require('axios');

const merchantCode = 'D21880';
const apiKey = '19b0f7d8fe9d930e21545ad18637d0b3';
const orderId = 'SUB-TEST-' + Date.now();
const amount = 200000;

const payloadV1 = {
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
  signature: crypto.createHash('md5').update(`${merchantCode}${orderId}${amount}${apiKey}`).digest('hex')
};

const timestamp = new Date().getTime();
const payloadV2 = {
  paymentAmount: amount,
  merchantOrderId: orderId + "2",
  productDetails: 'Paket',
  email: 'negoesdiamond@gmail.com',
  customerVaName: 'Aldy',
  phoneNumber: '08123456789',
  itemDetails: [{ name: 'Paket', price: amount, quantity: 1 }],
  customerDetail: { firstName: 'Aldy', lastName: 'Jabir', email: 'negoesdiamond@gmail.com', phoneNumber: '08123456789' },
  callbackUrl: 'https://api.superkafe.com/api/payments/callback',
  returnUrl: 'https://superkafe.com/',
  expiryPeriod: 60
};
const headersV2 = {
  "x-duitku-signature": crypto.createHash('sha256').update(`${merchantCode}${timestamp}${apiKey}`).digest('hex'),
  "x-duitku-timestamp": `${timestamp}`,
  "x-duitku-merchantcode": merchantCode,
  "Content-Type": "application/json"
};

async function checkEndpoint(name, url, payload, headers = { "Content-Type": "application/json" }) {
  try {
    const res = await axios.post(url, payload, { headers, timeout: 5000 });
    console.log(`[PASS] ${name} ->`, res.data);
  } catch (err) {
    const errText = err.response?.data?.Message || err.response?.data?.statusMessage || err.response?.data || err.message;
    console.log(`[FAIL] ${name} -> ${JSON.stringify(errText)}`);
  }
}

async function run() {
  await checkEndpoint('V1 api-prod createInvoice', 'https://api-prod.duitku.com/api/merchant/createInvoice', payloadV1);
  await checkEndpoint('V1 passport createInvoice', 'https://passport.duitku.com/webapi/api/merchant/createInvoice', payloadV1);
  await checkEndpoint('V2 passport inquiry', 'https://passport.duitku.com/webapi/api/merchant/v2/inquiry', payloadV2, headersV2);
  await checkEndpoint('V1 passport inquiry', 'https://passport.duitku.com/webapi/api/merchant/inquiry', payloadV2, headersV2);
}

run();
