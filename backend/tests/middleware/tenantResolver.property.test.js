const fc = require('fast-check');
const tenantResolver = require('../../middleware/tenantResolver');
const Tenant = require('../../models/Tenant');
const { setTenantContext } = require('../../utils/tenantContext');

// Mock dependencies
jest.mock('../../models/Tenant');
jest.mock('../../utils/tenantContext');

/**
 * Property-Based Tests for tenantResolver Middleware
 * Feature: unified-nexus-architecture
 * 
 * These tests verify that the middleware correctly attaches tenant context
 * across a wide range of randomized inputs.
 */
describe('tenantResolver Middleware - Property-Based Tests', () => {
  let res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear tenant cache before each test
    const { clearTenantCache } = require('../../middleware/tenantResolver');
    clearTenantCache();

    // Setup response and next function
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();
  });

  /**
   * Property 5: Tenant Resolver Header Extraction
   * **Validates: Requirements 3.1, 3.3, 3.6**
   * 
   * For any HTTP request to a tenant-scoped endpoint, the tenant resolver
   * SHALL extract the tenant slug from the x-tenant-slug header, validate it
   * against the tenants collection, and store the tenant context in AsyncLocalStorage
   * if valid and active.
   */
  describe('Property 5: Tenant Resolver Header Extraction', () => {
    it('should attach req.tenant and call setTenantContext for any valid tenant request', async () => {
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
            dbName: fc.constant('superkafe_v2'), // Always unified database
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
            const req = {
              headers: { 'x-tenant-slug': mockTenant.slug },
              path: requestMeta.path,
              method: requestMeta.method,
              ip: requestMeta.ip
            };

            Tenant.findOne.mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockTenant)
            });

            // Act
            await tenantResolver(req, res, next);

            // Assert - Property: req.tenant must be populated with correct structure
            expect(req.tenant).toBeDefined();
            expect(req.tenant).toHaveProperty('id', mockTenant._id.toString());
            expect(req.tenant).toHaveProperty('name', mockTenant.name);
            expect(req.tenant).toHaveProperty('slug', mockTenant.slug);
            expect(req.tenant).toHaveProperty('dbName', 'superkafe_v2');

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
            dbName: fc.constant('superkafe_v2'),
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

            const req = {
              headers: { 'x-tenant-slug': requestSlug },
              path: '/api/test',
              method: 'GET',
              ip: '127.0.0.1'
            };

            // Mock should be called with lowercase slug
            Tenant.findOne.mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockTenant)
            });

            // Act
            await tenantResolver(req, res, next);

            // Assert - Property: Tenant should be resolved regardless of case
            expect(Tenant.findOne).toHaveBeenCalledWith({
              slug: requestSlug.toLowerCase(),
              isActive: true
            });
            expect(req.tenant).toBeDefined();
            expect(req.tenant.dbName).toBe('superkafe_v2');
            expect(next).toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject requests without x-tenant-slug header', async () => {
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
              headers: {}, // No x-tenant-slug header
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
              message: 'Header x-tenant-slug atau x-tenant-id wajib disertakan',
              code: 'TENANT_HEADER_MISSING'
            });
            expect(next).not.toHaveBeenCalled();
            expect(req.tenant).toBeUndefined();
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
              headers: { 'x-tenant-slug': tenantSlug },
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
              message: 'Tenant tidak ditemukan atau tidak aktif',
              code: 'TENANT_NOT_FOUND'
            });
            expect(next).not.toHaveBeenCalled();
            expect(req.tenant).toBeUndefined();
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
              headers: { 'x-tenant-slug': slug },
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
              message: 'Terjadi kesalahan saat memproses tenant',
              code: 'TENANT_RESOLUTION_ERROR'
            });
            expect(next).not.toHaveBeenCalled();
            expect(req.tenant).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
