const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config({ path: './.env' });

const merchantCode = process.env.DUITKU_MERCHANT_CODE || 'D21880';
const apiKey = process.env.DUITKU_API_KEY || '19b0f7d8fe9d930e21545ad18637d0b3';
const amount = 1700000; // Harga paket Bisnis
const merchantOrderId = 'SUB-NEGOES-BISNIS-' + Date.now();

// Signature formula: MD5(merchantCode + amount + merchantOrderId + apiKey)
const stringToHash = `${merchantCode}${amount}${merchantOrderId}${apiKey}`;
const signature = crypto.createHash('md5').update(stringToHash).digest('hex');

const payload = {
  merchantCode: merchantCode,
  amount: amount.toString(), // Duitku usually sends as string
  merchantOrderId: merchantOrderId,
  productDetail: 'Paket Bisnis SuperKafe - 365 Hari (Hemat Rp 700.000)',
  additionalParam: '',
  paymentMethod: 'VC', // Kartu Kredit atau lainnya
  resultCode: '00',  // 00 = Success, 01 = Failed
  merchantUserId: 'test@example.com',
  reference: 'D21880TEST' + Date.now(),
  signature: signature,
  publisherOrderId: 'PUB' + Date.now(),
  spUserHash: 'spUserHash123',
  settlementDate: new Date().toISOString().substring(0, 10).split('-').join('')
};

async function runCallback() {
  console.log('Sending callback with payload:', payload);

  const testPorts = [5000, 5001]; // Seringkali dev pakai 5000 atau 5001
  let connected = false;

  for (const port of testPorts) {
    if (connected) break;
    try {
      const url = `http://localhost:${port}/api/payments/callback`;
      console.log(`\nTesting callback on ${url}...`);
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' } // Duitku sends form-urlencoded usually
      });
      console.log(`[SUCCESS on port ${port}]:`, response.status, response.data);
      connected = true;
    } catch (err) {
      console.log(`[FAILED on port ${port}]:`, err.response?.data?.message || err.message);
    }
  }

  if (!connected) {
    console.log('Semua port percobaan gagal. Mungkin url callbacknya berbeda?');
  }
}

runCallback();
