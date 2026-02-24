/**
 * Property-Based Test: Error Message Clarity
 * Feature: unified-nexus-architecture
 * Property 10: Error Message Clarity
 * 
 * **Validates: Requirements 10.6**
 * 
 * Property Statement:
 * For any error condition related to tenant context (missing context, invalid tenant,
 * cross-tenant access), the system SHALL provide a clear error message indicating
 * the specific tenant context problem.
 */

const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Tenant = require('../../models/Tenant');
const tenantResolver = require('../../middleware/tenantResolver');
const { setTenantContext, getTenantContext } = require('../../utils/tenantContext');

describe('Property 10: Error Message Clarity', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Tenant.deleteMany({});
    // Clear jest mocks
    jest.clearAllMocks();
  });

  /**
   * Property: Error messages for tenant context problems are clear and specific
   */
  it('should provide clear error messages for all tenant context error conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          errorType: fc.constantFrom(
            'MISSING_HEADER',
            'INVALID_TENANT',
            'INACTIVE_TENANT',
            'CROSS_TENANT_ACCESS'
          ),
          tenantSlug: fc.stringMatching(/^[a-z0-9-]{4,20}$/),
          userTenant: fc.stringMatching(/^[a-z0-9-]{4,20}$/)
        }),
        async ({ errorType, tenantSlug, userTenant }) => {
          let req, res, next;
          let responseData = null;
          let statusCode = null;

          // Setup mock request and response
          res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn((data) => {
              responseData = data;
              return res;
            })
          };
          next = jest.fn();

          // Test different error conditions
          switch (errorType) {
            case 'MISSING_HEADER':
              // Test missing tenant header
              req = {
                headers: {},
                path: '/api/test',
                method: 'GET',
                ip: '127.0.0.1'
              };
              
              await tenantResolver(req, res, next);
              
              // Verify error response
              expect(res.status).toHaveBeenCalledWith(400);
              expect(responseData).toBeDefined();
              expect(responseData.success).toBe(false);
              expect(responseData.code).toBe('TENANT_HEADER_MISSING');
              expect(responseData.message).toBeDefined();
              expect(responseData.message.toLowerCase()).toContain('tenant');
              expect(responseData.message.toLowerCase()).toContain('header');
              break;

            case 'INVALID_TENANT':
              // Test invalid tenant slug
              req = {
                headers: { 'x-tenant-slug': tenantSlug },
                path: '/api/test',
                method: 'GET',
                ip: '127.0.0.1'
              };
              
              await tenantResolver(req, res, next);
              
              // Verify error response
              expect(res.status).toHaveBeenCalledWith(404);
              expect(responseData).toBeDefined();
              expect(responseData.success).toBe(false);
              expect(responseData.code).toBe('TENANT_NOT_FOUND');
              expect(responseData.message).toBeDefined();
              expect(responseData.message.toLowerCase()).toContain('tenant');
              break;

            case 'INACTIVE_TENANT':
              // Create inactive tenant with unique slug
              const uniqueSlug = `${tenantSlug.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
              const inactiveTenant = await Tenant.create({
                name: 'Inactive Tenant',
                slug: uniqueSlug,
                dbName: 'superkafe_v2',
                isActive: false,
                status: 'trial'
              });
              
              req = {
                headers: { 'x-tenant-slug': uniqueSlug },
                path: '/api/test',
                method: 'GET',
                ip: '127.0.0.1'
              };
              
              await tenantResolver(req, res, next);
              
              // Verify error response
              expect(res.status).toHaveBeenCalledWith(403);
              expect(responseData).toBeDefined();
              expect(responseData.success).toBe(false);
              expect(responseData.code).toBe('TENANT_INACTIVE');
              expect(responseData.message).toBeDefined();
              expect(responseData.message.toLowerCase()).toContain('tenant');
              break;

            case 'CROSS_TENANT_ACCESS':
              // Create two tenants with unique slugs
              const uniqueSlug1 = `${tenantSlug.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
              const uniqueSlug2 = `${userTenant.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
              
              const tenant1 = await Tenant.create({
                name: 'Tenant 1',
                slug: uniqueSlug1,
                dbName: 'superkafe_v2',
                isActive: true,
                status: 'trial'
              });
              
              const tenant2 = await Tenant.create({
                name: 'Tenant 2',
                slug: uniqueSlug2,
                dbName: 'superkafe_v2',
                isActive: true,
                status: 'trial'
              });
              
              // User from tenant2 trying to access tenant1
              req = {
                headers: { 'x-tenant-slug': uniqueSlug1 },
                path: '/api/test',
                method: 'GET',
                ip: '127.0.0.1',
                user: {
                  id: 'user123',
                  email: 'user@test.com',
                  tenant: uniqueSlug2
                }
              };
              
              await tenantResolver(req, res, next);
              
              // Verify error response
              expect(res.status).toHaveBeenCalledWith(403);
              expect(responseData).toBeDefined();
              expect(responseData.success).toBe(false);
              expect(responseData.code).toBe('CROSS_TENANT_ACCESS');
              expect(responseData.message).toBeDefined();
              expect(responseData.message.toLowerCase()).toContain('access');
              break;
          }

          // All error responses should have these properties
          expect(responseData).toHaveProperty('success');
          expect(responseData).toHaveProperty('message');
          expect(responseData).toHaveProperty('code');
          expect(responseData.success).toBe(false);
          expect(responseData.message).toBeTruthy();
          expect(responseData.code).toBeTruthy();
          
          // Error message should be descriptive (not just a code)
          expect(responseData.message.length).toBeGreaterThan(10);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Error codes are consistent and machine-readable
   */
  it('should provide consistent error codes for tenant context errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z0-9-]{4,20}$/),
        async (tenantSlug) => {
          const errorCodes = new Set();
          
          // Test missing header multiple times
          for (let i = 0; i < 3; i++) {
            const req = {
              headers: {},
              path: '/api/test',
              method: 'GET',
              ip: '127.0.0.1'
            };
            
            const res = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn()
            };
            
            await tenantResolver(req, res, jest.fn());
            
            const responseData = res.json.mock.calls[0][0];
            errorCodes.add(responseData.code);
          }
          
          // Error code should be consistent across multiple calls
          expect(errorCodes.size).toBe(1);
          expect(Array.from(errorCodes)[0]).toBe('TENANT_HEADER_MISSING');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Error messages do not leak sensitive information
   */
  it('should not leak sensitive information in error messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantSlug: fc.stringMatching(/^[a-z0-9-]{4,20}$/),
          userId: fc.uuid(),
          userEmail: fc.emailAddress()
        }),
        async ({ tenantSlug, userId, userEmail }) => {
          // Create tenant with unique slug
          const uniqueSlug = `${tenantSlug.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const tenant = await Tenant.create({
            name: 'Test Tenant',
            slug: uniqueSlug,
            dbName: 'superkafe_v2',
            isActive: true,
            status: 'trial'
          });
          
          // Test cross-tenant access
          const req = {
            headers: { 'x-tenant-slug': uniqueSlug },
            path: '/api/test',
            method: 'GET',
            ip: '127.0.0.1',
            user: {
              id: userId,
              email: userEmail,
              tenant: 'different-tenant'
            }
          };
          
          const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
          };
          
          await tenantResolver(req, res, jest.fn());
          
          const responseData = res.json.mock.calls[0][0];
          
          // Error message should not contain sensitive data
          expect(responseData.message).not.toContain(userId);
          expect(responseData.message).not.toContain(userEmail);
          expect(responseData.message).not.toContain('ObjectId');
          expect(responseData.message).not.toContain('_id');
        }
      ),
      { numRuns: 50 }
    );
  });
});
