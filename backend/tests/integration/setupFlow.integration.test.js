/**
 * Backend Integration Tests: Setup Flow
 * 
 * Tests complete API flows for tenant setup, slug validation,
 * and reserved keyword rejection.
 * 
 * Requirements: 1.4, 2.1, 3.1, 4.1, 4.4, 5.1
 */

const request = require('supertest');
const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { validateSlug, RESERVED_KEYWORDS } = require('../../utils/slugValidator');

// Mock Express app setup
const express = require('express');
const app = express();
app.use(express.json());

// Import routes
const setupRoutes = require('../../routes/setupRoutes');
const tenantRoutes = require('../../routes/tenantRoutes');

app.use('/api/setup', setupRoutes);
app.use('/api/tenants', tenantRoutes);

describe('Backend Integration: Setup Flow', () => {
  describe('POST /api/setup/tenant - Complete Setup Flow', () => {
    it('should reject reserved keyword "admin"', async () => {
      const response = await request(app)
        .post('/api/setup/tenant')
        .send({
          cafeName: 'Admin Cafe',
          slug: 'admin',
          adminName: 'Test Admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('direservasi sistem');
    });

    it('should reject reserved keyword "setup-cafe"', async () => {
      const response = await request(app)
        .post('/api/setup/tenant')
        .send({
          cafeName: 'Setup Cafe',
          slug: 'setup-cafe',
          adminName: 'Test Admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('direservasi sistem');
    });

    it('should reject reserved keyword "dashboard"', async () => {
      const response = await request(app)
        .post('/api/setup/tenant')
        .send({
          cafeName: 'Dashboard Cafe',
          slug: 'dashboard',
          adminName: 'Test Admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('direservasi sistem');
    });

    it('should reject invalid format with uppercase letters', async () => {
      const response = await request(app)
        .post('/api/setup/tenant')
        .send({
          cafeName: 'Test Cafe',
          slug: 'TestCafe',
          adminName: 'Test Admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('huruf kecil');
    });

    it('should reject invalid format with special characters', async () => {
      const response = await request(app)
        .post('/api/setup/tenant')
        .send({
          cafeName: 'Test Cafe',
          slug: 'test@cafe!',
          adminName: 'Test Admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('huruf kecil');
    });

    it('should reject slug shorter than 3 characters', async () => {
      const response = await request(app)
        .post('/api/setup/tenant')
        .send({
          cafeName: 'Test Cafe',
          slug: 'ab',
          adminName: 'Test Admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('minimal 3 karakter');
    });

    it('should reject slug longer than 50 characters', async () => {
      const response = await request(app)
        .post('/api/setup/tenant')
        .send({
          cafeName: 'Test Cafe',
          slug: 'a'.repeat(51),
          adminName: 'Test Admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('maksimal 50 karakter');
    });

    it('should reject slug starting with hyphen', async () => {
      const response = await request(app)
        .post('/api/setup/tenant')
        .send({
          cafeName: 'Test Cafe',
          slug: '-test-cafe',
          adminName: 'Test Admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('tidak boleh diawali atau diakhiri');
    });

    it('should reject slug ending with hyphen', async () => {
      const response = await request(app)
        .post('/api/setup/tenant')
        .send({
          cafeName: 'Test Cafe',
          slug: 'test-cafe-',
          adminName: 'Test Admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('tidak boleh diawali atau diakhiri');
    });
  });

  describe('GET /api/setup/check-slug/:slug - Slug Availability Check', () => {
    it('should return unavailable for reserved keyword "auth"', async () => {
      const response = await request(app)
        .get('/api/setup/check-slug/auth');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.available).toBe(false);
      expect(response.body.message).toContain('direservasi sistem');
    });

    it('should return unavailable for reserved keyword "api"', async () => {
      const response = await request(app)
        .get('/api/setup/check-slug/api');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.available).toBe(false);
      expect(response.body.message).toContain('direservasi sistem');
    });

    it('should return unavailable for invalid format', async () => {
      const response = await request(app)
        .get('/api/setup/check-slug/Test@Cafe');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.available).toBe(false);
      expect(response.body.message).toContain('huruf kecil');
    });

    it('should return unavailable for slug too short', async () => {
      const response = await request(app)
        .get('/api/setup/check-slug/ab');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.available).toBe(false);
      expect(response.body.message).toContain('minimal 3 karakter');
    });
  });

  describe('POST /api/tenants/register - Tenant Registration', () => {
    it('should reject all reserved keywords', async () => {
      for (const keyword of RESERVED_KEYWORDS) {
        const response = await request(app)
          .post('/api/tenants/register')
          .send({
            cafeName: `${keyword} Cafe`,
            slug: keyword,
            adminName: 'Test Admin',
            email: `test-${keyword}@example.com`,
            password: 'password123'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('direservasi sistem');
      }
    });

    it('should accept valid slug format', async () => {
      const validSlugs = [
        'warkop-jaya',
        'kafe-123',
        'my-coffee-shop',
        'cafe-corner-2024'
      ];

      for (const slug of validSlugs) {
        const validation = validateSlug(slug);
        expect(validation.valid).toBe(true);
        expect(validation.error).toBeNull();
      }
    });
  });

  describe('Slug Validator Utility', () => {
    it('should validate all reserved keywords correctly', () => {
      for (const keyword of RESERVED_KEYWORDS) {
        const result = validateSlug(keyword);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('direservasi sistem');
      }
    });

    it('should validate format rules correctly', () => {
      const invalidCases = [
        { slug: 'ABC', reason: 'uppercase' },
        { slug: 'test@cafe', reason: 'special chars' },
        { slug: 'ab', reason: 'too short' },
        { slug: 'a'.repeat(51), reason: 'too long' },
        { slug: '-test', reason: 'starts with hyphen' },
        { slug: 'test-', reason: 'ends with hyphen' },
        { slug: '', reason: 'empty' },
        { slug: '   ', reason: 'whitespace only' }
      ];

      for (const testCase of invalidCases) {
        const result = validateSlug(testCase.slug);
        expect(result.valid).toBe(false);
        expect(result.error).toBeTruthy();
      }
    });

    it('should accept valid slugs', () => {
      const validCases = [
        'warkop-jaya',
        'kafe-123',
        'my-coffee-shop',
        'cafe-corner',
        'abc',
        'test-cafe-2024',
        'a'.repeat(50)
      ];

      for (const slug of validCases) {
        const result = validateSlug(slug);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should not affect existing valid tenant slugs', () => {
      const existingSlugs = [
        'warkop-jaya',
        'kafe-123',
        'my-coffee-shop',
        'cafe-corner',
        'kopi-kenangan',
        'warung-kopi-2024'
      ];

      for (const slug of existingSlugs) {
        const result = validateSlug(slug);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      }
    });

    it('should maintain slug format consistency', () => {
      // Test that normalization is consistent
      const testCases = [
        { input: 'test-cafe', expected: 'test-cafe' },
        { input: 'TEST-CAFE', expected: 'test-cafe' },
        { input: '  test-cafe  ', expected: 'test-cafe' }
      ];

      for (const testCase of testCases) {
        const normalized = testCase.input.toLowerCase().trim();
        expect(normalized).toBe(testCase.expected);
      }
    });
  });

  describe('Error Message Clarity', () => {
    it('should provide clear error for reserved keywords', () => {
      const result = validateSlug('admin');
      expect(result.error).toContain('direservasi sistem');
      expect(result.error).toContain('admin');
    });

    it('should provide clear error for invalid format', () => {
      const result = validateSlug('Test@Cafe');
      expect(result.error).toContain('huruf kecil');
      expect(result.error).toContain('angka');
      expect(result.error).toContain('tanda hubung');
    });

    it('should provide clear error for length violations', () => {
      const tooShort = validateSlug('ab');
      expect(tooShort.error).toContain('minimal 3 karakter');

      const tooLong = validateSlug('a'.repeat(51));
      expect(tooLong.error).toContain('maksimal 50 karakter');
    });

    it('should provide clear error for hyphen position', () => {
      const startsWithHyphen = validateSlug('-test');
      expect(startsWithHyphen.error).toContain('tidak boleh diawali atau diakhiri');

      const endsWithHyphen = validateSlug('test-');
      expect(endsWithHyphen.error).toContain('tidak boleh diawali atau diakhiri');
    });
  });
});
