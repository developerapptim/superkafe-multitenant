const fc = require('fast-check');
const tenantResolver = require('../../middleware/tenantResolver');
const Tenant = require('../../models/Tenant');
const { getTenantDB } = require('../../config/db');
const { setTenantContext } = require('../../utils/tenantContext');

// Mock dependencies
jest.mock('../../models/Tenant');
jest.mock('../../config/db');
jest.mock('../../utils/tenantContext');

/**
 * Property-Based Tests for tenantResolver Middleware
 * Feature: tenant-data-isolation
 * 
 * These tests verify that the middleware correctly attaches tenant context
 * across a wide range of randomized inputs.
 */
describe('tenantResolver Middleware - Property-Based Tests', () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup response and next function
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();
  });

  /**
   * Property 17: Middleware Attaches Tenant Context
   * **Validates: Requirements 3.3, 3.4**
   * 
   * For any request processed by the tenantResolver middleware,
   * the request object should have both req.tenant (metadata) and
   * req.tenantDB (connection) populated.
   */
  describe('Property 17: Middleware Attaches Tenant Context', () => {
    it('should attach both req.tenant and req.tenantDB for any valid tenant request', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary tenant data
          fc.record({
            _id: fc.array(fc.constantFrom('0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'), { minLength: 24, maxLength: 24 }).map(arr => arr.join('')),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            slug: fc.string({ 
              minLength: 3, 
              maxLength: 50 
            }).map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-')).filter(s => s.length >= 3),
            dbName: fc.string({ minLength: 5, maxLength: 50 })
              .map(s => `tenant_${s.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`),
            isActive: fc.constant(true)
          }),
          // Generate arbitrary request metadata
          fc.record({
            path: fc.oneof(
              fc.constant('/api/menu'),
              fc.constant('/api/orders'),
              fc.constant('/api/employees'),
              fc.string({ minLength: 1, maxLength: 50 }).map(s => `/api/${s}`)
            ),
            method: fc.oneof(
              fc.constant('GET'),
              fc.constant('POST'),
              fc.constant('PUT'),
              fc.constant('DELETE')
            ),
            ip: fc.ipV4()
          }),
          async (mockTenant, requestMeta) => {
            // Arrange
            const mockTenantDB = {
              name: mockTenant.dbName,
              host: 'localhost',
              port: 27017,
              readyState: 1
            };

            const req = {
              headers: { 'x-tenant-id': mockTenant.slug },
              path: requestMeta.path,
              method: requestMeta.method,
              ip: requestMeta.ip
            };

            Tenant.findOne.mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockTenant)
            });
            getTenantDB.mockResolvedValue(mockTenantDB);

            // Act
            await tenantResolver(req, res, next);

            // Assert - Property: req.tenant must be populated with correct structure
            expect(req.tenant).toBeDefined();
            expect(req.tenant).toHaveProperty('id', mockTenant._id);
            expect(req.tenant).toHaveProperty('name', mockTenant.name);
            expect(req.tenant).toHaveProperty('slug', mockTenant.slug);
            expect(req.tenant).toHaveProperty('dbName', mockTenant.dbName);

            // Assert - Property: req.tenantDB must be populated
            expect(req.tenantDB).toBeDefined();
            expect(req.tenantDB).toBe(mockTenantDB);

            // Assert - Property: setTenantContext must be called with tenant metadata
            expect(setTenantContext).toHaveBeenCalledWith(req.tenant);

            // Assert - Property: next() must be called to continue middleware chain
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 } // Run 100 iterations with different random inputs
      );
    });

    it('should handle case-insensitive tenant slug matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate tenant with mixed-case slug
          fc.record({
            _id: fc.array(fc.constantFrom('0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'), { minLength: 24, maxLength: 24 }).map(arr => arr.join('')),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            slug: fc.string({ 
              minLength: 3, 
              maxLength: 20 
            }).map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-')).filter(s => s.length >= 3),
            dbName: fc.string({ minLength: 5, maxLength: 50 })
              .map(s => `tenant_${s.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`),
            isActive: fc.constant(true)
          }),
          // Generate case variations of the slug
          fc.constantFrom('upper', 'lower', 'mixed'),
          async (mockTenant, caseVariation) => {
            // Arrange
            let requestSlug = mockTenant.slug;
            if (caseVariation === 'upper') {
              requestSlug = mockTenant.slug.toUpperCase();
            } else if (caseVariation === 'mixed') {
              requestSlug = mockTenant.slug
                .split('')
                .map((c, i) => i % 2 === 0 ? c.toUpperCase() : c.toLowerCase())
                .join('');
            }

            const mockTenantDB = {
              name: mockTenant.dbName,
              host: 'localhost',
              port: 27017,
              readyState: 1
            };

            const req = {
              headers: { 'x-tenant-id': requestSlug },
              path: '/api/test',
              method: 'GET',
              ip: '127.0.0.1'
            };

            // Mock should be called with lowercase slug
            Tenant.findOne.mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockTenant)
            });
            getTenantDB.mockResolvedValue(mockTenantDB);

            // Act
            await tenantResolver(req, res, next);

            // Assert - Property: Tenant should be resolved regardless of case
            expect(Tenant.findOne).toHaveBeenCalledWith({
              slug: requestSlug.toLowerCase(),
              isActive: true
            });
            expect(req.tenant).toBeDefined();
            expect(req.tenantDB).toBeDefined();
            expect(next).toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject requests without x-tenant-id header', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary request metadata without tenant header
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 50 }).map(s => `/api/${s}`),
            method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
            ip: fc.ipV4()
          }),
          async (requestMeta) => {
            // Arrange
            const req = {
              headers: {}, // No x-tenant-id header
              path: requestMeta.path,
              method: requestMeta.method,
              ip: requestMeta.ip
            };

            // Act
            await tenantResolver(req, res, next);

            // Assert - Property: Must return 400 error
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: 'Header x-tenant-id wajib disertakan'
            });
            expect(next).not.toHaveBeenCalled();
            expect(req.tenant).toBeUndefined();
            expect(req.tenantDB).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject requests for inactive or non-existent tenants', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary tenant slug
          fc.string({ 
            minLength: 3, 
            maxLength: 50 
          }).map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-')),
          async (tenantSlug) => {
            // Arrange
            const req = {
              headers: { 'x-tenant-id': tenantSlug },
              path: '/api/test',
              method: 'GET',
              ip: '127.0.0.1'
            };

            // Mock tenant not found
            Tenant.findOne.mockReturnValue({
              lean: jest.fn().mockResolvedValue(null)
            });

            // Act
            await tenantResolver(req, res, next);

            // Assert - Property: Must return 404 error
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: 'Tenant tidak ditemukan atau tidak aktif'
            });
            expect(next).not.toHaveBeenCalled();
            expect(req.tenant).toBeUndefined();
            expect(req.tenantDB).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle database errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary tenant slug and error message
          fc.record({
            slug: fc.string({ 
              minLength: 3, 
              maxLength: 50 
            }).map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-')),
            errorMessage: fc.string({ minLength: 5, maxLength: 100 })
          }),
          async ({ slug, errorMessage }) => {
            // Arrange
            const req = {
              headers: { 'x-tenant-id': slug },
              path: '/api/test',
              method: 'GET',
              ip: '127.0.0.1'
            };

            // Mock database error
            Tenant.findOne.mockReturnValue({
              lean: jest.fn().mockRejectedValue(new Error(errorMessage))
            });

            // Act
            await tenantResolver(req, res, next);

            // Assert - Property: Must return 500 error with generic message
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: 'Terjadi kesalahan saat memproses tenant'
            });
            expect(next).not.toHaveBeenCalled();
            expect(req.tenant).toBeUndefined();
            expect(req.tenantDB).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
