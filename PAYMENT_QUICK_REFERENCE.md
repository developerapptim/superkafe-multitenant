# 🚀 Payment Integration - Quick Reference

## ⚡ Quick Start (5 Minutes)

### 1. Setup Environment
```bash
# Copy .env.example to .env
cp backend/.env.example backend/.env

# Edit .env and add Duitku credentials:
PAYMENT_PROVIDER=duitku
DUITKU_MODE=sandbox
DUITKU_MERCHANT_CODE=your_code
DUITKU_API_KEY=your_key
```

### 2. Install Dependencies
```bash
cd frontend
npm install canvas-confetti
```

### 3. Test Setup
```bash
cd backend
node scripts/test-payment-flow.js
```

### 4. Start Servers
```bash
# Terminal 1
cd backend && npm start

# Terminal 2
cd frontend && npm run dev
```

---

## 📡 API Endpoints

### Get Pricing
```bash
GET /api/payments/pricing
```

### Create Invoice
```bash
POST /api/payments/create-invoice
Headers: Authorization, x-tenant-id
Body: {
  tenantSlug, planType, email, customerName, phoneNumber
}
```

### Callback (from Duitku)
```bash
POST /api/payments/callback
Body: {
  merchantCode, merchantOrderId, amount, 
  resultCode, signature
}
```

### Check Status
```bash
GET /api/payments/status/:merchantOrderId
Headers: Authorization
```

---

## 💰 Pricing

| Plan | Price | Duration |
|------|-------|----------|
| Monthly | Rp 99.000 | 30 days |
| Quarterly | Rp 270.000 | 90 days |
| Yearly | Rp 990.000 | 365 days |

---

## 🔐 Signature Format

### Create Invoice
```
MD5(merchantCode + merchantOrderId + amount + apiKey)
```

### Verify Callback
```
MD5(merchantCode + amount + merchantOrderId + apiKey)
```

---

## 📂 File Structure

```
backend/
├── services/payment/
│   ├── PaymentGateway.js          # Interface
│   ├── PaymentService.js          # Business logic
│   └── providers/
│       └── DuitkuProvider.js      # Duitku implementation
├── controllers/
│   └── PaymentController.js       # API endpoints
├── routes/
│   └── paymentRoutes.js           # Routes
├── tests/payment/
│   └── duitku.test.js             # TDD tests
└── scripts/
    └── test-payment-flow.js       # Quick test

frontend/
├── pages/admin/
│   ├── SubscriptionUpgrade.jsx    # Upgrade page
│   └── SubscriptionSuccess.jsx    # Success page
├── components/
│   └── TrialStatusBanner.jsx      # Trial banner
└── services/
    └── api.js                      # Payment API
```

---

## 🧪 Testing Commands

```bash
# Quick test
node scripts/test-payment-flow.js

# Unit tests
npm test tests/payment/duitku.test.js

# API test
curl http://localhost:5001/api/payments/pricing
```

---

## 🔄 Payment Flow

```
User → Upgrade Page → Create Invoice → Duitku Payment
                                            ↓
Success Page ← Redirect ← Payment Success ← Callback
     ↓
Dashboard (Trial banner hidden)
```

---

## 🐛 Common Issues

### "Invalid signature"
→ Check parameter order in signature generation

### "Callback not received"
→ Use ngrok to expose localhost

### "Tenant not upgraded"
→ Check order ID format: `SUB-{SLUG}-{TIMESTAMP}`

### "Confetti not working"
→ Install: `npm install canvas-confetti`

---

## 📞 Quick Links

- Setup: `PAYMENT_SETUP_GUIDE.md`
- Testing: `PAYMENT_TESTING_GUIDE.md`
- Complete: `PAYMENT_INTEGRATION_COMPLETE.md`
- Duitku Docs: https://docs.duitku.com

---

## 🎯 Next Steps

1. Get Duitku credentials
2. Update `.env`
3. Run test script
4. Test payment flow
5. Deploy to production

---

**Status:** ✅ Ready for Testing
**Last Updated:** February 21, 2026
