const crypto = require('crypto');
const axios = require('axios');

const merchantCode = 'D21880';
const apiKey = '19b0f7d8fe9d930e21545ad18637d0b3';

const merchantOrderId = 'SUB-TEST-' + Date.now();
const paymentAmount = 200000;

async function testPassportV2() {
  const timestamp = new Date().getTime();
  const stringToHash = `${merchantCode}${timestamp}${apiKey}`;
  const signature = crypto.createHash('sha256').update(stringToHash).digest('hex');

  const payload = {
    paymentAmount,
    merchantOrderId,
    productDetails: 'Paket Starter SuperKafe - 30 Hari',
    email: 'negoesdiamond@gmail.com',
    customerVaName: 'Aldy Jabir',
    phoneNumber: '08123456789',
    itemDetails: [{ name: 'Paket Starter', price: paymentAmount, quantity: 1 }],
    customerDetail: { firstName: 'Aldy', lastName: 'Jabir', email: 'negoesdiamond@gmail.com', phoneNumber: '08123456789' },
    callbackUrl: 'https://api.superkafe.com/api/payments/callback',
    returnUrl: 'https://superkafe.com/',
    expiryPeriod: 60
  };

  try {
    const res = await axios({
      method: 'POST',
      url: 'https://passport.duitku.com/webapi/api/merchant/v2/inquiry',
      data: payload,
      headers: {
        "Accept": "application/json",
        "Content-type": "application/json",
        "x-duitku-signature": signature,
        "x-duitku-timestamp": `${timestamp}`,
        "x-duitku-merchantcode": merchantCode
      }
    });
    console.log('PASSPORT V2 SUCCESS:', res.data);
  } catch (error) {
    console.log('PASSPORT V2 ERROR:', error.response ? error.response.data : error.message);
  }
}

async function testStandardV1() {
  const stringToHash = `${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}`;
  const signature = crypto.createHash('md5').update(stringToHash).digest('hex');

  const payload = {
    merchantCode,
    paymentAmount,
    merchantOrderId,
    productDetails: 'Paket Starter SuperKafe - 30 Hari',
    email: 'negoesdiamond@gmail.com',
    customerVaName: 'Aldy Jabir',
    phoneNumber: '08123456789',
    itemDetails: [{ name: 'Paket Starter', price: paymentAmount, quantity: 1 }],
    customerDetail: { firstName: 'Aldy', lastName: 'Jabir', email: 'negoesdiamond@gmail.com', phoneNumber: '08123456789' },
    callbackUrl: 'https://api.superkafe.com/api/payments/callback',
    returnUrl: 'https://superkafe.com/',
    expiryPeriod: 60,
    signature
  };

  try {
    const res = await axios({
      method: 'POST',
      url: 'https://api-prod.duitku.com/api/merchant/createInvoice',
      data: payload,
      headers: {
        "Accept": "application/json",
        "Content-type": "application/json"
      }
    });
    console.log('STANDARD V1 SUCCESS (api-prod):', res.data);
  } catch (error) {
    console.log('STANDARD V1 ERROR (api-prod):', error.response ? error.response.data : error.message);
  }

  try {
    const res2 = await axios({
      method: 'POST',
      url: 'https://passport.duitku.com/webapi/api/merchant/createInvoice',
      data: payload,
      headers: {
        "Accept": "application/json",
        "Content-type": "application/json"
      }
    });
    console.log('STANDARD V1 SUCCESS (passport):', res2.data);
  } catch (error) {
    console.log('STANDARD V1 ERROR (passport):', error.response ? error.response.data : error.message);
  }
}

async function run() {
  console.log('Testing Passport V2...');
  await testPassportV2();
  console.log('\nTesting Standard V1...');
  await testStandardV1();
}

run();
