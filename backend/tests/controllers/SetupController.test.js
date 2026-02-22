/**
 * SetupController Tests
 * 
 * Tests for slug validation integration in SetupController
 */

const { validateSlug } = require('../../utils/slugValidator');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../models/Tenant');
jest.mock('../../config/db');
jest.mock('jsonwebtoken');

const User = require('../../models/User');
const Tenant = require('../../models/Tenant');
const { setupTenant, checkSlug } = require('../../controllers/SetupController');

describe('SetupController - Slug Validation Integration', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: { userId: 'test-user-id' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('setupTenant()', () => {
    it('should reject reserved keyword slugs', async () => {
      req.body = {
        cafeName: 'Test Cafe',
        slug: 'admin',
        adminName: 'Admin User'
      };

      await setupTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('direservasi sistem')
      });
    });

    it('should reject invalid format slugs', async () => {
      req.body = {
        cafeName: 'Test Cafe',
        slug: 'Invalid_Slug!',
        adminName: 'Admin User'
      };

      await setupTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('huruf kecil, angka, dan tanda hubung')
      });
    });

    it('should reject slugs that are too short', async () => {
      req.body = {
        cafeName: 'Test Cafe',
        slug: 'ab',
        adminName: 'Admin User'
      };

      await setupTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Slug minimal 3 karakter'
      });
    });

    it('should reject slugs starting with hyphen', async () => {
      req.body = {
        cafeName: 'Test Cafe',
        slug: '-invalid',
        adminName: 'Admin User'
      };

      await setupTenant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('tidak boleh diawali atau diakhiri')
      });
    });

    it('should accept valid slug and proceed to user lookup', async () => {
      req.body = {
        cafeName: 'Test Cafe',
        slug: 'valid-slug-123',
        adminName: 'Admin User'
      };

      // Mock User.findById to return null (will fail at user lookup, but slug validation passed)
      User.findById = jest.fn().mockResolvedValue(null);

      await setupTenant(req, res);

      // Should pass slug validation and reach user lookup
      expect(User.findById).toHaveBeenCalledWith('test-user-id');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User tidak ditemukan'
      });
    });
  });

  describe('checkSlug()', () => {
    it('should return unavailable for reserved keyword slugs', async () => {
      req.params = { slug: 'setup-cafe' };

      await checkSlug(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        available: false,
        message: expect.stringContaining('direservasi sistem')
      });
    });

    it('should return unavailable for invalid format slugs', async () => {
      req.params = { slug: 'Invalid_Slug!' };

      await checkSlug(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        available: false,
        message: expect.stringContaining('huruf kecil, angka, dan tanda hubung')
      });
    });

    it('should return unavailable for slugs that are too short', async () => {
      req.params = { slug: 'ab' };

      await checkSlug(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        available: false,
        message: 'Slug minimal 3 karakter'
      });
    });

    it('should check database for valid slugs', async () => {
      req.params = { slug: 'valid-slug' };

      // Mock Tenant.findOne to return null (slug available)
      Tenant.findOne = jest.fn().mockResolvedValue(null);

      await checkSlug(req, res);

      expect(Tenant.findOne).toHaveBeenCalledWith({ slug: 'valid-slug' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        available: true,
        message: 'Slug tersedia'
      });
    });

    it('should return unavailable if slug exists in database', async () => {
      req.params = { slug: 'existing-slug' };

      // Mock Tenant.findOne to return a tenant
      Tenant.findOne = jest.fn().mockResolvedValue({ slug: 'existing-slug' });

      await checkSlug(req, res);

      expect(Tenant.findOne).toHaveBeenCalledWith({ slug: 'existing-slug' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        available: false,
        message: 'Slug sudah digunakan'
      });
    });
  });

  describe('Reserved Keywords Coverage', () => {
    const RESERVED_KEYWORDS = [
      'setup-cafe',
      'admin',
      'dashboard',
      'auth',
      'api',
      'login',
      'register',
      'logout'
    ];

    it.each(RESERVED_KEYWORDS)('should reject reserved keyword: %s', async (keyword) => {
      req.params = { slug: keyword };

      await checkSlug(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        available: false,
        message: expect.stringContaining('direservasi sistem')
      });
    });
  });
});
