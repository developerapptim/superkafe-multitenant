# 💳 Integrasi Pembayaran Duitku - SuperKafe

## 📋 Overview

Sistem pembayaran SuperKafe telah diintegrasikan dengan Duitku Payment Gateway menggunakan arsitektur modular dengan Interface/Adapter Pattern. Ini memudahkan untuk switch ke payment provider lain di masa depan.

## 🏗️ Arsitektur

### Interface/Adapter Pattern

```
Controller
    ↓
PaymentService (Business Logic)
    ↓
PaymentGateway (Interface/Abstract Layer)
    ↓
DuitkuProvider (Concrete Implementation)
```

**Keuntungan**:
- Mudah switch provider (Duitku → Midtrans → dll)
- Testable dan maintainable
- Separation of concerns
- Single Responsibility Principle

## 📁 Struktur File

```
backend/
├── services/
│   └── payment/
│       ├── PaymentGateway.js          # Interface layer
│       ├── PaymentService.js          # Business logic
│       └── providers/
│           └── DuitkuProvider.js      # Duitku implementation
├── controllers/
│   └── PaymentController.js           # API endpoints
├── routes/
│   └── paymentRoutes.js               # Routes
└── tests/
    └── payment/
        └── duitku.test.js             # TDD tests

frontend/
├── pages/
│   └── admin/
│       ├── SubscriptionUpgrade.jsx    # Upgrade page
│       └── SubscriptionSuccess.jsx    # Success page
└── services/
    └── api.js                         # Payment API calls
```

## 🔧 Backend Implementation

### 1. Payment Gateway Interface

```javascript
// backend/services/payment/PaymentGateway.js

class PaymentGateway {
  constructor(provider) {
    this.provider = provider;
  }

  async createInvoice(params) {
    return await this.provider.createInvoice(params);
  }

  async verifyCallback(data) {
    return await this.provider.verifyCallback(data);
  }

  async checkStatus(orderId) {
    return await this.provider.checkStatus(orderId);
  }
}
```

### 2. Duitku Provider

```javascript
// backend/services/payment/providers/DuitkuProvider.js

class DuitkuProvider {
  constructor(config) {
    this.merchantCode = config.merchantCode;
    this.apiKey = config.apiKey;
    this.mode = config.mode; // sandbox or production
    this.baseURL = this.mode === 'production'
      ? 'https://passport.duitku.com/webapi/api/merchant/v2'
      : 'https://sandbox.duitku.com/webapi/api/merchant/v2';
  }

  // Generate MD5 signature
  generateSignature(merchantOrderId, amount) {
    const string = `${this.merchantCode}${merchantOrderId}${amount}${this.apiKey}`;
    return crypto.createHash('md5').update(string).digest('hex');
  }

  // Verify callback signature
  verifyCallbackSignature(merchantOrderId, amount, signature) {
    const expected = crypto
      .createHash('md5')
      .update(`${this.merchantCode}${amount}${merchantOrderId}${this.apiKey}`)
      .digest('hex');
    return signature === expected;
  }

  async createInvoice(params) {
    // Implementation...
  }

  async verifyCallback(data) {
    // Implementation...
  }
}
```

### 3. Payment Service

```javascript
// backend/services/payment/PaymentService.js

class PaymentService {
  constructor() {
    const provider = this.initializeProvider();
    this.gateway = new PaymentGateway(provider);
  }

  initializeProvider() {
    const providerName = process.env.PAYMENT_PROVIDER || 'duitku';
    
    switch (providerName) {
      case 'duitku':
        return new DuitkuProvider({ ... });
      // case 'midtrans':
      //   return new MidtransProvider({ ... });
      default:
        throw new Error(`Unsupported provider: ${providerName}`);
    }
  }

  async createSubscriptionPayment(params) {
    // Business logic...
    const result = await this.gateway.createInvoice(paymentParams);
    return result;
  }

  async processCallback(callbackData) {
    // Verify and process...
    const verification = await this.gateway.verifyCallback(callbackData);
    if (verification.isPaymentSuccess) {
      await this.upgradeTenant(tenantSlug);
    }
  }
}
```

## 🔐 Environment Configuration

### .env Setup

```env
# Payment Gateway
PAYMENT_PROVIDER=duitku
DUITKU_MODE=sandbox
DUITKU_MERCHANT_CODE=D12345
DUITKU_API_KEY=your-api-key-here
BACKEND_URL=http://localhost:5001
FRONTEND_URL=http://localhost:5002
```

