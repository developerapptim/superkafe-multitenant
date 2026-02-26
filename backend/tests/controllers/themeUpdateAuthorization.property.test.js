/**
 * Property-Based Tests for Theme Update Authorization
 * Feature: seamless-branding-integration
 * 
 * **Validates: Requirements 10.3**
 * 
 * These tests verify that the backend theme API correctly enforces authorization:
 * - Unauthorized users (different tenantId) receive 403 Forbidden error
 * - Authorized users (matching tenantId) can successfully update theme
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
let tenant1Id;
let tenant2Id;
let tenant1Token;
let tenant2Token;

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
  
  // Create two test tenants
  const testTenant1 = await Tenant.create({
    name: 'Cafe Alpha',
    slug: 'cafe-alpha',
    dbName: 'superkafe_v2',
    selectedTheme: 'default',
    hasSeenThemePopup: false
  });
  tenant1Id = testTenant1._id.toString();

  const testTenant2 = await Tenant.create({
    name: 'Cafe Beta',
    slug: 'cafe-beta',
    dbName: 'superkafe_v2',
    selectedTheme: 'default',
    hasSeenThemePopup: false
  });
  tenant2Id = testTenant2._id.toString();

  // Create JWT tokens for each tenant
  tenant1Token = jwt.sign(
    {
      userId: new mongoose.Types.ObjectId().toString(),
      tenantId: tenant1Id,
      tenantSlug: 'cafe-alpha',
      email: 'owner1@example.com'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  tenant2Token = jwt.sign(
    {
      userId: new mongoose.Types.ObjectId().toString(),
      tenantId: tenant2Id,
      tenantSlug: 'cafe-beta',
      email: 'owner2@example.com'
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
  app.get('/api/tenants/:tenantId/theme', ThemeController.getTheme);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Reset both tenants' themes before each test
  await Tenant.findByIdAndUpdate(tenant1Id, {
    selectedTheme: 'default',
    hasSeenThemePopup: false
  });
  await Tenant.findByIdAndUpdate(tenant2Id, {
    selectedTheme: 'default',
    hasSeenThemePopup: false
  });
});

describe('Theme Update Authorization - Property-Based Tests', () => {
  
  /**
   * Property 11: Theme Update Authorization
   * **Validates: Requirements 10.3**
   * 
   * For any theme update request, the backend must verify that the authenticated user
   * has permission to modify the specified tenant's settings, and return a 403 Forbidden
   * error if the user lacks authorization.
   */
  describe('Property 11: Theme Update Authorization', () => {
    
    it('should reject unauthorized users with 403 for any valid theme', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid theme names
          fc.constantFrom(...ALLOWED_THEMES),
          async (validTheme) => {
            // Act - User from tenant1 tries to update tenant2's theme
            const response = await request(app)
              .put(`/api/tenants/${tenant2Id}/theme`)
              .set('Authorization', `Bearer ${tenant1Token}`)
              .send({ theme: validTheme });

            // Assert - Property: Unauthorized access must return 403
            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBeDefined();
            expect(response.body.error).toContain('permission');
            
            // Verify tenant2's theme was NOT updated
            const tenant2 = await Tenant.findById(tenant2Id);
            expect(tenant2.selectedTheme).toBe('default');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow authorized users to update their own tenant theme', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid theme names
          fc.constantFrom(...ALLOWED_THEMES),
          async (validTheme) => {
            // Act - User from tenant1 updates their own tenant's theme
            const response = await request(app)
              .put(`/api/tenants/${tenant1Id}/theme`)
              .set('Authorization', `Bearer ${tenant1Token}`)
              .send({ theme: validTheme });

            // Assert - Property: Authorized access must succeed with 200
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.theme).toBe(validTheme);
            
            // Verify tenant1's theme was updated correctly
            const tenant1 = await Tenant.findById(tenant1Id);
            expect(tenant1.selectedTheme).toBe(validTheme);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce authorization regardless of theme validity', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate both valid and invalid theme names
          fc.oneof(
            fc.constantFrom(...ALLOWED_THEMES),
            fc.string({ minLength: 1, maxLength: 30 })
              .filter(s => !ALLOWED_THEMES.includes(s))
          ),
          async (themeName) => {
            // Act - User from tenant2 tries to update tenant1's theme
            const response = await request(app)
              .put(`/api/tenants/${tenant1Id}/theme`)
              .set('Authorization', `Bearer ${tenant2Token}`)
              .send({ theme: themeName });

            // Assert - Property: Authorization check happens BEFORE validation
            // Unauthorized access must return 403, not 400
            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('permission');
            
            // Verify tenant1's theme was NOT updated
            const tenant1 = await Tenant.findById(tenant1Id);
            expect(tenant1.selectedTheme).toBe('default');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent cross-tenant theme updates with any request body', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate various request bodies with valid themes
          fc.record({
            theme: fc.constantFrom(...ALLOWED_THEMES),
            markPopupSeen: fc.boolean(),
            extraField: fc.option(fc.string(), { nil: undefined })
          }),
          async (requestBody) => {
            // Act - User from tenant1 tries to update tenant2's theme
            const response = await request(app)
              .put(`/api/tenants/${tenant2Id}/theme`)
              .set('Authorization', `Bearer ${tenant1Token}`)
              .send(requestBody);

            // Assert - Property: Must reject with 403 regardless of request body
            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            
            // Verify tenant2's theme was NOT updated
            const tenant2 = await Tenant.findById(tenant2Id);
            expect(tenant2.selectedTheme).toBe('default');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow GET requests only for authorized tenant', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random theme to set first
          fc.constantFrom(...ALLOWED_THEMES),
          async (initialTheme) => {
            // Setup - Set tenant1's theme
            await Tenant.findByIdAndUpdate(tenant1Id, {
              selectedTheme: initialTheme
            });

            // Act - User from tenant1 gets their own theme (authorized)
            const authorizedResponse = await request(app)
              .get(`/api/tenants/${tenant1Id}/theme`)
              .set('Authorization', `Bearer ${tenant1Token}`);

            // Assert - Authorized GET must succeed
            expect(authorizedResponse.status).toBe(200);
            expect(authorizedResponse.body.theme).toBe(initialTheme);

            // Act - User from tenant2 tries to get tenant1's theme (unauthorized)
            const unauthorizedResponse = await request(app)
              .get(`/api/tenants/${tenant1Id}/theme`)
              .set('Authorization', `Bearer ${tenant2Token}`);

            // Assert - Property: Unauthorized GET must return 403
            expect(unauthorizedResponse.status).toBe(403);
            expect(unauthorizedResponse.body.success).toBe(false);
            expect(unauthorizedResponse.body.error).toContain('permission');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain authorization isolation across multiple update attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of theme update attempts
          fc.array(
            fc.constantFrom(...ALLOWED_THEMES),
            { minLength: 2, maxLength: 5 }
          ),
          async (themeSequence) => {
            // Act - User from tenant1 tries multiple updates to tenant2
            for (const theme of themeSequence) {
              const response = await request(app)
                .put(`/api/tenants/${tenant2Id}/theme`)
                .set('Authorization', `Bearer ${tenant1Token}`)
                .send({ theme });

              // Assert - Each attempt must be rejected with 403
              expect(response.status).toBe(403);
              expect(response.body.success).toBe(false);
            }

            // Assert - Property: Tenant2's theme must remain unchanged after all attempts
            const tenant2 = await Tenant.findById(tenant2Id);
            expect(tenant2.selectedTheme).toBe('default');

            // Verify tenant1 can still update their own theme
            const validResponse = await request(app)
              .put(`/api/tenants/${tenant1Id}/theme`)
              .set('Authorization', `Bearer ${tenant1Token}`)
              .send({ theme: themeSequence[0] });

            expect(validResponse.status).toBe(200);
            expect(validResponse.body.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject requests without authentication token', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...ALLOWED_THEMES),
          async (validTheme) => {
            // Act - Request without Authorization header
            const response = await request(app)
              .put(`/api/tenants/${tenant1Id}/theme`)
              .send({ theme: validTheme });

            // Assert - Property: Must reject with 401 (not 403)
            expect(response.status).toBe(401);
            expect(response.body.error).toBeDefined();
            
            // Verify theme was NOT updated
            const tenant1 = await Tenant.findById(tenant1Id);
            expect(tenant1.selectedTheme).toBe('default');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should verify tenantId in JWT matches route parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid theme and random tenant IDs
          fc.record({
            theme: fc.constantFrom(...ALLOWED_THEMES),
            // Generate random valid MongoDB ObjectId
            randomTenantId: fc.hexaString({ minLength: 24, maxLength: 24 })
          }),
          async ({ theme, randomTenantId }) => {
            // Skip if random ID happens to match our test tenants
            if (randomTenantId === tenant1Id || randomTenantId === tenant2Id) {
              return true;
            }

            // Act - User from tenant1 tries to update a different tenant
            const response = await request(app)
              .put(`/api/tenants/${randomTenantId}/theme`)
              .set('Authorization', `Bearer ${tenant1Token}`)
              .send({ theme });

            // Assert - Property: Must reject with 403 for any non-matching tenantId
            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('permission');
            
            // Verify tenant1's theme remains unchanged
            const tenant1 = await Tenant.findById(tenant1Id);
            expect(tenant1.selectedTheme).toBe('default');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log unauthorized access attempts', async () => {
      // Spy on console.warn to verify logging
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...ALLOWED_THEMES),
          async (validTheme) => {
            // Clear previous calls
            warnSpy.mockClear();

            // Act - Unauthorized update attempt
            const response = await request(app)
              .put(`/api/tenants/${tenant2Id}/theme`)
              .set('Authorization', `Bearer ${tenant1Token}`)
              .send({ theme: validTheme });

            // Assert - Property: Must reject with 403
            expect(response.status).toBe(403);
            
            // Verify logging occurred
            expect(warnSpy).toHaveBeenCalled();
            const logCall = warnSpy.mock.calls[0];
            expect(logCall[0]).toContain('Unauthorized theme update attempt');
          }
        ),
        { numRuns: 50 }
      );

      // Restore console.warn
      warnSpy.mockRestore();
    });

    it('should handle concurrent authorization checks correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple concurrent requests
          fc.array(
            fc.record({
              theme: fc.constantFrom(...ALLOWED_THEMES),
              targetTenantId: fc.constantFrom(tenant1Id, tenant2Id),
              useToken: fc.constantFrom(tenant1Token, tenant2Token)
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (requests) => {
            // Act - Send all requests concurrently
            const responses = await Promise.all(
              requests.map(req =>
                request(app)
                  .put(`/api/tenants/${req.targetTenantId}/theme`)
                  .set('Authorization', `Bearer ${req.useToken}`)
                  .send({ theme: req.theme })
              )
            );

            // Assert - Property: Each response must have correct authorization status
            for (let i = 0; i < responses.length; i++) {
              const response = responses[i];
              const req = requests[i];
              
              // Determine if request was authorized
              const tokenTenantId = req.useToken === tenant1Token ? tenant1Id : tenant2Id;
              const isAuthorized = tokenTenantId === req.targetTenantId;

              if (isAuthorized) {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
              } else {
                expect(response.status).toBe(403);
                expect(response.body.success).toBe(false);
              }
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
