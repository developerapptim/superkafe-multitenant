/**
 * TenantController Validation Unit Tests
 * 
 * Tests for TenantController.registerTenant() validation to ensure:
 * - Reserved keywords are rejected
 * - Invalid format is rejected
 * - Valid slugs are accepted
 * 
 * Validates Requirements: 2.1, 3.1
 */

const { registerTenant } = require('../../controllers/TenantController');
const Tenant = require('../../models/Tenant');
const { validateSlug } = require('../../utils/slugValidator');

// Mock dependencies
jest.mock('../../models/Tenant');
jest.mock('../../config/db');
jest.mock('../../utils/slugValidator');

describe('TenantController - registerTenant Validation', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup request and response objects
    req = {
      body: {},
      ip: '127.0.0.1'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Mock console methods to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
  });

  // ============================================================================
  // Reserved Keywords Rejection Tests (Requirement 2.1)
  // ============================================================================

  describe('Reserved Keywords Rejection', () => {
    test('should reject "setup-cafe" as reserved keyword', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'setup-cafe',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: "Slug 'setup-cafe' tidak dapat digunakan karena merupakan kata yang direservasi sistem"
      });

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('direservasi sistem')
      });
      expect(Tenant.findOne).not.toHaveBeenCalled();
    });

    test('should reject "admin" as reserved keyword', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'admin',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: "Slug 'admin' tidak dapat digunakan karena merupakan kata yang direservasi sistem"
      });

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('direservasi sistem')
      });
    });

    test('should reject "dashboard" as reserved keyword', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'dashboard',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: "Slug 'dashboard' tidak dapat digunakan karena merupakan kata yang direservasi sistem"
      });

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('direservasi sistem')
      });
    });

    test('should reject "auth" as reserved keyword', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'auth',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: "Slug 'auth' tidak dapat digunakan karena merupakan kata yang direservasi sistem"
      });

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('direservasi sistem')
      });
    });

    test('should reject "api" as reserved keyword', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'api',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: "Slug 'api' tidak dapat digunakan karena merupakan kata yang direservasi sistem"
      });

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('direservasi sistem')
      });
    });

    test('should call validateSlug before checking database', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'admin',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: "Slug 'admin' tidak dapat digunakan karena merupakan kata yang direservasi sistem"
      });

      await registerTenant(req, res);

      expect(validateSlug).toHaveBeenCalledWith('admin');
      expect(Tenant.findOne).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Invalid Format Rejection Tests (Requirement 3.1)
  // ============================================================================

  describe('Invalid Format Rejection', () => {
    test('should reject slug with spaces', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'my cafe',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: 'Slug hanya boleh mengandung huruf kecil, angka, dan tanda hubung (-)'
      });

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('huruf kecil')
      });
    });

    test('should reject slug with special characters', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'my@cafe',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: 'Slug hanya boleh mengandung huruf kecil, angka, dan tanda hubung (-)'
      });

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('huruf kecil')
      });
    });

    test('should reject slug shorter than 3 characters', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'ab',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: 'Slug minimal 3 karakter'
      });

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Slug minimal 3 karakter'
      });
    });

    test('should reject slug longer than 50 characters', async () => {
      const longSlug = 'a'.repeat(51);
      req.body = {
        name: 'Test Cafe',
        slug: longSlug,
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: 'Slug maksimal 50 karakter'
      });

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Slug maksimal 50 karakter'
      });
    });

    test('should reject slug starting with hyphen', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: '-mycafe',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: 'Slug tidak boleh diawali atau diakhiri dengan tanda hubung'
      });

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('tidak boleh diawali atau diakhiri')
      });
    });

    test('should reject slug ending with hyphen', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'mycafe-',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: 'Slug tidak boleh diawali atau diakhiri dengan tanda hubung'
      });

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('tidak boleh diawali atau diakhiri')
      });
    });

    test('should reject empty slug', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: '',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Nama dan slug wajib diisi'
      });
    });
  });

  // ============================================================================
  // Valid Slug Acceptance Tests (Requirements 2.1, 3.1)
  // ============================================================================

  describe('Valid Slug Acceptance', () => {
    test('should accept valid slug with lowercase letters and hyphens', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'my-cafe',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: true,
        error: null
      });

      Tenant.findOne.mockResolvedValue(null);

      await registerTenant(req, res);

      expect(validateSlug).toHaveBeenCalledWith('my-cafe');
      expect(Tenant.findOne).toHaveBeenCalledWith({ slug: 'my-cafe' });
    });

    test('should accept valid slug with numbers', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'cafe123',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: true,
        error: null
      });

      Tenant.findOne.mockResolvedValue(null);

      await registerTenant(req, res);

      expect(validateSlug).toHaveBeenCalledWith('cafe123');
      expect(Tenant.findOne).toHaveBeenCalled();
    });

    test('should accept valid slug with mixed lowercase, numbers, and hyphens', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'my-cafe-123',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: true,
        error: null
      });

      Tenant.findOne.mockResolvedValue(null);

      await registerTenant(req, res);

      expect(validateSlug).toHaveBeenCalledWith('my-cafe-123');
      expect(Tenant.findOne).toHaveBeenCalled();
    });

    test('should proceed to database check only after slug validation passes', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'valid-cafe',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: true,
        error: null
      });

      Tenant.findOne.mockResolvedValue(null);

      await registerTenant(req, res);

      // Verify validateSlug was called with the slug
      expect(validateSlug).toHaveBeenCalledWith('valid-cafe');
      // Verify database check was performed after validation passed
      expect(Tenant.findOne).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle missing name field', async () => {
      req.body = {
        slug: 'my-cafe',
        email: 'test@example.com',
        password: 'password123'
      };

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Nama dan slug wajib diisi'
      });
      expect(validateSlug).not.toHaveBeenCalled();
    });

    test('should handle missing slug field', async () => {
      req.body = {
        name: 'Test Cafe',
        email: 'test@example.com',
        password: 'password123'
      };

      await registerTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Nama dan slug wajib diisi'
      });
      expect(validateSlug).not.toHaveBeenCalled();
    });

    test('should validate slug before checking if slug exists in database', async () => {
      req.body = {
        name: 'Test Cafe',
        slug: 'admin',
        email: 'test@example.com',
        password: 'password123',
        adminName: 'Admin'
      };

      validateSlug.mockReturnValue({
        valid: false,
        error: "Slug 'admin' tidak dapat digunakan karena merupakan kata yang direservasi sistem"
      });

      await registerTenant(req, res);

      expect(validateSlug).toHaveBeenCalled();
      expect(Tenant.findOne).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
