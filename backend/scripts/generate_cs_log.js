const crypto = require('crypto');

const merchantCode = 'D21880';
const apiKey = '19b0f7d8fe9d930e21545ad18637d0b3';

const merchantOrderId = 'SUB-NEEE-STARTER-' + Date.now();
const paymentAmount = 200000;

const timestamp = new Date().getTime();
const stringToHash = `${merchantCode}${timestamp}${apiKey}`;
const signature = crypto.createHash('sha256').update(stringToHash).digest('hex');

const payload = {
  paymentAmount: paymentAmount,
  merchantOrderId: merchantOrderId,
  productDetails: 'Paket Starter SuperKafe - 30 Hari',
  email: 'negoesdiamond@gmail.com',
  additionalParam: '',
  merchantUserInfo: '',
  customerVaName: 'Aldy Jabir',
  phoneNumber: '08123456789',
  itemDetails: [
    {
      name: 'Paket Starter SuperKafe - 30 Hari',
      price: paymentAmount,
      quantity: 1
    }
  ],
  customerDetail: {
    firstName: 'Aldy',
    lastName: 'Jabir',
    email: 'negoesdiamond@gmail.com',
    phoneNumber: '08123456789'
  },
  callbackUrl: 'https://api.superkafe.com/api/payments/callback',
  returnUrl: 'https://superkafe.com/neee/admin/subscription/upgrade?payment=success',
  expiryPeriod: 60
};

const headers = {
  "Accept": "application/json",
  "Content-type": "application/json; charset=UTF-8",
  "x-duitku-signature": signature,
  "x-duitku-timestamp": `${timestamp}`,
  "x-duitku-merchantcode": `${merchantCode}`
};

console.log("=== LOG REQUEST TRANSAKSI UNTUK TIM CS DUITKU ===");
console.log("\n[ENDPOINT API]");
console.log("POST https://passport.duitku.com/webapi/api/merchant/v2/inquiry");

console.log("\n[HEADERS]");
console.log(JSON.stringify(headers, null, 2));

console.log("\n[REQUEST BODY (JSON)]");
console.log(JSON.stringify(payload, null, 2));

console.log("\n=================================================");
