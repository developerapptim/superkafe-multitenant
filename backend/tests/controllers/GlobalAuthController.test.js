/**
 * GlobalAuthController Tests
 * 
 * Tests for global login authentication with theme data
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../models/Tenant');
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');

const User = require('../../models/User');
const Tenant = require('../../models/Tenant');
const { globalLogin } = require('../../controllers/GlobalAuthController');

describe('GlobalAuthController - Theme Data in Auth Responses', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('globalLogin() - Theme data inclusion', () => {
    it('should include selectedTheme field in global login response', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        name: 'Test User',
        role: 'admin',
        tenantId: 'tenant-123'
      };

      const mockTenant = {
        _id: 'tenant-123',
        slug: 'test-cafe',
        businessName: 'Test Cafe',
        selectedTheme: 'light-coffee',
        hasSeenThemePopup: true
      };

      User.findOne = jest.fn().mockResolvedValue(mockUser);
      Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      await globalLogin(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          tenant: expect.objectContaining({
            selectedTheme: 'light-coffee'
          })
        })
      );
    });

    it('should include hasSeenThemePopup field in global login response', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        name: 'Test User',
        role: 'admin',
        tenantId: 'tenant-123'
      };

      const mockTenant = {
        _id: 'tenant-123',
        slug: 'test-cafe',
        businessName: 'Test Cafe',
        selectedTheme: 'default',
        hasSeenThemePopup: false
      };

      User.findOne = jest.fn().mockResolvedValue(mockUser);
      Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      await globalLogin(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          tenant: expect.objectContaining({
            hasSeenThemePopup: false
          })
        })
      );
    });

    it('should correctly populate theme values from database', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        name: 'Test User',
        role: 'admin',
        tenantId: 'tenant-123'
      };

      const mockTenant = {
        _id: 'tenant-123',
        slug: 'test-cafe',
        businessName: 'Test Cafe',
        selectedTheme: 'light-coffee',
        hasSeenThemePopup: true
      };

      User.findOne = jest.fn().mockResolvedValue(mockUser);
      Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      await globalLogin(req, res);

      // Verify Tenant.findById was called to fetch theme data
      expect(Tenant.findById).toHaveBeenCalledWith('tenant-123');

      // Verify response includes correct theme values from database
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          tenant: expect.objectContaining({
            id: mockTenant._id,
            slug: mockTenant.slug,
            name: mockTenant.businessName,
            selectedTheme: 'light-coffee',
            hasSeenThemePopup: true
          })
        })
      );
    });

    it('should handle missing tenant gracefully', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        name: 'Test User',
        role: 'admin',
        tenantId: 'tenant-123'
      };

      User.findOne = jest.fn().mockResolvedValue(mockUser);
      Tenant.findById = jest.fn().mockResolvedValue(null);
      bcrypt.compare = jest.fn().mockResolvedValue(true);

      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      await globalLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Tenant tidak ditemukan'
        })
      );
    });
  });
});
