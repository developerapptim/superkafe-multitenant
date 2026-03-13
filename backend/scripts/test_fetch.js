const crypto = require('crypto');

const merchantCode = 'D21880';
const apiKey = '19b0f7d8fe9d930e21545ad18637d0b3';
const merchantOrderId = 'SUB-TEST-' + Date.now();
const paymentAmount = 200000;

const stringToHash = `${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}`;
const signature = crypto.createHash('md5').update(stringToHash).digest('hex');

const payload = {
  merchantCode: merchantCode,
  paymentAmount: paymentAmount,
  merchantOrderId: merchantOrderId,
  productDetails: 'Paket Starter SuperKafe - 30 Hari',
  email: 'negoesdiamond@gmail.com',
  customerVaName: 'Aldy Jabir',
  phoneNumber: '08123456789',
  itemDetails: [{ name: 'Paket', price: paymentAmount, quantity: 1 }],
  customerDetail: { firstName: 'Aldy', lastName: 'Jabir', email: 'negoesdiamond@gmail.com', phoneNumber: '08123456789' },
  callbackUrl: 'https://api.superkafe.com/api/payments/callback',
  returnUrl: 'https://superkafe.com/',
  expiryPeriod: 60,
  signature: signature
};

async function run() {
  console.log("PAYLOAD V1:", JSON.stringify(payload, null, 2));
  try {
    const res = await fetch('https://api-prod.duitku.com/api/merchant/createInvoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.log("STATUS:", res.status);
    const body = await res.text();
    console.log("BODY:", body);
  } catch (err) {
    console.error("FETCH ERROR:", err);
  }
}

run();
