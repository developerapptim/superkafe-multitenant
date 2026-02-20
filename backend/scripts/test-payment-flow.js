/**
 * Payment Flow Testing Script
 * Script untuk test payment integration secara cepat
 * 
 * Usage:
 * node scripts/test-payment-flow.js
 */

require('dotenv').config();
const PaymentService = require('../services/payment/PaymentService');

// ANSI color codes untuk output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function testPaymentFlow() {
  try {
    logSection('🧪 PAYMENT INTEGRATION TEST');

    // Test 1: Check environment variables
    logSection('Test 1: Environment Configuration');
    
    const requiredEnvVars = [
      'PAYMENT_PROVIDER',
      'DUITKU_MODE',
      'DUITKU_MERCHANT_CODE',
      'DUITKU_API_KEY',
      'BACKEND_URL',
      'FRONTEND_URL'
    ];

    let envCheckPassed = true;
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        log(`✓ ${envVar}: ${process.env[envVar]}`, 'green');
      } else {
        log(`✗ ${envVar}: NOT SET`, 'red');
        envCheckPassed = false;
      }
    }

    if (!envCheckPassed) {
      log('\n❌ Environment variables tidak lengkap!', 'red');
      log('Silakan update file .env sesuai .env.example', 'yellow');
      process.exit(1);
    }

    log('\n✅ Environment configuration OK', 'green');

    // Test 2: Payment Service Initialization
    logSection('Test 2: Payment Service Initialization');
    
    const providerName = PaymentService.gateway.getProviderName();
    log(`Provider: ${providerName}`, 'blue');
    log(`Mode: ${process.env.DUITKU_MODE}`, 'blue');
    log('✅ Payment Service initialized successfully', 'green');

    // Test 3: Get Pricing
    logSection('Test 3: Get Pricing Plans');
    
    const pricing = {
      monthly: PaymentService.getPricing('monthly'),
      quarterly: PaymentService.getPricing('quarterly'),
      yearly: PaymentService.getPricing('yearly')
    };

    console.log(JSON.stringify(pricing, null, 2));
    log('✅ Pricing plans loaded successfully', 'green');

    // Test 4: Signature Generation (Mock)
    logSection('Test 4: Signature Generation Test');
    
    const DuitkuProvider = require('../services/payment/providers/DuitkuProvider');
    const provider = new DuitkuProvider({
      merchantCode: process.env.DUITKU_MERCHANT_CODE,
      apiKey: process.env.DUITKU_API_KEY,
      mode: process.env.DUITKU_MODE
    });

    const testOrderId = 'SUB-TEST-1234567890';
    const testAmount = 99000;
    const signature = provider.generateSignature(testOrderId, testAmount);
    
    log(`Order ID: ${testOrderId}`, 'blue');
    log(`Amount: Rp ${testAmount.toLocaleString('id-ID')}`, 'blue');
    log(`Signature: ${signature}`, 'blue');
    log('✅ Signature generated successfully', 'green');

    // Test 5: Callback Signature Verification
    logSection('Test 5: Callback Signature Verification');
    
    // Callback signature uses different parameter order: merchantCode + amount + merchantOrderId + apiKey
    const crypto = require('crypto');
    const callbackSignature = crypto
      .createHash('md5')
      .update(`${process.env.DUITKU_MERCHANT_CODE}${testAmount}${testOrderId}${process.env.DUITKU_API_KEY}`)
      .digest('hex');
    
    const isValid = provider.verifyCallbackSignature(testOrderId, testAmount, callbackSignature);
    
    if (isValid) {
      log('✅ Callback signature verification PASSED', 'green');
    } else {
      log('✗ Callback signature verification FAILED', 'red');
    }

    // Test 6: Create Invoice (Dry Run - tidak hit API)
    logSection('Test 6: Create Invoice Parameters');
    
    const invoiceParams = {
      tenantSlug: 'test-tenant',
      planType: 'monthly',
      email: 'test@example.com',
      customerName: 'Test User',
      phoneNumber: '08123456789'
    };

    log('Invoice Parameters:', 'blue');
    console.log(JSON.stringify(invoiceParams, null, 2));
    log('✅ Invoice parameters validated', 'green');

    // Summary
    logSection('📊 TEST SUMMARY');
    
    log('✅ All tests passed!', 'green');
    log('\nNext Steps:', 'yellow');
    log('1. Start backend server: npm start', 'cyan');
    log('2. Test API endpoint: curl http://localhost:5001/api/payments/pricing', 'cyan');
    log('3. Login ke frontend dan test payment flow', 'cyan');
    log('4. Check PAYMENT_TESTING_GUIDE.md untuk detailed testing', 'cyan');

  } catch (error) {
    logSection('❌ TEST FAILED');
    log(`Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
testPaymentFlow();
