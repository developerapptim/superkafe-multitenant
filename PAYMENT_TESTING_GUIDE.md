# 🧪 Payment Integration Testing Guide

## 📋 Prerequisites

### 1. Environment Setup

Pastikan `.env` sudah dikonfigurasi dengan benar:

```env
# Payment Gateway Configuration
PAYMENT_PROVIDER=duitku
DUITKU_MODE=sandbox
DUITKU_MERCHANT_CODE=D12345
DUITKU_API_KEY=your-sandbox-api-key
BACKEND_URL=http://localhost:5001
FRONTEND_URL=http://localhost:5002
```

### 2. Dependencies Installed

```bash
# Backend - sudah ada (crypto built-in, axios)
cd backend
npm install

# Frontend - canvas-confetti sudah diinstall
cd frontend
npm install
```

### 3. Duitku Sandbox Account

1. Register di [Duitku Sandbox](https://sandbox.duitku.com)
2. Login ke dashboard
3. Copy Merchant Code dan API Key
4. Paste ke `backend/.env`

---

## 🧪 Testing Checklist

### Phase 1: Backend Unit Tests

#### Test 1: Signature Generation

```bash
cd backend
npm test tests/payment/duitku.test.js
```

**Expected Output:**
```
✓ should generate correct MD5 signature
✓ should verify valid callback signature
✓ should reject invalid callback signature
✓ should initialize with sandbox mode
```

**Jika gagal:**
- Check parameter order di `DuitkuProvider.js`
- Verify MD5 hash implementation
- Check test data di `duitku.test.js`

---

#### Test 2: Payment Service Initialization

```bash
node -e "const PaymentService = require('./services/payment/PaymentService'); console.log('✅ Payment Service initialized:', PaymentService.gateway.getProviderName());"
```

**Expected Output:**
```
✅ Payment Service initialized: Duitku
```

---

### Phase 2: API Endpoint Tests

#### Test 3: Get Pricing

```bash
curl http://localhost:5001/api/payments/pricing
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "monthly": {
      "amount": 99000,
      "description": "Paket Bulanan SuperKafe - 30 Hari",
      "duration": 30
    },
    "quarterly": {
      "amount": 270000,
      "description": "Paket 3 Bulan SuperKafe - 90 Hari (Hemat 10%)",
      "duration": 90
    },
    "yearly": {
      "amount": 990000,
      "description": "Paket Tahunan SuperKafe - 365 Hari (Hemat 20%)",
      "duration": 365
    }
  }
}
```

---

#### Test 4: Create Invoice (Requires Auth Token)

**Step 1: Login untuk mendapatkan token**

```bash
curl -X POST http://localhost:5001/api/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: warkop-pusat" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**Step 2: Create invoice dengan token**

```bash
curl -X POST http://localhost:5001/api/payments/create-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "x-tenant-id: warkop-pusat" \
  -d '{
    "tenantSlug": "warkop-pusat",
    "planType": "monthly",
    "email": "admin@warkop.com",
    "customerName": "Admin Warkop",
    "phoneNumber": "08123456789"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Invoice berhasil dibuat",
  "data": {
    "paymentUrl": "https://sandbox.duitku.com/payment/...",
    "reference": "DK123456789",
    "merchantOrderId": "SUB-WARKOP-PUSAT-1234567890",
    "amount": 99000,
    "planType": "monthly",
    "expiresAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**Jika gagal:**
- Check token valid (tidak expired)
- Check tenant-slug exists di database
- Check Duitku credentials di .env
- Check backend logs untuk error detail

---

### Phase 3: Frontend Integration Tests

#### Test 5: Pricing Page Load

1. Start frontend: `npm run dev` (di folder frontend)
2. Login sebagai admin
3. Navigate ke `/admin/subscription/upgrade`
4. **Expected:**
   - 3 pricing cards tampil (Monthly, Quarterly, Yearly)
   - Harga sesuai: Rp 99.000, Rp 270.000, Rp 990.000
   - Badge "Populer" di Quarterly
   - Badge "Best Value" di Yearly

---

#### Test 6: Plan Selection

1. Di halaman upgrade, klik pada card "3 Bulan"
2. **Expected:**
   - Card ter-highlight dengan border purple
   - Checkmark icon muncul di pojok kanan atas
   - Button "Lanjutkan Pembayaran" tetap enabled

---

#### Test 7: Create Invoice Flow

1. Pilih plan (misal: Monthly)
2. Klik "Lanjutkan Pembayaran"
3. **Expected:**
   - Loading state muncul ("Memproses...")
   - Toast notification: "Redirect ke halaman pembayaran..."
   - Browser redirect ke Duitku sandbox URL
   - URL format: `https://sandbox.duitku.com/payment/...`

**Jika gagal:**
- Check browser console untuk error
- Check network tab untuk API call
- Verify token tersimpan di localStorage
- Check backend logs

---

### Phase 4: Payment Simulation

#### Test 8: Duitku Sandbox Payment

1. Setelah redirect ke Duitku sandbox
2. Pilih metode pembayaran (misal: Virtual Account BCA)
3. Klik "Bayar"
4. **Di Sandbox Mode:**
   - Duitku akan simulasi pembayaran sukses
   - Callback otomatis dikirim ke backend
   - Redirect ke success page

**Expected Callback:**
```json
{
  "merchantCode": "D12345",
  "merchantOrderId": "SUB-WARKOP-PUSAT-1234567890",
  "amount": "99000",
  "resultCode": "00",
  "signature": "abc123..."
}
```

---

#### Test 9: Callback Processing

**Check backend logs:**
```bash
# Di terminal backend, cari log:
[PAYMENT] Received callback
[DUITKU] Verifying callback
[PAYMENT SERVICE] Processing callback
[PAYMENT SERVICE] Tenant upgraded successfully
```

**Verify di database:**
```javascript
// Di MongoDB shell atau Compass
db.tenants.findOne({ slug: 'warkop-pusat' })

// Expected:
{
  status: 'paid',
  subscriptionExpiresAt: ISODate("2024-02-01T..."), // 30 hari dari sekarang
  trialExpiresAt: ISODate("...") // tetap ada
}
```

---

#### Test 10: Success Page

1. Setelah callback processed, redirect ke `/admin/subscription/success`
2. **Expected:**
   - Confetti animation muncul dari kiri dan kanan
   - Green checkmark icon dengan gradient
   - Text "Pembayaran Berhasil!"
   - Auto redirect ke dashboard setelah 5 detik
   - Countdown timer tampil

---

### Phase 5: Trial Status Update

#### Test 11: Trial Banner Update

1. Setelah redirect ke dashboard
2. **Expected:**
   - Trial banner TIDAK muncul lagi
   - Atau banner berubah jadi "Status: Premium"
   - Tenant status di database = 'paid'

**Verify:**
```bash
# Check tenant status
curl http://localhost:5001/api/tenants/warkop-pusat/trial-status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "paid",
    "isTrialActive": false,
    "subscriptionExpiresAt": "2024-02-01T...",
    "daysRemaining": 30
  }
}
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Invalid signature" di callback

**Cause:** Parameter order salah atau API key tidak match

**Solution:**
```javascript
// Check di DuitkuProvider.js
// Callback signature format:
MD5(merchantCode + amount + merchantOrderId + apiKey)

// Bukan:
MD5(merchantCode + merchantOrderId + amount + apiKey) // ❌ SALAH
```

**Test:**
```bash
cd backend
npm test tests/payment/duitku.test.js
```

---

### Issue 2: Callback tidak diterima

**Cause:** Duitku tidak bisa reach localhost

**Solution:** Use ngrok untuk expose local server

```bash
# Install ngrok
npm install -g ngrok

# Expose backend
ngrok http 5001

# Copy URL (misal: https://abc123.ngrok.io)
# Update di Duitku dashboard: Callback URL = https://abc123.ngrok.io/api/payments/callback
```

---

### Issue 3: Tenant tidak ter-upgrade

**Cause:** Order ID format salah atau tenant tidak ditemukan

**Solution:**
```javascript
// Check order ID format di PaymentService.js
const merchantOrderId = `SUB-${tenantSlug.toUpperCase()}-${Date.now()}`;

// Extract tenant slug di processCallback:
const parts = verification.merchantOrderId.split('-');
const tenantSlug = parts[1].toLowerCase(); // WARKOP-PUSAT -> warkop-pusat
```

**Debug:**
```bash
# Check backend logs
grep "PAYMENT SERVICE" backend/logs/*.log

# Check tenant exists
db.tenants.findOne({ slug: 'warkop-pusat' })
```

---

### Issue 4: Confetti tidak muncul

**Cause:** canvas-confetti tidak terinstall

**Solution:**
```bash
cd frontend
npm install canvas-confetti

# Verify
npm list canvas-confetti
```

---

### Issue 5: CORS error saat create invoice

**Cause:** Frontend tidak kirim x-tenant-id header

**Solution:**
```javascript
// Check di frontend/src/services/api.js
api.interceptors.request.use((config) => {
  const tenantSlug = localStorage.getItem('tenant_slug') || 'warkop-pusat';
  config.headers['x-tenant-id'] = tenantSlug;
  return config;
});
```

---

## 📊 Test Results Template

```markdown
## Payment Integration Test Results

**Date:** 2024-01-01
**Tester:** [Your Name]
**Environment:** Sandbox

### Backend Tests
- [ ] Signature generation: PASS/FAIL
- [ ] Payment service init: PASS/FAIL
- [ ] Get pricing API: PASS/FAIL
- [ ] Create invoice API: PASS/FAIL

### Frontend Tests
- [ ] Pricing page load: PASS/FAIL
- [ ] Plan selection: PASS/FAIL
- [ ] Create invoice flow: PASS/FAIL

### Integration Tests
- [ ] Duitku redirect: PASS/FAIL
- [ ] Callback processing: PASS/FAIL
- [ ] Tenant upgrade: PASS/FAIL
- [ ] Success page: PASS/FAIL
- [ ] Trial banner update: PASS/FAIL

### Issues Found
1. [Issue description]
2. [Issue description]

### Notes
[Additional notes]
```

---

## 🚀 Production Testing Checklist

Sebelum deploy ke production:

- [ ] Update .env dengan production credentials
- [ ] Test dengan amount kecil (Rp 10.000)
- [ ] Verify callback URL accessible dari internet
- [ ] Test semua payment methods (VA, E-Wallet, dll)
- [ ] Test expired payment scenario
- [ ] Test duplicate callback handling
- [ ] Monitor logs untuk error
- [ ] Setup error alerting (Sentry, etc)
- [ ] Backup database sebelum test
- [ ] Document rollback procedure

---

## 📞 Support

### Duitku Support
- Email: support@duitku.com
- Docs: https://docs.duitku.com
- Dashboard: https://sandbox.duitku.com

### Internal Support
- Check logs: `backend/logs/`
- Run tests: `npm test`
- Check docs: `PAYMENT_INTEGRATION_DUITKU.md`

---

**Happy Testing! 🎉**

Sistem pembayaran SuperKafe siap diuji. Ikuti checklist ini untuk memastikan semua fitur berfungsi dengan baik sebelum production deployment.
