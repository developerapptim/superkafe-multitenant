# 🚀 Payment Integration Setup Guide

## ✅ Yang Telah Diimplementasikan

### Backend (8 files)
1. ✅ `backend/services/payment/PaymentGateway.js` - Interface layer
2. ✅ `backend/services/payment/PaymentService.js` - Business logic
3. ✅ `backend/services/payment/providers/DuitkuProvider.js` - Duitku implementation
4. ✅ `backend/controllers/PaymentController.js` - API endpoints
5. ✅ `backend/routes/paymentRoutes.js` - Routes
6. ✅ `backend/tests/payment/duitku.test.js` - TDD tests
7. ✅ `backend/server.js` - Routes registered
8. ✅ `backend/.env.example` - Payment config

### Frontend (4 files)
1. ✅ `frontend/src/pages/admin/SubscriptionUpgrade.jsx` - Upgrade page
2. ✅ `frontend/src/pages/admin/SubscriptionSuccess.jsx` - Success page
3. ✅ `frontend/src/services/api.js` - Payment API
4. ✅ `frontend/src/App.jsx` - Routes added
5. ✅ `frontend/src/components/TrialStatusBanner.jsx` - Updated with upgrade link

### Documentation (2 files)
1. ✅ `PAYMENT_INTEGRATION_DUITKU.md` - Complete guide
2. ✅ `PAYMENT_SETUP_GUIDE.md` - This file

## 🔧 Setup Steps

### 1. Install Dependencies

```bash
# Backend (no new dependencies needed - using built-in crypto)
cd backend
# Already have: axios, crypto (built-in)

# Frontend
cd frontend
npm install canvas-confetti
# ✅ DONE - canvas-confetti installed
```

### 2. Configure Environment

Edit `backend/.env`:

```env
# Payment Gateway Configuration
PAYMENT_PROVIDER=duitku
DUITKU_MODE=sandbox
DUITKU_MERCHANT_CODE=D12345
DUITKU_API_KEY=your-sandbox-api-key
BACKEND_URL=http://localhost:5001
FRONTEND_URL=http://localhost:5002
```

### 3. Get Duitku Credentials

1. Register di [Duitku Sandbox](https://sandbox.duitku.com)
2. Login ke dashboard
3. Copy Merchant Code dan API Key
4. Paste ke `.env`

### 4. Quick Test

```bash
cd backend
node scripts/test-payment-flow.js
```

Expected output:
```
✅ Environment configuration OK
✅ Payment Service initialized successfully
✅ Pricing plans loaded successfully
✅ Signature generated successfully
✅ Callback signature verification PASSED
✅ All tests passed!
```

### 5. Test Signature Generation (TDD)

```bash
cd backend
npm test tests/payment/duitku.test.js
```

Expected output:
```
✓ should generate correct MD5 signature
✓ should verify valid callback signature
✓ should initialize with sandbox mode
```

### 5. Start Servers

```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 6. Quick Test Payment Flow

```bash
# Test script untuk verify setup
cd backend
node scripts/test-payment-flow.js
```

### 7. Test Payment Flow (Manual)

1. Login sebagai admin
2. Lihat Trial Banner di dashboard
3. Klik "Upgrade Sekarang"
4. Pilih paket (Monthly/Quarterly/Yearly)
5. Klik "Lanjutkan Pembayaran"
6. Akan redirect ke Duitku sandbox
7. Simulasi pembayaran sukses
8. Akan redirect ke success page
9. Check tenant status di database (should be 'paid')

## 📡 API Testing

### Create Invoice

```bash
curl -X POST http://localhost:5001/api/payments/create-invoice \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantSlug": "warkop-pusat",
    "planType": "monthly",
    "email": "admin@warkop.com",
    "customerName": "Admin"
  }'
```

### Get Pricing

```bash
curl http://localhost:5001/api/payments/pricing
```

### Check Status

```bash
curl http://localhost:5001/api/payments/status/SUB-WARKOP-PUSAT-1234567890 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎯 Pricing Plans

| Plan | Price | Duration | Savings |
|------|-------|----------|---------|
| Monthly | Rp 99.000 | 30 days | - |
| Quarterly | Rp 270.000 | 90 days | Hemat 10% |
| Yearly | Rp 990.000 | 365 days | Hemat 20% |

## 🔐 Security Features

