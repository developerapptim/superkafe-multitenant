const crypto = require('crypto');
const { execSync } = require('child_process');

const merchantCode = 'D21880';
const apiKey = '19b0f7d8fe9d930e21545ad18637d0b3';
const merchantOrderId = 'SUB-TEST-' + Date.now();
const paymentAmount = 200000;

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
  itemDetails: [{ name: 'Paket', price: paymentAmount, quantity: 1 }],
  customerDetail: { firstName: 'Aldy', lastName: 'Jabir', email: 'negoesdiamond@gmail.com', phoneNumber: '08123456789' },
  callbackUrl: 'https://api.superkafe.com/api/payments/callback',
  returnUrl: 'https://superkafe.com/',
  expiryPeriod: 60,
  signature
};

const fs = require('fs');
fs.writeFileSync('payload.json', JSON.stringify(payload));

try {
  console.log("CURLing api-prod.duitku.com:");
  const out1 = execSync("curl -v -X POST https://api-prod.duitku.com/api/merchant/createInvoice -H 'Content-Type: application/json' -d @payload.json", { stdio: 'pipe' });
  console.log(out1.toString());
} catch(e) {
  console.log("CURL 1 ERROR STDOUT:", e.stdout ? e.stdout.toString() : '');
  console.log("CURL 1 ERROR STDERR:", e.stderr ? e.stderr.toString() : '');
}

try {
  console.log("\nCURLing passport.duitku.com (v1):");
  const out2 = execSync("curl -v -X POST https://passport.duitku.com/webapi/api/merchant/createInvoice -H 'Content-Type: application/json' -d @payload.json", { stdio: 'pipe' });
  console.log(out2.toString());
} catch(e) {
  console.log("CURL 2 ERROR STDOUT:", e.stdout ? e.stdout.toString() : '');
  console.log("CURL 2 ERROR STDERR:", e.stderr ? e.stderr.toString() : '');
}
