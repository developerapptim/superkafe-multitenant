/**
 * SetupController Tests
 * 
 * Tests for slug validation integration in SetupController
 */

const { validateSlug } = require('../../utils/slugValidator');
const jwt = require('jsonwebtoken');

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

  describe('JWT Token Generation', () => {
    it('should include tenant, tenantId, and tenantDbName in JWT token after successful setup', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        name: 'Test User',
        hasCompletedSetup: false,
        tenantId: null,
        tenantSlug: null,
        save: jest.fn().mockResolvedValue(true)
      };

      const mockTenant = {
        _id: 'tenant-123',
        name: 'Test Cafe',
        slug: 'test-cafe',
        dbName: 'superkafe_test_cafe',
        isActive: true,
        status: 'trial',
        trialExpiresAt: new Date()
      };

      const mockEmployee = {
        _id: 'employee-123',
        id: 'employee-123',
        email: 'test@example.com',
        role: 'admin',
        username: 'test',
        name: 'Test User'
      };

      const mockTenantDB = {
        model: jest.fn().mockImplementation((name, schema) => {
          if (name === 'Setting') {
            return {
              insertMany: jest.fn().mockResolvedValue([])
            };
          }
          if (name === 'Employee') {
            return {
              findOne: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockEmployee)
              })
            };
          }
          return {};
        })
      };

      // Mock dependencies
      User.findById = jest.fn().mockResolvedValue(mockUser);
      Tenant.findOne = jest.fn().mockResolvedValue(null);
      Tenant.create = jest.fn().mockResolvedValue(mockTenant);
      
      const { getTenantDB } = require('../../config/db');
      getTenantDB.mockResolvedValue(mockTenantDB);

      // Mock seedAdminUser
      jest.mock('../../utils/seedAdminUser', () => ({
        seedAdminUser: jest.fn().mockResolvedValue(true)
      }));

      // Mock JWT sign
      jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

      req.body = {
        cafeName: 'Test Cafe',
        slug: 'test-cafe',
        adminName: 'Test Admin'
      };

      await setupTenant(req, res);

      // Verify JWT was called with correct payload including tenant info
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockEmployee.id,
          email: mockEmployee.email,
          role: mockEmployee.role,
          tenant: mockTenant.slug,
          tenantId: mockTenant._id.toString(),
          tenantDbName: mockTenant.dbName,
          userId: mockUser._id
        }),
        expect.any(String),
        expect.any(Object)
      );

      // Verify response includes token
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'mock-jwt-token'
        })
      );
    });
  });
});