✅ **MD5 Signature Verification**
- Create invoice signature
- Callback signature verification
- Prevent tampering

✅ **Merchant Code Validation**
- Verify callback from Duitku
- Reject invalid merchant

✅ **Order ID Format**
- Format: `SUB-{TENANT_SLUG}-{TIMESTAMP}`
- Extract tenant from order ID
- Prevent duplicate processing

## 🏗️ Architecture Benefits

### Interface/Adapter Pattern

**Easy to Switch Provider**:
```javascript
// Switch dari Duitku ke Midtrans
// Hanya perlu:
// 1. Create MidtransProvider.js
// 2. Update .env: PAYMENT_PROVIDER=midtrans
// 3. Done! No changes in Controller or Frontend
```

**Testable**:
```javascript
// Mock provider untuk testing
const mockProvider = {
  createInvoice: jest.fn(),
  verifyCallback: jest.fn()
};
const gateway = new PaymentGateway(mockProvider);
```

**Maintainable**:
- Separation of concerns
- Single responsibility
- Easy to debug

## 🔄 Payment Flow Diagram

```
User                Frontend              Backend              Duitku
 |                     |                     |                    |
 |--Click Upgrade----->|                     |                    |
 |                     |--Create Invoice---->|                    |
 |                     |                     |--Generate Sig----->|
 |                     |                     |<--Payment URL------|
 |                     |<--Redirect----------|                    |
 |<--Redirect to Duitku|                     |                    |
 |                     |                     |                    |
 |--Pay--------------->|                     |                    |
 |                     |                     |<--Callback---------|
 |                     |                     |--Verify Sig------->|
 |                     |                     |--Update Tenant---->|
 |<--Redirect to Success|                    |                    |
```

## 🧪 Testing Checklist

### Backend Tests
- [ ] Signature generation correct
- [ ] Callback verification works
- [ ] Tenant upgrade successful
- [ ] Invalid signature rejected
- [ ] Duplicate callback handled

### Frontend Tests
- [ ] Pricing page loads
- [ ] Plan selection works
- [ ] Payment redirect works
- [ ] Success page shows
- [ ] Auto redirect to dashboard

### Integration Tests
- [ ] End-to-end payment flow
- [ ] Callback processing
- [ ] Tenant status update
- [ ] Email notification (future)

## 🚀 Production Deployment

### Pre-Production Checklist

- [ ] Get production credentials from Duitku
- [ ] Update .env with production values
- [ ] Test with small amount
- [ ] Verify callback URL accessible
- [ ] Check logs for errors
- [ ] Test rollback scenario

### Production .env

```env
PAYMENT_PROVIDER=duitku
DUITKU_MODE=production
DUITKU_MERCHANT_CODE=your_prod_merchant_code
DUITKU_API_KEY=your_prod_api_key
BACKEND_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Monitoring

```javascript
// Check payment logs
grep "PAYMENT" backend/logs/*.log

// Check callback logs
grep "Callback" backend/logs/*.log

// Check tenant upgrades
db.tenants.find({ status: 'paid' })
```

## 🐛 Common Issues

### Issue 1: Signature Mismatch
**Solution**: Run TDD tests, check parameter order

### Issue 2: Callback Not Received
**Solution**: Use ngrok for local testing
```bash
ngrok http 5001
# Update callback URL di Duitku dashboard
```

### Issue 3: Tenant Not Upgraded
**Solution**: Check backend logs, verify order ID format

## 📚 Next Steps

### Immediate
1. Install canvas-confetti: `npm install canvas-confetti`
2. Configure .env with Duitku credentials
3. Test payment flow
4. Verify tenant upgrade works

### Future Enhancements
1. Email notification setelah payment sukses
2. Invoice PDF generation
3. Payment history page
4. Refund functionality
5. Multiple payment methods
6. Subscription auto-renewal

## 📞 Support

### Duitku Support
- Email: support@duitku.com
- Docs: https://docs.duitku.com
- Dashboard: https://sandbox.duitku.com

### SuperKafe Support
- Check logs: `backend/logs/`
- Run tests: `npm test`
- Check documentation: `PAYMENT_INTEGRATION_DUITKU.md`

---

**Ready to accept payments! 💳**

Sistem pembayaran SuperKafe dengan Duitku sudah siap digunakan. Arsitektur modular memudahkan untuk switch provider di masa depan!
