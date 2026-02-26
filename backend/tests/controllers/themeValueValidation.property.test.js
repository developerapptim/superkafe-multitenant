/**
 * Property-Based Tests for Theme Value Validation
 * Feature: seamless-branding-integration
 * 
 * **Validates: Requirements 3.4, 10.4**
 * 
 * These tests verify that the backend theme API correctly rejects invalid theme names
 * and only accepts valid preset themes ('default' and 'light-coffee').
 */

const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const Tenant = require('../../models/Tenant');
const ThemeController = require('../../controllers/ThemeController');

let mongoServer;
let app;
let testTenantId;
let validToken;

const JWT_SECRET = 'test-secret-key';
const ALLOWED_THEMES = ['default', 'light-coffee'];

// Mock JWT middleware for testing
const mockCheckJwt = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Missing Authorization header' });
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Invalid Authorization header' });

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

beforeAll(async () => {
  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
  
  // Create test tenant
  const testTenant = await Tenant.create({
    name: 'Test Cafe',
    slug: 'test-cafe',
    dbName: 'superkafe_v2',
    selectedTheme: 'default',
    hasSeenThemePopup: false
  });
  testTenantId = testTenant._id.toString();

  // Create JWT token
  validToken = jwt.sign(
    {
      userId: new mongoose.Types.ObjectId().toString(),
      tenantId: testTenantId,
      tenantSlug: 'test-cafe',
      email: 'test@example.com'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Setup Express app for testing
  app = express();
  app.use(express.json());
  
  // Apply mock JWT middleware
  app.use(mockCheckJwt);
  
  // Theme routes
  app.put('/api/tenants/:tenantId/theme', ThemeController.updateTheme);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Reset test tenant theme before each test
  await Tenant.findByIdAndUpdate(testTenantId, {
    selectedTheme: 'default',
    hasSeenThemePopup: false
  });
});

describe('Theme Value Validation - Property-Based Tests', () => {
  
  /**
   * Property 4: Theme Value Validation
   * **Validates: Requirements 3.4, 10.4**
   * 
   * For any theme value submitted to the backend that is NOT in the allowed presets,
   * the system must validate and reject it with a 400 status code.
   */
  describe('Property 4: Theme Value Validation', () => {
    it('should reject any invalid theme name with 400 status', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random strings that are NOT in the allowed themes list
          fc.string({ minLength: 1, maxLength: 50 })
            .filter(s => !ALLOWED_THEMES.includes(s)),
          async (invalidTheme) => {
            // Act
            const response = await request(app)
              .put(`/api/tenants/${testTenantId}/theme`)
              .set('Authorization', `Bearer ${validToken}`)
              .send({ theme: invalidTheme });

            // Assert - Property: Backend must reject with 400 status
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBeDefined();
            expect(response.body.error).toContain('Invalid theme name');
            
            // Verify database was NOT updated
            const tenant = await Tenant.findById(testTenantId);
            expect(tenant.selectedTheme).toBe('default'); // Should remain unchanged
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept all valid theme presets', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate only valid theme names
          fc.constantFrom(...ALLOWED_THEMES),
          async (validTheme) => {
            // Act
            const response = await request(app)
              .put(`/api/tenants/${testTenantId}/theme`)
              .set('Authorization', `Bearer ${validToken}`)
              .send({ theme: validTheme });

            // Assert - Property: Backend must accept with 200 status
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.theme).toBe(validTheme);
            
            // Verify database was updated correctly
            const tenant = await Tenant.findById(testTenantId);
            expect(tenant.selectedTheme).toBe(validTheme);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject theme names with special characters and whitespace', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate strings with special characters, numbers, and whitespace
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 30 }).map(s => s + '!@#$%'),
            fc.string({ minLength: 1, maxLength: 30 }).map(s => '   ' + s + '   '),
            fc.string({ minLength: 1, maxLength: 30 }).map(s => s.toUpperCase()),
            fc.integer({ min: 0, max: 999999 }).map(n => n.toString()),
            fc.string({ minLength: 1, maxLength: 30 }).map(s => s + '\n\t'),
            fc.constant(''),
            fc.constant('null'),
            fc.constant('undefined')
          ).filter(s => !ALLOWED_THEMES.includes(s)),
          async (invalidTheme) => {
            // Act
            const response = await request(app)
              .put(`/api/tenants/${testTenantId}/theme`)
              .set('Authorization', `Bearer ${validToken}`)
              .send({ theme: invalidTheme });

            // Assert - Property: Backend must reject with 400 status
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            
            // Verify database was NOT updated
            const tenant = await Tenant.findById(testTenantId);
            expect(tenant.selectedTheme).toBe('default');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject theme names that are close but not exact matches', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate variations of valid theme names that are NOT exact matches
          fc.oneof(
            fc.constant('Default'),           // Wrong case
            fc.constant('DEFAULT'),           // Wrong case
            fc.constant('default '),          // Trailing space
            fc.constant(' default'),          // Leading space
            fc.constant('light-Coffee'),      // Wrong case
            fc.constant('LIGHT-COFFEE'),      // Wrong case
            fc.constant('light_coffee'),      // Wrong separator
            fc.constant('lightcoffee'),       // No separator
            fc.constant('light-coffe'),       // Typo
            fc.constant('light-coffees'),     // Plural
            fc.constant('defaults'),          // Plural
            fc.constant('dark'),              // Similar but invalid
            fc.constant('light'),             // Partial match
            fc.constant('coffee')             // Partial match
          ),
          async (almostValidTheme) => {
            // Act
            const response = await request(app)
              .put(`/api/tenants/${testTenantId}/theme`)
              .set('Authorization', `Bearer ${validToken}`)
              .send({ theme: almostValidTheme });

            // Assert - Property: Backend must reject with 400 status
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid theme name');
            
            // Verify database was NOT updated
            const tenant = await Tenant.findById(testTenantId);
            expect(tenant.selectedTheme).toBe('default');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate theme value regardless of other request fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate invalid theme with various other fields
          fc.record({
            theme: fc.string({ minLength: 1, maxLength: 30 })
              .filter(s => !ALLOWED_THEMES.includes(s)),
            markPopupSeen: fc.boolean(),
            extraField: fc.string(),
            anotherField: fc.integer()
          }),
          async (requestBody) => {
            // Act
            const response = await request(app)
              .put(`/api/tenants/${testTenantId}/theme`)
              .set('Authorization', `Bearer ${validToken}`)
              .send(requestBody);

            // Assert - Property: Backend must reject based on theme validation alone
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid theme name');
            
            // Verify database was NOT updated
            const tenant = await Tenant.findById(testTenantId);
            expect(tenant.selectedTheme).toBe('default');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases: empty, null, undefined theme values', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate edge case values
          fc.oneof(
            fc.constant({}),                    // Missing theme field
            fc.constant({ theme: '' }),         // Empty string
            fc.constant({ theme: null }),       // Null
            fc.constant({ theme: undefined })   // Undefined
          ),
          async (requestBody) => {
            // Act
            const response = await request(app)
              .put(`/api/tenants/${testTenantId}/theme`)
              .set('Authorization', `Bearer ${validToken}`)
              .send(requestBody);

            // Assert - Property: Backend must reject with 400 status
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            
            // Verify database was NOT updated
            const tenant = await Tenant.findById(testTenantId);
            expect(tenant.selectedTheme).toBe('default');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should maintain data integrity after multiple invalid attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of invalid theme names
          fc.array(
            fc.string({ minLength: 1, maxLength: 30 })
              .filter(s => !ALLOWED_THEMES.includes(s)),
            { minLength: 2, maxLength: 5 }
          ),
          async (invalidThemes) => {
            // Act - Try multiple invalid theme updates
            for (const invalidTheme of invalidThemes) {
              const response = await request(app)
                .put(`/api/tenants/${testTenantId}/theme`)
                .set('Authorization', `Bearer ${validToken}`)
                .send({ theme: invalidTheme });

              // Assert - Each attempt must be rejected
              expect(response.status).toBe(400);
              expect(response.body.success).toBe(false);
            }

            // Assert - Property: Database must remain unchanged after all attempts
            const tenant = await Tenant.findById(testTenantId);
            expect(tenant.selectedTheme).toBe('default');
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
