/**
 * Duitku Provider Tests
 * Test Driven Development untuk memastikan signature generation benar
 */

const DuitkuProvider = require('../../services/payment/providers/DuitkuProvider');
const crypto = require('crypto');

describe('DuitkuProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new DuitkuProvider({
      merchantCode: 'D12345',
      apiKey: 'test-api-key-12345',
      mode: 'sandbox'
    });
  });

  describe('generateSignature', () => {
    test('should generate correct MD5 signature', () => {
      const merchantOrderId = 'ORDER-001';
      const amount = 100000;

      const signature = provider.generateSignature(merchantOrderId, amount);

      // Expected: MD5(D12345ORDER-001100000test-api-key-12345)
      const expected = crypto
        .createHash('md5')
        .update('D12345ORDER-001100000test-api-key-12345')
        .digest('hex');

      expect(signature).toBe(expected);
    });

    test('should generate different signatures for different amounts', () => {
      const merchantOrderId = 'ORDER-001';
      const signature1 = provider.generateSignature(merchantOrderId, 100000);
      const signature2 = provider.generateSignature(merchantOrderId, 200000);

      expect(signature1).not.toBe(signature2);
    });

    test('should generate different signatures for different order IDs', () => {
      const amount = 100000;
      const signature1 = provider.generateSignature('ORDER-001', amount);
      const signature2 = provider.generateSignature('ORDER-002', amount);

      expect(signature1).not.toBe(signature2);
    });

    test('should generate consistent signatures for same input', () => {
      const merchantOrderId = 'ORDER-001';
      const amount = 100000;

      const signature1 = provider.generateSignature(merchantOrderId, amount);
      const signature2 = provider.generateSignature(merchantOrderId, amount);

      expect(signature1).toBe(signature2);
    });
  });

  describe('verifyCallbackSignature', () => {
    test('should verify valid callback signature', () => {
      const merchantOrderId = 'ORDER-001';
      const amount = 100000;

      // Generate expected signature
      // Format: MD5(merchantCode + amount + merchantOrderId + apiKey)
      const expectedSignature = crypto
        .createHash('md5')
        .update('D12345100000ORDER-001test-api-key-12345')
        .digest('hex');

      const isValid = provider.verifyCallbackSignature(
        merchantOrderId,
        amount,
        expectedSignature
      );

      expect(isValid).toBe(true);
    });

    test('should reject invalid callback signature', () => {
      const merchantOrderId = 'ORDER-001';
      const amount = 100000;
      const invalidSignature = 'invalid-signature-12345';

      const isValid = provider.verifyCallbackSignature(
        merchantOrderId,
        amount,
        invalidSignature
      );

      expect(isValid).toBe(false);
    });

    test('should reject signature with wrong amount', () => {
      const merchantOrderId = 'ORDER-001';
      const correctAmount = 100000;
      const wrongAmount = 200000;

      // Generate signature with correct amount
      const signature = crypto
        .createHash('md5')
        .update(`D12345${correctAmount}ORDER-001test-api-key-12345`)
        .digest('hex');

      // Verify with wrong amount
      const isValid = provider.verifyCallbackSignature(
        merchantOrderId,
        wrongAmount,
        signature
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Provider Configuration', () => {
    test('should initialize with sandbox mode by default', () => {
      const sandboxProvider = new DuitkuProvider({
        merchantCode: 'D12345',
        apiKey: 'test-key'
      });

      expect(sandboxProvider.mode).toBe('sandbox');
      expect(sandboxProvider.baseURL).toContain('sandbox.duitku.com');
    });

    test('should initialize with production mode when specified', () => {
      const prodProvider = new DuitkuProvider({
        merchantCode: 'D12345',
        apiKey: 'test-key',
        mode: 'production'
      });

      expect(prodProvider.mode).toBe('production');
      expect(prodProvider.baseURL).toContain('passport.duitku.com');
    });

    test('should have correct provider name', () => {
      expect(provider.name).toBe('Duitku');
    });
  });
});

// Run tests dengan: npm test
// Atau: node --experimental-vm-modules node_modules/jest/bin/jest.js
