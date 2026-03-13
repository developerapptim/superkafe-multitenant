const crypto = require('crypto');
const axios = require('axios');

const merchantCode = 'D21880';
const apiKey = '19b0f7d8fe9d930e21545ad18637d0b3';
const paymentAmount = 10000;
const merchantOrderId = 'TEST_' + Date.now();

const stringToHash = `${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}`;
const signature = crypto.createHash('md5').update(stringToHash).digest('hex');

async function test(methodName, methodValue) {
  const payload = {
    merchantCode,
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
    callbackUrl: "https://example.com/callback",
    returnUrl: "https://example.com/return",
    signature,
    expiryPeriod: 60
  };

  if (methodValue !== 'OMIT') {
    payload.paymentMethod = methodValue;
  }

  try {
    const response = await axios.post('https://passport.duitku.com/webapi/api/merchant/v2/inquiry', payload, {
      headers: { "Content-Type": "application/json" }
    });
    console.log(JSON.stringify({ methodName, result: 'OK', code: response.data.statusCode, msg: response.data.statusMessage }));
  } catch (err) {
    console.log(JSON.stringify({ methodName, result: 'ERROR', detail: err.response?.data?.Message || err.response?.data?.statusMessage || err.message }));
  }
}

async function run() {
  await test('Empty String', "");
  await test('Omitted', 'OMIT');
  await test('Space', " ");
  await test('00', "00");
  await test('VC', "VC");
  await test('ALL', "ALL");
}

run();
