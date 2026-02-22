const fc = require('fast-check');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Tenant = require('../../models/Tenant');
const { getTenantDB } = require('../../config/db');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../models/Tenant');
jest.mock('../../config/db');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../services/emailService', () => ({
  generateOTP: jest.fn(() => '123456'),
  sendOTPEmail: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../utils/seedAdminUser', () => ({
  seedAdminUser: jest.fn().mockResolvedValue(true)
}));

// Import controllers AFTER mocking dependencies
const { setupTenant } = require('../../controllers/SetupController');
const { login, googleAuth, verifyOTP } = require('../../controllers/UnifiedAuthController');

/**
 * Property-Based Tests for JWT Tenant Information
 * Feature: tenant-data-isolation
 * 
 * These tests verify that JWT tokens contain tenant information
 * across various authentication scenarios.
 */
describe('JWT Tenant Information - Property-Based Tests', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup request and response objects
    req = {
      body: {},
      user: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Mock jwt.sign to capture payload
    jwt.sign.mockImplementation((payload, secret, options) => {
      return `mock.jwt.token.${JSON.stringify(payload)}`;
    });
  });

  /**
   * Property 15: JWT Contains Tenant Information
   * **Validates: Requirements 3.1**
   * 
   * For any successful login or setup completion, the generated JWT token
   * should contain both tenantSlug and tenantId fields in its payload.
   */
  describe('Property 15: JWT Contains Tenant Information', () => {
    describe('Setup Tenant Flow', () => {
      it('should include tenant info in JWT for any valid tenant setup', async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate arbitrary tenant data with valid format
            fc.record({
              cafeName: fc.string({ minLength: 3, maxLength: 100 }).filter(s => s.trim().length >= 3),
              slug: fc.string({ minLength: 5, maxLength: 20 })
                .map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
                .filter(s => s.length >= 5)
                .filter(s => !['setup', 'admin', 'dashboard', 'auth', 'api', 'login', 'register', 'logout'].includes(s)),
              adminName: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length >= 2),
              email: fc.emailAddress()
            }),
            async (testData) => {
              // Arrange
              const userId = '507f1f77bcf86cd799439011';
              const tenantId = '507f1f77bcf86cd799439012';
              const employeeId = '507f1f77bcf86cd799439013';
              const dbName = `superkafe_${testData.slug}`;
              
              req.body = {
                cafeName: testData.cafeName,
                slug: testData.slug,
                adminName: testData.adminName
              };
              req.user = { userId };

              const mockUser = {
                _id: userId,
                email: testData.email,
                name: testData.adminName,
                password: 'hashedpassword',
                hasCompletedSetup: false,
                tenantId: null,
                save: jest.fn().mockResolvedValue(true)
              };

              const mockTenant = {
                _id: tenantId,
                name: testData.cafeName,
                slug: testData.slug,
                dbName: dbName,
                isActive: true,
                status: 'trial',
                trialExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
              };

              const mockEmployee = {
                _id: employeeId,
                id: employeeId,
                email: testData.email,
                name: testData.adminName,
                username: testData.email.split('@')[0],
                role: 'admin',
                role_access: {},
                isVerified: true,
                authProvider: 'local',
                image: null
              };

              const mockTenantDB = {
                model: jest.fn((modelName) => {
                  if (modelName === 'Setting') {
                    return {
                      insertMany: jest.fn().mockResolvedValue([])
                    };
                  }
                  if (modelName === 'Employee') {
                    return {
                      findOne: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(mockEmployee)
                      })
                    };
                  }
                  return {};
                })
              };

              User.findById.mockResolvedValue(mockUser);
              Tenant.findOne.mockResolvedValue(null);
              Tenant.create.mockResolvedValue(mockTenant);
              getTenantDB.mockResolvedValue(mockTenantDB);

              // Act
              await setupTenant(req, res);

              // Assert - Property: JWT must be generated
              expect(jwt.sign).toHaveBeenCalled();

              // Assert - Property: JWT payload must contain tenant information
              const jwtCall = jwt.sign.mock.calls[0];
              const payload = jwtCall[0];

              // The key property: JWT must contain tenant slug
              expect(payload).toHaveProperty('tenant');
              expect(typeof payload.tenant).toBe('string');
              expect(payload.tenant.length).toBeGreaterThanOrEqual(3);
              
              // JWT must contain tenantId
              expect(payload).toHaveProperty('tenantId');
              expect(typeof payload.tenantId).toBe('string');
              
              // JWT must contain tenantDbName
              expect(payload).toHaveProperty('tenantDbName');
              expect(typeof payload.tenantDbName).toBe('string');
              expect(payload.tenantDbName).toMatch(/^superkafe_/);
              
              // JWT must contain user info
              expect(payload).toHaveProperty('userId');
              expect(payload).toHaveProperty('email');
              expect(payload).toHaveProperty('role', 'admin');

              // Assert - Property: Response must include token
              expect(res.status).toHaveBeenCalledWith(201);
              const responseCall = res.json.mock.calls[0][0];
              expect(responseCall).toHaveProperty('success', true);
              expect(responseCall).toHaveProperty('token');
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Login Flow with Completed Setup', () => {
      it('should include tenant info in JWT for any user with completed setup', async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate arbitrary user and tenant data
            fc.record({
              email: fc.emailAddress(),
              password: fc.string({ minLength: 6, maxLength: 50 }),
              name: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length >= 2),
              slug: fc.string({ minLength: 5, maxLength: 20 })
                .map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
                .filter(s => s.length >= 5)
                .filter(s => !['setup', 'admin', 'dashboard', 'auth', 'api', 'login', 'register', 'logout'].includes(s)),
              cafeName: fc.string({ minLength: 3, maxLength: 100 }).filter(s => s.trim().length >= 3)
            }),
            async (testData) => {
              // Arrange
              const userId = '507f1f77bcf86cd799439011';
              const tenantId = '507f1f77bcf86cd799439012';
              const employeeId = '507f1f77bcf86cd799439013';
              const dbName = `superkafe_${testData.slug}`;
              
              req.body = {
                email: testData.email,
                password: testData.password
              };

              const mockUser = {
                _id: userId,
                email: testData.email.toLowerCase(),
                name: testData.name,
                password: 'hashedpassword',
                authProvider: 'local',
                isVerified: true,
                hasCompletedSetup: true,
                tenantId: tenantId,
                tenantSlug: testData.slug,
                image: null
              };

              const mockTenant = {
                _id: tenantId,
                name: testData.cafeName,
                slug: testData.slug,
                dbName: dbName,
                isActive: true
              };

              const mockEmployee = {
                _id: employeeId,
                email: testData.email.toLowerCase(),
                name: testData.name,
                role: 'admin',
                username: testData.email.split('@')[0]
              };

              const mockTenantDB = {
                model: jest.fn(() => ({
                  findOne: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockEmployee)
                  })
                }))
              };

              User.findOne.mockResolvedValue(mockUser);
              Tenant.findById.mockResolvedValue(mockTenant);
              getTenantDB.mockResolvedValue(mockTenantDB);
              bcrypt.compare.mockResolvedValue(true);

              // Act
              await login(req, res);

              // Assert - Property: JWT must be generated
              expect(jwt.sign).toHaveBeenCalled();

              // Assert - Property: JWT payload must contain tenant information
              const jwtCall = jwt.sign.mock.calls[0];
              const payload = jwtCall[0];

              // The key property: JWT must contain tenant slug
              expect(payload).toHaveProperty('tenant');
              expect(typeof payload.tenant).toBe('string');
              expect(payload.tenant.length).toBeGreaterThanOrEqual(3);
              
              // JWT must contain tenantId
              expect(payload).toHaveProperty('tenantId');
              expect(typeof payload.tenantId).toBe('string');
              
              // JWT must contain tenantDbName
              expect(payload).toHaveProperty('tenantDbName');
              expect(typeof payload.tenantDbName).toBe('string');
              expect(payload.tenantDbName).toMatch(/^superkafe_/);
              
              // JWT must contain user info
              expect(payload).toHaveProperty('email');
              expect(payload).toHaveProperty('role', 'admin');

              // Assert - Property: Response must include token
              expect(res.json).toHaveBeenCalled();
              const responseCall = res.json.mock.calls[0][0];
              expect(responseCall).toHaveProperty('success', true);
              expect(responseCall).toHaveProperty('token');
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should not include tenant info in JWT for users without completed setup', async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate arbitrary user data without setup
            fc.record({
              email: fc.emailAddress(),
              password: fc.string({ minLength: 6, maxLength: 50 }),
              name: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length >= 2)
            }),
            async (testData) => {
              // Arrange
              const userId = '507f1f77bcf86cd799439011';
              
              req.body = {
                email: testData.email,
                password: testData.password
              };

              const mockUser = {
                _id: userId,
                email: testData.email.toLowerCase(),
                name: testData.name,
                password: 'hashedpassword',
                authProvider: 'local',
                isVerified: true,
                hasCompletedSetup: false,
                tenantId: null,
                tenantSlug: null,
                image: null
              };

              User.findOne.mockResolvedValue(mockUser);
              bcrypt.compare.mockResolvedValue(true);

              // Act
              await login(req, res);

              // Assert - Property: JWT must be generated
              expect(jwt.sign).toHaveBeenCalled();

              // Assert - Property: JWT payload should NOT contain tenant info
              const jwtCall = jwt.sign.mock.calls[0];
              const payload = jwtCall[0];

              expect(payload).toHaveProperty('userId');
              expect(payload).toHaveProperty('email');
              expect(payload).toHaveProperty('hasCompletedSetup', false);
              expect(payload).not.toHaveProperty('tenant');
              expect(payload).not.toHaveProperty('tenantId');
              expect(payload).not.toHaveProperty('tenantDbName');

              // Assert - Property: Response must include token
              expect(res.json).toHaveBeenCalled();
              const responseCall = res.json.mock.calls[0][0];
              expect(responseCall).toHaveProperty('success', true);
              expect(responseCall).toHaveProperty('token');
            }
          ),
          { numRuns: 50 }
        );
      });
    });

    describe('Google Auth Flow with Completed Setup', () => {
      it('should include tenant info in JWT for any Google user with completed setup', async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate arbitrary Google user and tenant data
            fc.record({
              email: fc.emailAddress(),
              name: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length >= 2),
              picture: fc.webUrl(),
              googleId: fc.string({ minLength: 10, maxLength: 50 }),
              slug: fc.string({ minLength: 5, maxLength: 20 })
                .map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
                .filter(s => s.length >= 5)
                .filter(s => !['setup', 'admin', 'dashboard', 'auth', 'api', 'login', 'register', 'logout'].includes(s)),
              cafeName: fc.string({ minLength: 3, maxLength: 100 }).filter(s => s.trim().length >= 3)
            }),
            async (testData) => {
              // Arrange
              const userId = '507f1f77bcf86cd799439011';
              const tenantId = '507f1f77bcf86cd799439012';
              const employeeId = '507f1f77bcf86cd799439013';
              const dbName = `superkafe_${testData.slug}`;
              
              req.body = {
                email: testData.email,
                name: testData.name,
                picture: testData.picture,
                idToken: testData.googleId
              };

              const mockUser = {
                _id: userId,
                email: testData.email.toLowerCase(),
                name: testData.name,
                image: testData.picture,
                googleId: testData.googleId,
                authProvider: 'google',
                isVerified: true,
                hasCompletedSetup: true,
                tenantId: tenantId,
                tenantSlug: testData.slug,
                password: null,
                save: jest.fn().mockResolvedValue(true)
              };

              const mockTenant = {
                _id: tenantId,
                name: testData.cafeName,
                slug: testData.slug,
                dbName: dbName,
                isActive: true
              };

              const mockEmployee = {
                _id: employeeId,
                email: testData.email.toLowerCase(),
                name: testData.name,
                role: 'admin',
                username: testData.email.split('@')[0]
              };

              const mockTenantDB = {
                model: jest.fn(() => ({
                  findOne: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockEmployee)
                  })
                }))
              };

              User.findOne.mockResolvedValue(mockUser);
              Tenant.findById.mockResolvedValue(mockTenant);
              getTenantDB.mockResolvedValue(mockTenantDB);

              // Act
              await googleAuth(req, res);

              // Assert - Property: JWT must be generated
              expect(jwt.sign).toHaveBeenCalled();

              // Assert - Property: JWT payload must contain tenant information
              const jwtCall = jwt.sign.mock.calls[0];
              const payload = jwtCall[0];

              // The key property: JWT must contain tenant slug
              expect(payload).toHaveProperty('tenant');
              expect(typeof payload.tenant).toBe('string');
              expect(payload.tenant.length).toBeGreaterThanOrEqual(3);
              
              // JWT must contain tenantId
              expect(payload).toHaveProperty('tenantId');
              expect(typeof payload.tenantId).toBe('string');
              
              // JWT must contain tenantDbName
              expect(payload).toHaveProperty('tenantDbName');
              expect(typeof payload.tenantDbName).toBe('string');
              expect(payload.tenantDbName).toMatch(/^superkafe_/);
              
              // JWT must contain user info
              expect(payload).toHaveProperty('email');
              expect(payload).toHaveProperty('role', 'admin');

              // Assert - Property: Response must include token
              expect(res.json).toHaveBeenCalled();
              const responseCall = res.json.mock.calls[0][0];
              expect(responseCall).toHaveProperty('success', true);
              expect(responseCall).toHaveProperty('token');
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('OTP Verification Flow with Completed Setup', () => {
      it('should include tenant info in JWT after OTP verification for users with completed setup', async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate arbitrary user and tenant data
            fc.record({
              email: fc.emailAddress(),
              otpCode: fc.string({ minLength: 6, maxLength: 6 }).map(s => s.replace(/[^0-9]/g, '0').substring(0, 6)),
              name: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length >= 2),
              slug: fc.string({ minLength: 5, maxLength: 20 })
                .map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
                .filter(s => s.length >= 5)
                .filter(s => !['setup', 'admin', 'dashboard', 'auth', 'api', 'login', 'register', 'logout'].includes(s)),
              cafeName: fc.string({ minLength: 3, maxLength: 100 }).filter(s => s.trim().length >= 3)
            }),
            async (testData) => {
              // Arrange
              const userId = '507f1f77bcf86cd799439011';
              const tenantId = '507f1f77bcf86cd799439012';
              const employeeId = '507f1f77bcf86cd799439013';
              const dbName = `superkafe_${testData.slug}`;
              const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
              
              req.body = {
                email: testData.email,
                otpCode: testData.otpCode
              };

              const mockUser = {
                _id: userId,
                email: testData.email.toLowerCase(),
                name: testData.name,
                authProvider: 'local',
                isVerified: false,
                otpCode: testData.otpCode,
                otpExpiry: otpExpiry,
                hasCompletedSetup: true,
                tenantId: tenantId,
                tenantSlug: testData.slug,
                image: null,
                save: jest.fn().mockResolvedValue(true)
              };

              const mockTenant = {
                _id: tenantId,
                name: testData.cafeName,
                slug: testData.slug,
                dbName: dbName,
                isActive: true
              };

              const mockEmployee = {
                _id: employeeId,
                email: testData.email.toLowerCase(),
                name: testData.name,
                role: 'admin',
                username: testData.email.split('@')[0]
              };

              const mockTenantDB = {
                model: jest.fn(() => ({
                  findOne: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(mockEmployee)
                  })
                }))
              };

              User.findOne.mockResolvedValue(mockUser);
              Tenant.findById.mockResolvedValue(mockTenant);
              getTenantDB.mockResolvedValue(mockTenantDB);

              // Act
              await verifyOTP(req, res);

              // Assert - Property: JWT must be generated
              expect(jwt.sign).toHaveBeenCalled();

              // Assert - Property: JWT payload must contain tenant information
              const jwtCall = jwt.sign.mock.calls[0];
              const payload = jwtCall[0];

              // The key property: JWT must contain tenant slug
              expect(payload).toHaveProperty('tenant');
              expect(typeof payload.tenant).toBe('string');
              expect(payload.tenant.length).toBeGreaterThanOrEqual(3);
              
              // JWT must contain tenantId
              expect(payload).toHaveProperty('tenantId');
              expect(typeof payload.tenantId).toBe('string');
              
              // JWT must contain tenantDbName
              expect(payload).toHaveProperty('tenantDbName');
              expect(typeof payload.tenantDbName).toBe('string');
              expect(payload.tenantDbName).toMatch(/^superkafe_/);
              
              // JWT must contain user info
              expect(payload).toHaveProperty('email');
              expect(payload).toHaveProperty('role', 'admin');

              // Assert - Property: Response must include token
              expect(res.json).toHaveBeenCalled();
              const responseCall = res.json.mock.calls[0][0];
              expect(responseCall).toHaveProperty('success', true);
              expect(responseCall).toHaveProperty('token');
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('JWT Payload Structure Validation', () => {
      it('should always include required fields in JWT payload for completed setup', async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate minimal required data
            fc.record({
              email: fc.emailAddress(),
              slug: fc.string({ minLength: 5, maxLength: 20 })
                .map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
                .filter(s => s.length >= 5)
                .filter(s => !['setup', 'admin', 'dashboard', 'auth', 'api', 'login', 'register', 'logout'].includes(s))
            }),
            async (testData) => {
              // Arrange
              const userId = '507f1f77bcf86cd799439011';
              const tenantId = '507f1f77bcf86cd799439012';
              const employeeId = '507f1f77bcf86cd799439013';
              const dbName = `superkafe_${testData.slug}`;
              
              req.body = {
                cafeName: 'Test Cafe',
                slug: testData.slug,
                adminName: 'Admin'
              };
              req.user = { userId };

              const mockUser = {
                _id: userId,
                email: testData.email,
                name: 'Admin',
                password: 'hashedpassword',
                hasCompletedSetup: false,
                tenantId: null,
                save: jest.fn().mockResolvedValue(true)
              };

              const mockTenant = {
                _id: tenantId,
                name: 'Test Cafe',
                slug: testData.slug,
                dbName: dbName,
                isActive: true,
                status: 'trial',
                trialExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
              };

              const mockEmployee = {
                _id: employeeId,
                id: employeeId,
                email: testData.email,
                name: 'Admin',
                username: testData.email.split('@')[0],
                role: 'admin',
                role_access: {},
                isVerified: true,
                authProvider: 'local',
                image: null
              };

              const mockTenantDB = {
                model: jest.fn((modelName) => {
                  if (modelName === 'Setting') {
                    return {
                      insertMany: jest.fn().mockResolvedValue([])
                    };
                  }
                  if (modelName === 'Employee') {
                    return {
                      findOne: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue(mockEmployee)
                      })
                    };
                  }
                  return {};
                })
              };

              User.findById.mockResolvedValue(mockUser);
              Tenant.findOne.mockResolvedValue(null);
              Tenant.create.mockResolvedValue(mockTenant);
              getTenantDB.mockResolvedValue(mockTenantDB);

              // Act
              await setupTenant(req, res);

              // Assert - Property: JWT payload must have all required fields
              expect(jwt.sign).toHaveBeenCalled();
              const jwtCall = jwt.sign.mock.calls[0];
              const payload = jwtCall[0];

              // Required fields for tenant-scoped JWT
              const requiredFields = ['tenant', 'tenantId', 'tenantDbName', 'userId', 'email', 'role'];
              requiredFields.forEach(field => {
                expect(payload).toHaveProperty(field);
                expect(payload[field]).toBeDefined();
                expect(payload[field]).not.toBeNull();
              });

              // Validate field types
              expect(typeof payload.tenant).toBe('string');
              expect(typeof payload.tenantId).toBe('string');
              expect(typeof payload.tenantDbName).toBe('string');
              expect(typeof payload.email).toBe('string');
              expect(typeof payload.role).toBe('string');
            }
          ),
          { numRuns: 50 }
        );
      });
    });
  });
});
