/**
 * UnifiedAuthController Tests
 * 
 * Tests for JWT token generation with tenant information
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../models/Tenant');
jest.mock('../../models/Employee');
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');
jest.mock('../../utils/tenantContext');

const User = require('../../models/User');
const Tenant = require('../../models/Tenant');
const Employee = require('../../models/Employee');
const { runWithTenantContext } = require('../../utils/tenantContext');
const { login, googleAuth, verifyOTP } = require('../../controllers/UnifiedAuthController');

describe('UnifiedAuthController - JWT Token Generation', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
    
    // Mock runWithTenantContext to execute the callback directly
    runWithTenantContext.mockImplementation(async (tenant, callback) => {
      return await callback();
    });
    
    // Mock Employee.findOne to return a default employee
    Employee.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'employee-123',
        email: 'test@example.com',
        role: 'admin'
      })
    });
  });

  describe('login() - User with completed setup', () => {
    it('should include tenant, tenantId, and tenantDbName in JWT token for user with tenant', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        name: 'Test User',
        authProvider: 'local',
        isVerified: true,
        hasCompletedSetup: true,
        tenantId: 'tenant-123',
        tenantSlug: 'test-cafe'
      };

      const mockTenant = {
        _id: 'tenant-123',
        name: 'Test Cafe',
        slug: 'test-cafe',
        dbName: 'superkafe_test_cafe',
        isActive: true
      };

      const mockEmployee = {
        _id: 'employee-123',
        email: 'test@example.com',
        role: 'admin',
        username: 'test'
      };

      // Mock dependencies
      User.findOne = jest.fn().mockResolvedValue(mockUser);
      Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
      Employee.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockEmployee)
      });
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      await login(req, res);

      // Verify JWT was called with correct payload including tenant info
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockEmployee._id.toString(),
          email: mockEmployee.email,
          role: mockEmployee.role,
          tenant: mockTenant.slug,
          tenantId: mockTenant._id.toString(),
          tenantDbName: mockTenant.dbName,
          userId: mockUser._id.toString()
        }),
        expect.any(String),
        expect.any(Object)
      );

      // Verify response includes token
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'mock-jwt-token'
        })
      );
    });

    it('should include basic user info in JWT token for user without tenant', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
        name: 'Test User',
        authProvider: 'local',
        isVerified: true,
        hasCompletedSetup: false,
        tenantId: null,
        tenantSlug: null
      };

      // Mock dependencies
      User.findOne = jest.fn().mockResolvedValue(mockUser);
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      await login(req, res);

      // Verify JWT was called with basic payload (no tenant info)
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser._id,
          email: mockUser.email,
          hasCompletedSetup: false,
          tenantSlug: null
        }),
        expect.any(String),
        expect.any(Object)
      );

      // Should NOT include tenant, tenantId, or tenantDbName
      expect(jwt.sign.mock.calls[0][0]).not.toHaveProperty('tenant');
      expect(jwt.sign.mock.calls[0][0]).not.toHaveProperty('tenantId');
      expect(jwt.sign.mock.calls[0][0]).not.toHaveProperty('tenantDbName');
    });
  });

  describe('googleAuth() - User with completed setup', () => {
    it('should include tenant info in JWT token for Google user with tenant', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        googleId: 'google-123',
        authProvider: 'google',
        isVerified: true,
        hasCompletedSetup: true,
        tenantId: 'tenant-123',
        tenantSlug: 'test-cafe',
        save: jest.fn().mockResolvedValue(true)
      };

      const mockTenant = {
        _id: 'tenant-123',
        name: 'Test Cafe',
        slug: 'test-cafe',
        dbName: 'superkafe_test_cafe',
        isActive: true
      };

      const mockEmployee = {
        _id: 'employee-123',
        email: 'test@example.com',
        role: 'admin'
      };

      const mockTenantDB = {
        model: jest.fn().mockImplementation(() => ({
          findOne: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockEmployee)
          })
        }))
      };

      // Mock dependencies
      User.findOne = jest.fn().mockResolvedValue(mockUser);
      Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
      Employee.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockEmployee) });
      jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

      req.body = {
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        idToken: 'google-token'
      };

      await googleAuth(req, res);

      // Verify JWT includes tenant info
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockEmployee._id.toString(),
          email: mockEmployee.email,
          role: mockEmployee.role,
          tenant: mockTenant.slug,
          tenantId: mockTenant._id.toString(),
          tenantDbName: mockTenant.dbName,
          userId: mockUser._id.toString()
        }),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('verifyOTP() - User with completed setup', () => {
    it('should include tenant info in JWT token after OTP verification for user with tenant', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        authProvider: 'local',
        isVerified: false,
        otpCode: '123456',
        otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
        hasCompletedSetup: true,
        tenantId: 'tenant-123',
        tenantSlug: 'test-cafe',
        save: jest.fn().mockResolvedValue(true)
      };

      const mockTenant = {
        _id: 'tenant-123',
        name: 'Test Cafe',
        slug: 'test-cafe',
        dbName: 'superkafe_test_cafe',
        isActive: true
      };

      const mockEmployee = {
        _id: 'employee-123',
        email: 'test@example.com',
        role: 'admin'
      };

      const mockTenantDB = {
        model: jest.fn().mockImplementation(() => ({
          findOne: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockEmployee)
          })
        }))
      };

      // Mock dependencies
      User.findOne = jest.fn().mockResolvedValue(mockUser);
      Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
      Employee.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockEmployee) });
      jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

      req.body = {
        email: 'test@example.com',
        otpCode: '123456'
      };

      await verifyOTP(req, res);

      // Verify JWT includes tenant info
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockEmployee._id.toString(),
          email: mockEmployee.email,
          role: mockEmployee.role,
          tenant: mockTenant.slug,
          tenantId: mockTenant._id.toString(),
          tenantDbName: mockTenant.dbName,
          userId: mockUser._id.toString()
        }),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('Theme Data in Auth Responses', () => {
    describe('login() - Theme data inclusion', () => {
      it('should include selectedTheme field in login response for user with tenant', async () => {
        const mockUser = {
          _id: 'user-123',
          email: 'test@example.com',
          password: 'hashed-password',
          name: 'Test User',
          authProvider: 'local',
          isVerified: true,
          hasCompletedSetup: true,
          tenantId: 'tenant-123',
          tenantSlug: 'test-cafe'
        };

        const mockTenant = {
          _id: 'tenant-123',
          name: 'Test Cafe',
          slug: 'test-cafe',
          dbName: 'superkafe_test_cafe',
          isActive: true,
          selectedTheme: 'light-coffee',
          hasSeenThemePopup: true
        };

        const mockEmployee = {
          _id: 'employee-123',
          email: 'test@example.com',
          role: 'admin',
          username: 'test'
        };

        const mockTenantDB = {
          model: jest.fn().mockImplementation(() => ({
            findOne: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockEmployee)
            })
          }))
        };

        User.findOne = jest.fn().mockResolvedValue(mockUser);
        Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
        Employee.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockEmployee) });
        bcrypt.compare = jest.fn().mockResolvedValue(true);
        jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

        req.body = {
          email: 'test@example.com',
          password: 'password123'
        };

        await login(req, res);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            tenant: expect.objectContaining({
              selectedTheme: 'light-coffee'
            })
          })
        );
      });

      it('should include hasSeenThemePopup field in login response for user with tenant', async () => {
        const mockUser = {
          _id: 'user-123',
          email: 'test@example.com',
          password: 'hashed-password',
          name: 'Test User',
          authProvider: 'local',
          isVerified: true,
          hasCompletedSetup: true,
          tenantId: 'tenant-123',
          tenantSlug: 'test-cafe'
        };

        const mockTenant = {
          _id: 'tenant-123',
          name: 'Test Cafe',
          slug: 'test-cafe',
          dbName: 'superkafe_test_cafe',
          isActive: true,
          selectedTheme: 'default',
          hasSeenThemePopup: false
        };

        const mockEmployee = {
          _id: 'employee-123',
          email: 'test@example.com',
          role: 'admin',
          username: 'test'
        };

        const mockTenantDB = {
          model: jest.fn().mockImplementation(() => ({
            findOne: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockEmployee)
            })
          }))
        };

        User.findOne = jest.fn().mockResolvedValue(mockUser);
        Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
        Employee.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockEmployee) });
        bcrypt.compare = jest.fn().mockResolvedValue(true);
        jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

        req.body = {
          email: 'test@example.com',
          password: 'password123'
        };

        await login(req, res);

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
          authProvider: 'local',
          isVerified: true,
          hasCompletedSetup: true,
          tenantId: 'tenant-123',
          tenantSlug: 'test-cafe'
        };

        const mockTenant = {
          _id: 'tenant-123',
          name: 'Test Cafe',
          slug: 'test-cafe',
          dbName: 'superkafe_test_cafe',
          isActive: true,
          selectedTheme: 'light-coffee',
          hasSeenThemePopup: true
        };

        const mockEmployee = {
          _id: 'employee-123',
          email: 'test@example.com',
          role: 'admin',
          username: 'test'
        };

        const mockTenantDB = {
          model: jest.fn().mockImplementation(() => ({
            findOne: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockEmployee)
            })
          }))
        };

        User.findOne = jest.fn().mockResolvedValue(mockUser);
        Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
        Employee.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockEmployee) });
        bcrypt.compare = jest.fn().mockResolvedValue(true);
        jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

        req.body = {
          email: 'test@example.com',
          password: 'password123'
        };

        await login(req, res);

        // Verify Tenant.findById was called to fetch theme data
        expect(Tenant.findById).toHaveBeenCalledWith('tenant-123');

        // Verify response includes correct theme values from database
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            tenant: expect.objectContaining({
              id: mockTenant._id,
              name: mockTenant.name,
              slug: mockTenant.slug,
              selectedTheme: 'light-coffee',
              hasSeenThemePopup: true
            })
          })
        );
      });
    });

    describe('googleAuth() - Theme data inclusion', () => {
      it('should include selectedTheme field in Google auth response for user with tenant', async () => {
        const mockUser = {
          _id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          googleId: 'google-123',
          authProvider: 'google',
          isVerified: true,
          hasCompletedSetup: true,
          tenantId: 'tenant-123',
          tenantSlug: 'test-cafe',
          save: jest.fn().mockResolvedValue(true)
        };

        const mockTenant = {
          _id: 'tenant-123',
          name: 'Test Cafe',
          slug: 'test-cafe',
          dbName: 'superkafe_test_cafe',
          isActive: true,
          selectedTheme: 'default',
          hasSeenThemePopup: false
        };

        const mockEmployee = {
          _id: 'employee-123',
          email: 'test@example.com',
          role: 'admin'
        };

        const mockTenantDB = {
          model: jest.fn().mockImplementation(() => ({
            findOne: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockEmployee)
            })
          }))
        };

        User.findOne = jest.fn().mockResolvedValue(mockUser);
        Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
        Employee.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockEmployee) });
        jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

        req.body = {
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/photo.jpg',
          idToken: 'google-token'
        };

        await googleAuth(req, res);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            tenant: expect.objectContaining({
              selectedTheme: 'default'
            })
          })
        );
      });

      it('should include hasSeenThemePopup field in Google auth response for user with tenant', async () => {
        const mockUser = {
          _id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          googleId: 'google-123',
          authProvider: 'google',
          isVerified: true,
          hasCompletedSetup: true,
          tenantId: 'tenant-123',
          tenantSlug: 'test-cafe',
          save: jest.fn().mockResolvedValue(true)
        };

        const mockTenant = {
          _id: 'tenant-123',
          name: 'Test Cafe',
          slug: 'test-cafe',
          dbName: 'superkafe_test_cafe',
          isActive: true,
          selectedTheme: 'light-coffee',
          hasSeenThemePopup: true
        };

        const mockEmployee = {
          _id: 'employee-123',
          email: 'test@example.com',
          role: 'admin'
        };

        const mockTenantDB = {
          model: jest.fn().mockImplementation(() => ({
            findOne: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockEmployee)
            })
          }))
        };

        User.findOne = jest.fn().mockResolvedValue(mockUser);
        Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
        Employee.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockEmployee) });
        jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

        req.body = {
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/photo.jpg',
          idToken: 'google-token'
        };

        await googleAuth(req, res);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            tenant: expect.objectContaining({
              hasSeenThemePopup: true
            })
          })
        );
      });
    });

    describe('verifyOTP() - Theme data inclusion', () => {
      it('should include selectedTheme field in OTP verification response for user with tenant', async () => {
        const mockUser = {
          _id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          authProvider: 'local',
          isVerified: false,
          otpCode: '123456',
          otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
          hasCompletedSetup: true,
          tenantId: 'tenant-123',
          tenantSlug: 'test-cafe',
          save: jest.fn().mockResolvedValue(true)
        };

        const mockTenant = {
          _id: 'tenant-123',
          name: 'Test Cafe',
          slug: 'test-cafe',
          dbName: 'superkafe_test_cafe',
          isActive: true,
          selectedTheme: 'light-coffee',
          hasSeenThemePopup: false
        };

        const mockEmployee = {
          _id: 'employee-123',
          email: 'test@example.com',
          role: 'admin'
        };

        const mockTenantDB = {
          model: jest.fn().mockImplementation(() => ({
            findOne: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockEmployee)
            })
          }))
        };

        User.findOne = jest.fn().mockResolvedValue(mockUser);
        Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
        Employee.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockEmployee) });
        jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

        req.body = {
          email: 'test@example.com',
          otpCode: '123456'
        };

        await verifyOTP(req, res);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            tenant: expect.objectContaining({
              selectedTheme: 'light-coffee'
            })
          })
        );
      });

      it('should include hasSeenThemePopup field in OTP verification response for user with tenant', async () => {
        const mockUser = {
          _id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          authProvider: 'local',
          isVerified: false,
          otpCode: '123456',
          otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
          hasCompletedSetup: true,
          tenantId: 'tenant-123',
          tenantSlug: 'test-cafe',
          save: jest.fn().mockResolvedValue(true)
        };

        const mockTenant = {
          _id: 'tenant-123',
          name: 'Test Cafe',
          slug: 'test-cafe',
          dbName: 'superkafe_test_cafe',
          isActive: true,
          selectedTheme: 'default',
          hasSeenThemePopup: true
        };

        const mockEmployee = {
          _id: 'employee-123',
          email: 'test@example.com',
          role: 'admin'
        };

        const mockTenantDB = {
          model: jest.fn().mockImplementation(() => ({
            findOne: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockEmployee)
            })
          }))
        };

        User.findOne = jest.fn().mockResolvedValue(mockUser);
        Tenant.findById = jest.fn().mockResolvedValue(mockTenant);
        Employee.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockEmployee) });
        jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');

        req.body = {
          email: 'test@example.com',
          otpCode: '123456'
        };

        await verifyOTP(req, res);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            tenant: expect.objectContaining({
              hasSeenThemePopup: true
            })
          })
        );
      });
    });
  });
});