### Sandbox vs Production

**Sandbox**:
- URL: `https://sandbox.duitku.com`
- Untuk testing
- Gunakan test credentials dari dashboard

**Production**:
- URL: `https://passport.duitku.com`
- Untuk live transactions
- Gunakan production credentials

## 📡 API Endpoints

### 1. Create Invoice
```http
POST /api/payments/create-invoice
Authorization: Bearer {token}
Content-Type: application/json

{
  "tenantSlug": "warkop-pusat",
  "planType": "monthly",
  "email": "admin@warkop.com",
  "customerName": "Admin",
  "phoneNumber": "08123456789"
}

Response:
{
  "success": true,
  "message": "Invoice berhasil dibuat",
  "data": {
    "paymentUrl": "https://sandbox.duitku.com/payment/...",
    "reference": "DK123456",
    "merchantOrderId": "SUB-WARKOP-PUSAT-1234567890",
    "amount": 99000,
    "planType": "monthly",
    "expiresAt": "2025-02-21T10:30:00.000Z"
  }
}
```

### 2. Payment Callback (dari Duitku)
```http
POST /api/payments/callback
Content-Type: application/json

{
  "merchantCode": "D12345",
  "merchantOrderId": "SUB-WARKOP-PUSAT-1234567890",
  "amount": "99000",
  "resultCode": "00",
  "signature": "abc123..."
}

Response:
{
  "success": true,
  "message": "Payment processed successfully"
}
```

### 3. Check Status
```http
GET /api/payments/status/:merchantOrderId
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "statusCode": "00",
    "statusMessage": "SUCCESS",
    "amount": "99000",
    "reference": "DK123456"
  }
}
```

### 4. Get Pricing
```http
GET /api/payments/pricing

Response:
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

## 🎨 Frontend Implementation

### Subscription Upgrade Page

```jsx
// frontend/src/pages/admin/SubscriptionUpgrade.jsx

const SubscriptionUpgrade = () => {
  const [selectedPlan, setSelectedPlan] = useState('monthly');

  const handleUpgrade = async () => {
    const response = await paymentAPI.createInvoice({
      tenantSlug,
      planType: selectedPlan,
      email: user.email,
      customerName: user.name
    });

    if (response.data.success) {
      // Redirect ke Duitku payment page
      window.location.href = response.data.data.paymentUrl;
    }
  };

  return (
    // UI implementation...
  );
};
```

### Success Page

```jsx
// frontend/src/pages/admin/SubscriptionSuccess.jsx

const SubscriptionSuccess = () => {
  useEffect(() => {
    // Confetti animation
    confetti({ ... });

    // Auto redirect after 5 seconds
    setTimeout(() => {
      navigate('/admin/dashboard');
    }, 5000);
  }, []);

  return (
    // Success UI...
  );
};
```

## 🧪 Testing (TDD)

### Signature Generation Tests

```javascript
// backend/tests/payment/duitku.test.js

describe('DuitkuProvider', () => {
  test('should generate correct MD5 signature', () => {
    const signature = provider.generateSignature('ORDER-001', 100000);
    const expected = crypto
      .createHash('md5')
      .update('D12345ORDER-001100000test-api-key')
      .digest('hex');
    expect(signature).toBe(expected);
  });

  test('should verify valid callback signature', () => {
    const isValid = provider.verifyCallbackSignature(
      'ORDER-001',
      100000,
      validSignature
    );
    expect(isValid).toBe(true);
  });
});
```

### Run Tests

```bash
# Install Jest (if not installed)
npm install --save-dev jest

# Run tests
npm test

# Or specific test file
npm test duitku.test.js
```

## 🔄 Payment Flow

### User Flow

```
1. User klik "Upgrade Sekarang" di Trial Banner
   ↓
2. Redirect ke /admin/subscription/upgrade
   ↓
3. User pilih paket (Monthly/Quarterly/Yearly)
   ↓
4. Klik "Lanjutkan Pembayaran"
   ↓
5. Frontend call POST /api/payments/create-invoice
   ↓
6. Backend generate signature & call Duitku API
   ↓
7. Duitku return payment URL
   ↓
8. Frontend redirect ke payment URL
   ↓
9. User bayar di Duitku
   ↓
10. Duitku call POST /api/payments/callback
   ↓
11. Backend verify signature & update tenant status
   ↓
12. Duitku redirect user ke /admin/subscription/success
   ↓
