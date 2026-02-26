const fc = require('fast-check');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Tenant = require('../../models/Tenant');
const Employee = require('../../models/Employee');
const { getTenantDB } = require('../../config/db');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../models/Tenant');
jest.mock('../../models/Employee');
jest.mock('../../config/db', () => ({
  getTenantDB: jest.fn()
}));
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../utils/tenantContext', () => ({
  runWithTenantContext: jest.fn()
}));

// Import controllers AFTER mocking dependencies
const { login, googleAuth, verifyOTP } = require('../../controllers/UnifiedAuthController');
const { globalLogin } = require('../../controllers/GlobalAuthController');
const { runWithTenantContext } = require('../../utils/tenantContext');

/**
 * Property-Based Tests for Authentication Includes Theme Data
 * Feature: seamless-branding-integration
 * 
 * **Property 3: Authentication Includes Theme Data**
 * **Validates: Requirements 3.3, 10.5**
 * 
 * These tests verify that all successful authentication responses include
 * theme fields (selectedTheme and hasSeenThemePopup) from the tenant object.
 */
describe('Property 3: Authentication Includes Theme Data', () => {
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

    // Mock jwt.sign to return a token
    jwt.sign.mockImplementation((payload, secret, options) => {
      return `mock.jwt.token.${JSON.stringify(payload)}`;
    });

    // Mock runWithTenantContext to execute the callback directly
    runWithTenantContext.mockImplementation(async (tenant, callback) => {
      return await callback();
    });
  });

  // Helper function to setup mocks for each property test iteration
  const setupMocksForIteration = () => {
    // Don't clear all mocks - just reset the ones we need
    // jest.clearAllMocks() would clear getTenantDB which breaks the test
    
    // Reset response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Reset User and Tenant mocks
    User.findOne.mockReset();
    Tenant.findById.mockReset();
    bcrypt.compare.mockReset();
  };

  /**
   * Test UnifiedAuthController.login() - Theme data inclusion
   * 
   * For any successful login with completed setup, the response must include
   * selectedTheme and hasSeenThemePopup fields in the tenant object.
   */
  describe('UnifiedAuthController.login()', () => {
    it('should include selectedTheme and hasSeenThemePopup for any valid login', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary user and tenant data with theme values
          fc.record({
            email: fc.emailAddress(),
            password: fc.string({ minLength: 6, maxLength: 50 }),
            name: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length >= 2),
            slug: fc.string({ minLength: 5, maxLength: 20 })
              .map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
              .filter(s => s.length >= 5)
              .filter(s => !['setup', 'admin', 'dashboard', 'auth', 'api', 'login', 'register', 'logout'].includes(s)),
            cafeName: fc.string({ minLength: 3, maxLength: 100 }).filter(s => s.trim().length >= 3),
            selectedTheme: fc.constantFrom('default', 'light-coffee'),
            hasSeenThemePopup: fc.boolean()
          }),
          async (testData) => {
            // Reset mocks for this iteration
            setupMocksForIteration();
            
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
              isActive: true,
              selectedTheme: testData.selectedTheme,
              hasSeenThemePopup: testData.hasSeenThemePopup
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

            // Assert - Property: Response must include tenant with theme data
            expect(res.json).toHaveBeenCalled();
            const responseCall = res.json.mock.calls[0][0];
            
            // The key property: Response must have tenant object
            expect(responseCall).toHaveProperty('tenant');
            expect(responseCall.tenant).toBeDefined();
            
            // The key property: Tenant must include selectedTheme
            expect(responseCall.tenant).toHaveProperty('selectedTheme');
            expect(responseCall.tenant.selectedTheme).toBe(testData.selectedTheme);
            
            // The key property: Tenant must include hasSeenThemePopup
            expect(responseCall.tenant).toHaveProperty('hasSeenThemePopup');
            expect(responseCall.tenant.hasSeenThemePopup).toBe(testData.hasSeenThemePopup);
            
            // Verify Tenant.findById was called to fetch theme data
            expect(Tenant.findById).toHaveBeenCalledWith(tenantId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test UnifiedAuthController.googleAuth() - Theme data inclusion
   * 
   * For any successful Google authentication with completed setup, the response
   * must include selectedTheme and hasSeenThemePopup fields in the tenant object.
   */
  describe('UnifiedAuthController.googleAuth()', () => {
    it('should include selectedTheme and hasSeenThemePopup for any valid Google auth', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary Google user and tenant data with theme values
          fc.record({
            email: fc.emailAddress(),
            name: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length >= 2),
            picture: fc.webUrl(),
            googleId: fc.string({ minLength: 10, maxLength: 50 }),
            slug: fc.string({ minLength: 5, maxLength: 20 })
              .map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
              .filter(s => s.length >= 5)
              .filter(s => !['setup', 'admin', 'dashboard', 'auth', 'api', 'login', 'register', 'logout'].includes(s)),
            cafeName: fc.string({ minLength: 3, maxLength: 100 }).filter(s => s.trim().length >= 3),
            selectedTheme: fc.constantFrom('default', 'light-coffee'),
            hasSeenThemePopup: fc.boolean()
          }),
          async (testData) => {
            // Reset mocks for this iteration
            setupMocksForIteration();
            
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
              isActive: true,
              selectedTheme: testData.selectedTheme,
              hasSeenThemePopup: testData.hasSeenThemePopup
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

            // Assert - Property: Response must include tenant with theme data
            expect(res.json).toHaveBeenCalled();
            const responseCall = res.json.mock.calls[0][0];
            
            // The key property: Response must have tenant object
            expect(responseCall).toHaveProperty('tenant');
            expect(responseCall.tenant).toBeDefined();
            
            // The key property: Tenant must include selectedTheme
            expect(responseCall.tenant).toHaveProperty('selectedTheme');
            expect(responseCall.tenant.selectedTheme).toBe(testData.selectedTheme);
            
            // The key property: Tenant must include hasSeenThemePopup
            expect(responseCall.tenant).toHaveProperty('hasSeenThemePopup');
            expect(responseCall.tenant.hasSeenThemePopup).toBe(testData.hasSeenThemePopup);
            
            // Verify Tenant.findById was called to fetch theme data
            expect(Tenant.findById).toHaveBeenCalledWith(tenantId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test UnifiedAuthController.verifyOTP() - Theme data inclusion
   * 
   * For any successful OTP verification with completed setup, the response
   * must include selectedTheme and hasSeenThemePopup fields in the tenant object.
   */
  describe('UnifiedAuthController.verifyOTP()', () => {
    it('should include selectedTheme and hasSeenThemePopup for any valid OTP verification', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary user and tenant data with theme values
          fc.record({
            email: fc.emailAddress(),
            otpCode: fc.string({ minLength: 6, maxLength: 6 }).map(s => s.replace(/[^0-9]/g, '0').substring(0, 6)),
            name: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length >= 2),
            slug: fc.string({ minLength: 5, maxLength: 20 })
              .map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
              .filter(s => s.length >= 5)
              .filter(s => !['setup', 'admin', 'dashboard', 'auth', 'api', 'login', 'register', 'logout'].includes(s)),
            cafeName: fc.string({ minLength: 3, maxLength: 100 }).filter(s => s.trim().length >= 3),
            selectedTheme: fc.constantFrom('default', 'light-coffee'),
            hasSeenThemePopup: fc.boolean()
          }),
          async (testData) => {
            // Reset mocks for this iteration
            setupMocksForIteration();
            
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
              isActive: true,
              selectedTheme: testData.selectedTheme,
              hasSeenThemePopup: testData.hasSeenThemePopup
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

            // Assert - Property: Response must include tenant with theme data
            expect(res.json).toHaveBeenCalled();
            const responseCall = res.json.mock.calls[0][0];
            
            // The key property: Response must have tenant object
            expect(responseCall).toHaveProperty('tenant');
            expect(responseCall.tenant).toBeDefined();
            
            // The key property: Tenant must include selectedTheme
            expect(responseCall.tenant).toHaveProperty('selectedTheme');
            expect(responseCall.tenant.selectedTheme).toBe(testData.selectedTheme);
            
            // The key property: Tenant must include hasSeenThemePopup
            expect(responseCall.tenant).toHaveProperty('hasSeenThemePopup');
            expect(responseCall.tenant.hasSeenThemePopup).toBe(testData.hasSeenThemePopup);
            
            // Verify Tenant.findById was called to fetch theme data
            expect(Tenant.findById).toHaveBeenCalledWith(tenantId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test GlobalAuthController.globalLogin() - Theme data inclusion
   * 
   * For any successful global login, the response must include
   * selectedTheme and hasSeenThemePopup fields in the tenant object.
   * 
   * NOTE: Skipped because GlobalAuthController.globalLogin() is not yet implemented
   */
  describe.skip('GlobalAuthController.globalLogin()', () => {
    it('should include selectedTheme and hasSeenThemePopup for any valid global login', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary user and tenant data with theme values
          fc.record({
            email: fc.emailAddress(),
            password: fc.string({ minLength: 6, maxLength: 50 }),
            name: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length >= 2),
            slug: fc.string({ minLength: 5, maxLength: 20 })
              .map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
              .filter(s => s.length >= 5)
              .filter(s => !['setup', 'admin', 'dashboard', 'auth', 'api', 'login', 'register', 'logout'].includes(s)),
            businessName: fc.string({ minLength: 3, maxLength: 100 }).filter(s => s.trim().length >= 3),
            selectedTheme: fc.constantFrom('default', 'light-coffee'),
            hasSeenThemePopup: fc.boolean()
          }),
          async (testData) => {
            // Arrange
            const userId = '507f1f77bcf86cd799439011';
            const tenantId = '507f1f77bcf86cd799439012';
            
            req.body = {
              email: testData.email,
              password: testData.password
            };

            const mockUser = {
              _id: userId,
              email: testData.email.toLowerCase(),
              name: testData.name,
              password: 'hashedpassword',
              role: 'admin',
              tenantId: tenantId
            };

            const mockTenant = {
              _id: tenantId,
              slug: testData.slug,
              businessName: testData.businessName,
              selectedTheme: testData.selectedTheme,
              hasSeenThemePopup: testData.hasSeenThemePopup
            };

            User.findOne.mockResolvedValue(mockUser);
            Tenant.findById.mockResolvedValue(mockTenant);
            bcrypt.compare.mockResolvedValue(true);

            // Act
            await globalLogin(req, res);

            // Assert - Property: Response must include tenant with theme data
            expect(res.json).toHaveBeenCalled();
            const responseCall = res.json.mock.calls[0][0];
            
            // The key property: Response must have tenant object
            expect(responseCall).toHaveProperty('tenant');
            expect(responseCall.tenant).toBeDefined();
            
            // The key property: Tenant must include selectedTheme
            expect(responseCall.tenant).toHaveProperty('selectedTheme');
            expect(responseCall.tenant.selectedTheme).toBe(testData.selectedTheme);
            
            // The key property: Tenant must include hasSeenThemePopup
            expect(responseCall.tenant).toHaveProperty('hasSeenThemePopup');
            expect(responseCall.tenant.hasSeenThemePopup).toBe(testData.hasSeenThemePopup);
            
            // Verify Tenant.findById was called to fetch theme data
            expect(Tenant.findById).toHaveBeenCalledWith(tenantId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test Theme Data Consistency Across All Auth Methods
   * 
   * For any authentication method, the theme data structure must be consistent
   * and include both required fields with valid values.
   */
  describe('Theme Data Consistency', () => {
    it('should always include both selectedTheme and hasSeenThemePopup fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary theme data
          fc.record({
            email: fc.emailAddress(),
            password: fc.string({ minLength: 6, maxLength: 50 }),
            slug: fc.string({ minLength: 5, maxLength: 20 })
              .map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
              .filter(s => s.length >= 5),
            selectedTheme: fc.constantFrom('default', 'light-coffee'),
            hasSeenThemePopup: fc.boolean()
          }),
          async (testData) => {
            // Reset mocks for this iteration
            setupMocksForIteration();
            
            // Arrange
            const userId = '507f1f77bcf86cd799439011';
            const tenantId = '507f1f77bcf86cd799439012';
            const employeeId = '507f1f77bcf86cd799439013';
            
            req.body = {
              email: testData.email,
              password: testData.password
            };

            const mockUser = {
              _id: userId,
              email: testData.email.toLowerCase(),
              name: 'Test User',
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
              name: 'Test Cafe',
              slug: testData.slug,
              dbName: `superkafe_${testData.slug}`,
              isActive: true,
              selectedTheme: testData.selectedTheme,
              hasSeenThemePopup: testData.hasSeenThemePopup
            };

            const mockEmployee = {
              _id: employeeId,
              email: testData.email.toLowerCase(),
              name: 'Test User',
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

            // Assert - Property: Both theme fields must be present
            expect(res.json).toHaveBeenCalled();
            const responseCall = res.json.mock.calls[0][0];
            
            expect(responseCall.tenant).toHaveProperty('selectedTheme');
            expect(responseCall.tenant).toHaveProperty('hasSeenThemePopup');
            
            // Validate field types
            expect(typeof responseCall.tenant.selectedTheme).toBe('string');
            expect(typeof responseCall.tenant.hasSeenThemePopup).toBe('boolean');
            
            // Validate selectedTheme is one of the allowed values
            expect(['default', 'light-coffee']).toContain(responseCall.tenant.selectedTheme);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
