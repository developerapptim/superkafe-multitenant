# 💳 Payment Service - Architecture Documentation

## 📐 Architecture Overview

Payment service menggunakan **Interface/Adapter Pattern** untuk memudahkan switching antara payment gateway providers.

```
┌─────────────────────────────────────────────────────────┐
│                    PaymentController                    │
│                  (API Endpoints Layer)                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│                    PaymentService                       │
│                 (Business Logic Layer)                  │
│  - createSubscriptionPayment()                          │
│  - processCallback()                                    │
│  - upgradeTenant()                                      │
│  - getPricing()                                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│                   PaymentGateway                        │
│                  (Interface Layer)                      │
│  - createInvoice()                                      │
│  - verifyCallback()                                     │
│  - checkStatus()                                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│                Provider Implementation                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Duitku     │  │  Midtrans    │  │   Xendit     │ │
│  │  Provider    │  │  Provider    │  │  Provider    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
backend/services/payment/
├── README.md                    # This file
├── PaymentGateway.js            # Interface/Adapter layer
├── PaymentService.js            # Business logic layer
└── providers/
    ├── DuitkuProvider.js        # Duitku implementation
    └── [Future providers...]    # Midtrans, Xendit, etc.
```

---

## 🔧 Components

### 1. PaymentGateway.js (Interface Layer)

**Purpose:** Abstract interface untuk semua payment providers

**Methods:**
- `createInvoice(params)` - Create payment invoice
- `verifyCallback(data)` - Verify callback from provider
- `checkStatus(orderId)` - Check payment status
- `getProviderName()` - Get current provider name

**Example:**
```javascript
const gateway = new PaymentGateway(provider);
const result = await gateway.createInvoice({
  merchantOrderId: 'SUB-TENANT-123',
  amount: 99000,
  email: 'user@example.com'
});
```

---

### 2. PaymentService.js (Business Logic Layer)

**Purpose:** Handle business logic untuk payment processing

**Methods:**
- `createSubscriptionPayment(params)` - Create subscription payment
- `processCallback(data)` - Process callback from gateway
- `upgradeTenant(tenantSlug)` - Upgrade tenant to paid status
- `getPricing(planType)` - Get pricing for plan
- `checkPaymentStatus(orderId)` - Check payment status

**Example:**
```javascript
const PaymentService = require('./PaymentService');

const result = await PaymentService.createSubscriptionPayment({
  tenantSlug: 'warkop-pusat',
  planType: 'monthly',
  email: 'admin@warkop.com'
});
```

---

### 3. DuitkuProvider.js (Implementation Layer)

**Purpose:** Duitku-specific implementation

**Methods:**
- `generateSignature(orderId, amount)` - Generate MD5 signature
- `verifyCallbackSignature(orderId, amount, signature)` - Verify callback
- `createInvoice(params)` - Call Duitku API
- `verifyCallback(data)` - Verify Duitku callback
- `checkStatus(orderId)` - Check status via Duitku API

**Signature Format:**
```javascript
// Create Invoice
MD5(merchantCode + merchantOrderId + amount + apiKey)

// Verify Callback
MD5(merchantCode + amount + merchantOrderId + apiKey)
```

---

## 🔄 Payment Flow

### 1. Create Invoice Flow

```javascript
// 1. Controller receives request
PaymentController.createInvoice(req, res)
  ↓
// 2. Service handles business logic
PaymentService.createSubscriptionPayment({
  tenantSlug, planType, email
})
  ↓
// 3. Gateway calls provider
gateway.createInvoice(params)
  ↓
// 4. Provider generates signature
DuitkuProvider.generateSignature(orderId, amount)
  ↓
// 5. Provider calls Duitku API
axios.post('https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry')
  ↓
// 6. Return payment URL to user
{ paymentUrl, reference, merchantOrderId }
```

### 2. Callback Processing Flow

```javascript
// 1. Duitku sends callback
POST /api/payments/callback
  ↓
// 2. Controller receives callback
PaymentController.handleCallback(req, res)
  ↓
// 3. Service processes callback
PaymentService.processCallback(data)
  ↓
// 4. Gateway verifies callback
gateway.verifyCallback(data)
  ↓
// 5. Provider verifies signature
DuitkuProvider.verifyCallbackSignature(orderId, amount, signature)
  ↓
// 6. Service upgrades tenant
PaymentService.upgradeTenant(tenantSlug)
  ↓
// 7. Update tenant in database
Tenant.update({ status: 'paid', subscriptionExpiresAt: +30 days })
```

---

## 🔌 Adding New Payment Provider

### Step 1: Create Provider File

Create `providers/MidtransProvider.js`:

```javascript
class MidtransProvider {
  constructor(config) {
    this.name = 'Midtrans';
    this.serverKey = config.serverKey;
    this.clientKey = config.clientKey;
    this.mode = config.mode || 'sandbox';
    
    this.baseURL = this.mode === 'production'
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com';
  }

  async createInvoice(params) {
    // Midtrans-specific implementation
    // 1. Generate auth header
    // 2. Prepare payload
    // 3. Call Midtrans API
    // 4. Return payment URL
  }

  async verifyCallback(data) {
    // Midtrans-specific verification
    // 1. Verify signature hash
    // 2. Check transaction status
    // 3. Return verification result
  }

  async checkStatus(orderId) {
    // Midtrans-specific status check
    // 1. Call status API
    // 2. Parse response
    // 3. Return status
  }
}

module.exports = MidtransProvider;
```

### Step 2: Update PaymentService