13. Show success page dengan confetti
   ↓
14. Auto redirect ke dashboard after 5s
```

### Backend Flow

```
createInvoice()
  ↓
PaymentService.createSubscriptionPayment()
  ↓
PaymentGateway.createInvoice()
  ↓
DuitkuProvider.createInvoice()
  ↓
Generate signature
  ↓
Call Duitku API
  ↓
Return payment URL

---

Duitku Callback
  ↓
PaymentController.handleCallback()
  ↓
PaymentService.processCallback()
  ↓
PaymentGateway.verifyCallback()
  ↓
DuitkuProvider.verifyCallback()
  ↓
Verify signature
  ↓
PaymentService.upgradeTenant()
  ↓
Update tenant status to 'paid'
  ↓
Set subscriptionExpiresAt +30 days
```

## 🔐 Security

### Signature Verification

**Create Invoice Signature**:
```
MD5(merchantCode + merchantOrderId + amount + apiKey)
```

**Callback Signature**:
```
MD5(merchantCode + amount + merchantOrderId + apiKey)
```

**Important**: Order berbeda antara create dan callback!

### Validation Checklist

- ✅ Verify merchant code matches
- ✅ Verify signature is valid
- ✅ Check result code (00 = success)
- ✅ Validate amount matches
- ✅ Check order ID format
- ✅ Prevent duplicate processing

## 🚀 Switching to Production

### Steps:

1. **Get Production Credentials**:
   - Login ke Duitku dashboard
   - Get production merchant code & API key

2. **Update .env**:
   ```env
   DUITKU_MODE=production
   DUITKU_MERCHANT_CODE=your_prod_merchant_code
   DUITKU_API_KEY=your_prod_api_key
   ```

3. **Test in Staging**:
   - Test dengan small amount
   - Verify callback works
   - Check tenant upgrade works

4. **Go Live**:
   - Deploy to production
   - Monitor logs
   - Test real transaction

## 🔄 Adding New Payment Provider

### Example: Midtrans

1. **Create Provider**:
```javascript
// backend/services/payment/providers/MidtransProvider.js

class MidtransProvider {
  constructor(config) {
    this.serverKey = config.serverKey;
    this.clientKey = config.clientKey;
    this.mode = config.mode;
  }

  async createInvoice(params) {
    // Midtrans implementation
  }

  async verifyCallback(data) {
    // Midtrans verification
  }
}

module.exports = MidtransProvider;
```

2. **Update PaymentService**:
```javascript
initializeProvider() {
  switch (process.env.PAYMENT_PROVIDER) {
    case 'duitku':
      return new DuitkuProvider({ ... });
    case 'midtrans':
      return new MidtransProvider({ ... });
    default:
      throw new Error('Unsupported provider');
  }
}
```

3. **Update .env**:
```env
PAYMENT_PROVIDER=midtrans
MIDTRANS_SERVER_KEY=...
MIDTRANS_CLIENT_KEY=...
```

That's it! No changes needed in Controller or Frontend!

## 📊 Pricing Plans

| Plan | Price | Duration | Savings |
|------|-------|----------|---------|
| Monthly | Rp 99.000 | 30 days | - |
| Quarterly | Rp 270.000 | 90 days | 10% |
| Yearly | Rp 990.000 | 365 days | 20% |

## 🐛 Troubleshooting

### Issue: Invalid Signature

**Cause**: Signature generation salah  
**Fix**: 
1. Check order parameter (merchantCode, orderId, amount, apiKey)
2. Pastikan tidak ada space atau newline
3. Run TDD tests untuk verify

### Issue: Callback Not Received

**Cause**: URL tidak accessible  
**Fix**:
1. Pastikan backend URL public (bukan localhost)
2. Use ngrok untuk testing: `ngrok http 5001`
3. Update callback URL di Duitku dashboard

### Issue: Payment Success but Tenant Not Upgraded

**Cause**: Callback processing error  
**Fix**:
1. Check backend logs
2. Verify signature validation
3. Check tenant slug extraction from order ID

## 📚 Resources

- [Duitku API Documentation](https://docs.duitku.com)
- [Duitku Sandbox Dashboard](https://sandbox.duitku.com)
- [MD5 Hash Generator](https://www.md5hashgenerator.com)

---

**Status**: ✅ Fully Implemented  
**Version**: 1.0.0  
**Last Updated**: 2025-02-20

**Integrasi pembayaran Duitku SuperKafe siap digunakan! 💳**