Edit `PaymentService.js`:

```javascript
initializeProvider() {
  const providerName = process.env.PAYMENT_PROVIDER || 'duitku';

  switch (providerName.toLowerCase()) {
    case 'duitku':
      return new DuitkuProvider({
        merchantCode: process.env.DUITKU_MERCHANT_CODE,
        apiKey: process.env.DUITKU_API_KEY,
        mode: process.env.DUITKU_MODE
      });
    
    case 'midtrans':  // NEW
      return new MidtransProvider({
        serverKey: process.env.MIDTRANS_SERVER_KEY,
        clientKey: process.env.MIDTRANS_CLIENT_KEY,
        mode: process.env.MIDTRANS_MODE
      });
    
    default:
      throw new Error(`Unsupported payment provider: ${providerName}`);
  }
}
```

### Step 3: Update Environment

Edit `.env`:

```env
PAYMENT_PROVIDER=midtrans
MIDTRANS_SERVER_KEY=your_server_key
MIDTRANS_CLIENT_KEY=your_client_key
MIDTRANS_MODE=sandbox
```

### Step 4: Done!

No changes needed in:
- ✅ PaymentController
- ✅ PaymentGateway
- ✅ Frontend code
- ✅ Routes
- ✅ Business logic

---

## 🧪 Testing

### Unit Tests

```bash
# Test Duitku provider
npm test tests/payment/duitku.test.js

# Test new provider (create test file first)
npm test tests/payment/midtrans.test.js
```

### Integration Tests

```bash
# Quick test all components
node scripts/test-payment-flow.js
```

### Manual Testing

```bash
# Test create invoice
curl -X POST http://localhost:5001/api/payments/create-invoice \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"test","planType":"monthly","email":"test@example.com"}'

# Test get pricing
curl http://localhost:5001/api/payments/pricing
```

---

## 🔐 Security Best Practices

### 1. Signature Verification
Always verify signatures from payment gateway:

```javascript
const isValid = provider.verifyCallbackSignature(
  orderId,
  amount,
  receivedSignature
);

if (!isValid) {
  throw new Error('Invalid signature');
}
```

### 2. Merchant Code Validation
Verify merchant code matches:

```javascript
if (data.merchantCode !== this.merchantCode) {
  throw new Error('Invalid merchant code');
}
```

### 3. Order ID Format
Use consistent format for order IDs:

```javascript
const merchantOrderId = `SUB-${tenantSlug.toUpperCase()}-${Date.now()}`;
```

### 4. Amount Validation
Always validate amount matches expected:

```javascript
if (data.amount !== expectedAmount) {
  throw new Error('Amount mismatch');
}
```

---

## 📊 Logging

### Log Levels

```javascript
// INFO - Normal operations
console.log('[PAYMENT] Creating invoice', { orderId, amount });

// WARN - Potential issues
console.warn('[PAYMENT] Payment not successful', { resultCode });

// ERROR - Failures
console.error('[PAYMENT ERROR] Create invoice failed', { error });
```

### Log Format

```javascript
console.log('[COMPONENT] Action', {
  key: 'value',
  timestamp: new Date().toISOString()
});
```

---

## 🐛 Error Handling

### Try-Catch Pattern

```javascript
async createInvoice(params) {
  try {
    // Implementation
    return { success: true, data };
  } catch (error) {
    console.error('[PROVIDER ERROR]', {
      error: error.message,
      stack: error.stack,
      params
    });
    throw error;
  }
}
```

### Error Response Format

```javascript
{
  success: false,
  error: 'User-friendly error message',
  code: 'ERROR_CODE',
  details: { /* Additional info */ }
}
```

---

## 📈 Performance Considerations

### 1. Connection Pooling
Reuse HTTP connections for API calls

### 2. Caching
Cache pricing data (rarely changes)

### 3. Async Processing
Process callbacks asynchronously

### 4. Timeout Handling
Set appropriate timeouts for API calls

```javascript
const response = await axios.post(url, data, {
  timeout: 30000 // 30 seconds
});
```

---

## 🔄 Maintenance

### Regular Tasks

1. **Monitor Logs**
   - Check for errors
   - Track success rates
   - Monitor response times

2. **Update Credentials**
   - Rotate API keys periodically
   - Update when switching modes

3. **Test Callbacks**
   - Verify callback URL accessible
   - Test signature verification
   - Check error handling

4. **Review Pricing**
   - Update pricing plans as needed
   - Adjust discounts

---

## 📚 Resources

### Duitku
- Docs: https://docs.duitku.com
- Sandbox: https://sandbox.duitku.com
- Support: support@duitku.com

### Code Examples
- See `backend/tests/payment/` for examples
- See `backend/scripts/test-payment-flow.js` for testing

### Documentation
- Setup: `PAYMENT_SETUP_GUIDE.md`
- Testing: `PAYMENT_TESTING_GUIDE.md`
- Complete: `PAYMENT_INTEGRATION_COMPLETE.md`

---

## 💡 Tips & Tricks

### 1. Use ngrok for Local Testing
```bash
ngrok http 5001
# Update callback URL in Duitku dashboard
```

### 2. Test with Small Amounts
Start with Rp 10.000 in production

### 3. Monitor Callback Logs
Always log callback data for debugging

### 4. Implement Retry Logic
Retry failed API calls with exponential backoff

### 5. Use Environment Variables
Never hardcode credentials

---

**Last Updated:** February 21, 2026
**Version:** 1.0.0
**Status:** Production Ready
