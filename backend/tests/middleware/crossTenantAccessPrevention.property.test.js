const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const tenantResolver = require('../../middleware/tenantResolver');
const Tenant = require('../../models/Tenant');

/**
 * Property-Based Tests for Cross-Tenant Access Prevention
 * 
 * Feature: unified-nexus-architecture
 * Property 4: Cross-Tenant Access Prevention
 * 
 * For any authenticated user with tenant context A attempting to access data,
 * if the request specifies tenant context B where A ≠ B, the system SHALL
 * reject the request with a 403 Forbidden error, preventing cross-tenant
 * data leakage.
 * 
 * **Validates: Requirements 7.2, 7.6**
 */

// Helper: Generate valid MongoDB ObjectId hex string (24 hex characters)
// Use mongoose to generate unique ObjectIds
const objectIdArbitrary = () => 
  fc.constant(null).map(() => new mongoose.Types.ObjectId().toString());

// Helper: Generate valid tenant slug
const tenantSlugArbitrary = () =>
  fc.string({ minLength: 3, maxLength: 20 })
    .map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
    .filter(s => s.length >= 3);

// Helper: Generate tenant data
const tenantArbitrary = () => fc.record({
  _id: objectIdArbitrary(),
  name: fc.string({ minLength: 3, maxLength: 50 })
    .filter(s => s.trim().length >= 3)
    .map(s => s.trim() || 'Test Tenant'),
  slug: tenantSlugArbitrary(),
  dbName: fc.constant('superkafe_v2'),
  isActive: fc.constant(true),
  status: fc.constantFrom('trial', 'paid')
});

// Helper: Generate user data with tenant association
const userArbitrary = (tenantSlug) => fc.record({
  id: objectIdArbitrary(),
  email: fc.emailAddress(),
  name: fc.string({ minLength: 3, maxLength: 50 })
    .filter(s => s.trim().length >= 3)
    .map(s => s.trim() || 'Test User'),
  tenant: fc.constant(tenantSlug)
});

describe('Cross-Tenant Access Prevention - Property Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear tenant cache before each test
    const { clearTenantCache } = require('../../middleware/tenantResolver');
    clearTenantCache();
  });

  afterEach(async () => {
    await Tenant.deleteMany({});
  });

  /**
   * Property 4: Cross-Tenant Access Prevention
   * 
   * For any authenticated user with tenant context A attempting to access data,
   * if the request specifies tenant context B where A ≠ B, the system SHALL
   * reject the request with a 403 Forbidden error.
   */
  describe('Property 4: Cross-Tenant Access Prevention', () => {
    test('should reject cross-tenant access attempts with 403 Forbidden', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two different tenants
          tenantArbitrary(),
          tenantArbitrary(),
          // Generate request metadata
          fc.record({
            path: fc.constantFrom('/api/menu', '/api/orders', '/api/tables', '/api/employees'),
            method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
            ip: fc.ipV4()
          }),
          async (tenantA, tenantB, requestMeta) => {
            // Clean up before each iteration
            await Tenant.deleteMany({});
            
            // Ensure tenants have different slugs
            if (tenantA.slug === tenantB.slug) {
              tenantB.slug = tenantB.slug + '-different';
            }

            // Create both tenants in database
            const createdTenantA = await Tenant.create({
              _id: new mongoose.Types.ObjectId(tenantA._id),
              name: tenantA.name,
              slug: tenantA.slug,
              dbName: tenantA.dbName,
              isActive: tenantA.isActive,
              status: tenantA.status
            });

            const createdTenantB = await Tenant.create({
              _id: new mongoose.Types.ObjectId(tenantB._id),
              name: tenantB.name,
              slug: tenantB.slug,
              dbName: tenantB.dbName,
              isActive: tenantB.isActive,
              status: tenantB.status
            });

            // Generate user authenticated with tenant A
            const user = fc.sample(userArbitrary(tenantA.slug), 1)[0];

            // Create request where user from tenant A tries to access tenant B
            const req = {
              headers: { 'x-tenant-slug': tenantB.slug }, // Requesting tenant B
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tenant: tenantA.slug // But user belongs to tenant A
              },
              path: requestMeta.path,
              method: requestMeta.method,
              ip: requestMeta.ip
            };

            const res = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn()
            };

            const next = jest.fn();

            // Execute middleware
            await tenantResolver(req, res, next);

            // Property: Must return 403 Forbidden
            expect(res.status).toHaveBeenCalledWith(403);
            
            // Property: Must return CROSS_TENANT_ACCESS error code
            expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: 'Unauthorized access to tenant data',
              code: 'CROSS_TENANT_ACCESS'
            });

            // Property: next() must NOT be called (request blocked)
            expect(next).not.toHaveBeenCalled();

            // Property: req.tenant must NOT be set (access denied)
            expect(req.tenant).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should allow same-tenant access for authenticated users', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantArbitrary(),
          fc.record({
            path: fc.constantFrom('/api/menu', '/api/orders', '/api/tables'),
            method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
            ip: fc.ipV4()
          }),
          async (tenant, requestMeta) => {
            // Clean up before each iteration
            await Tenant.deleteMany({});
            
            // Create tenant in database
            await Tenant.create({
              _id: new mongoose.Types.ObjectId(tenant._id),
              name: tenant.name,
              slug: tenant.slug,
              dbName: tenant.dbName,
              isActive: tenant.isActive,
              status: tenant.status
            });

            // Generate user authenticated with the same tenant
            const user = fc.sample(userArbitrary(tenant.slug), 1)[0];

            // Create request where user accesses their own tenant
            const req = {
              headers: { 'x-tenant-slug': tenant.slug },
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tenant: tenant.slug // User belongs to same tenant
              },
              path: requestMeta.path,
              method: requestMeta.method,
              ip: requestMeta.ip
            };

            const res = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn()
            };

            const next = jest.fn();

            // Execute middleware
            await tenantResolver(req, res, next);

            // Property: Must NOT return error status
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();

            // Property: next() must be called (request allowed)
            expect(next).toHaveBeenCalled();

            // Property: req.tenant must be set correctly
            expect(req.tenant).toBeDefined();
            expect(req.tenant.slug).toBe(tenant.slug);
            expect(req.tenant.dbName).toBe('superkafe_v2');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should allow unauthenticated requests to any tenant', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantArbitrary(),
          fc.record({
            path: fc.constantFrom('/api/menu', '/api/orders'),
            method: fc.constantFrom('GET', 'POST'),
            ip: fc.ipV4()
          }),
          async (tenant, requestMeta) => {
            // Clean up before each iteration
            await Tenant.deleteMany({});
            
            // Create tenant in database
            await Tenant.create({
              _id: new mongoose.Types.ObjectId(tenant._id),
              name: tenant.name,
              slug: tenant.slug,
              dbName: tenant.dbName,
              isActive: tenant.isActive,
              status: tenant.status
            });

            // Create request without user (unauthenticated)
            const req = {
              headers: { 'x-tenant-slug': tenant.slug },
              // No req.user - unauthenticated request
              path: requestMeta.path,
              method: requestMeta.method,
              ip: requestMeta.ip
            };

            const res = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn()
            };

            const next = jest.fn();

            // Execute middleware
            await tenantResolver(req, res, next);

            // Property: Must NOT return error status
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();

            // Property: next() must be called (request allowed)
            expect(next).toHaveBeenCalled();

            // Property: req.tenant must be set correctly
            expect(req.tenant).toBeDefined();
            expect(req.tenant.slug).toBe(tenant.slug);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should prevent cross-tenant access across multiple tenant pairs', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of tenants
          fc.array(tenantArbitrary(), { minLength: 3, maxLength: 6 }),
          fc.nat({ max: 100 }), // Index for selecting user tenant
          fc.nat({ max: 100 }), // Index for selecting requested tenant
          async (tenants, userTenantIndex, requestedTenantIndex) => {
            if (tenants.length < 2) return true;

            // Clean up before each iteration
            await Tenant.deleteMany({});

            // Ensure unique slugs
            const uniqueSlugs = new Set();
            tenants.forEach((tenant, idx) => {
              while (uniqueSlugs.has(tenant.slug)) {
                tenant.slug = tenant.slug + `-${idx}`;
              }
              uniqueSlugs.add(tenant.slug);
            });

            // Create all tenants in database
            await Promise.all(
              tenants.map(tenant =>
                Tenant.create({
                  _id: new mongoose.Types.ObjectId(tenant._id),
                  name: tenant.name,
                  slug: tenant.slug,
                  dbName: tenant.dbName,
                  isActive: tenant.isActive,
                  status: tenant.status
                })
              )
            );

            // Select user's tenant and requested tenant
            const userTenant = tenants[userTenantIndex % tenants.length];
            const requestedTenant = tenants[requestedTenantIndex % tenants.length];

            // Generate user
            const user = fc.sample(userArbitrary(userTenant.slug), 1)[0];

            // Create request
            const req = {
              headers: { 'x-tenant-slug': requestedTenant.slug },
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tenant: userTenant.slug
              },
              path: '/api/menu',
              method: 'GET',
              ip: '127.0.0.1'
            };

            const res = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn()
            };

            const next = jest.fn();

            // Execute middleware
            await tenantResolver(req, res, next);

            // Property: If user tenant != requested tenant, must return 403
            if (userTenant.slug !== requestedTenant.slug) {
              expect(res.status).toHaveBeenCalledWith(403);
              expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Unauthorized access to tenant data',
                code: 'CROSS_TENANT_ACCESS'
              });
              expect(next).not.toHaveBeenCalled();
              expect(req.tenant).toBeUndefined();
            } else {
              // If same tenant, must allow access
              expect(res.status).not.toHaveBeenCalled();
              expect(next).toHaveBeenCalled();
              expect(req.tenant).toBeDefined();
              expect(req.tenant.slug).toBe(userTenant.slug);
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should handle case-insensitive tenant slug matching in cross-tenant checks', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantArbitrary(),
          tenantArbitrary(),
          fc.constantFrom('upper', 'lower', 'mixed'),
          async (tenantA, tenantB, caseVariation) => {
            // Clean up before each iteration
            await Tenant.deleteMany({});
            
            // Ensure different slugs
            if (tenantA.slug === tenantB.slug) {
              tenantB.slug = tenantB.slug + '-different';
            }

            // Create tenants
            await Tenant.create({
              _id: new mongoose.Types.ObjectId(tenantA._id),
              name: tenantA.name,
              slug: tenantA.slug.toLowerCase(),
              dbName: tenantA.dbName,
              isActive: tenantA.isActive,
              status: tenantA.status
            });

            await Tenant.create({
              _id: new mongoose.Types.ObjectId(tenantB._id),
              name: tenantB.name,
              slug: tenantB.slug.toLowerCase(),
              dbName: tenantB.dbName,
              isActive: tenantB.isActive,
              status: tenantB.status
            });

            // Generate user with tenant A
            const user = fc.sample(userArbitrary(tenantA.slug.toLowerCase()), 1)[0];

            // Vary the case of requested tenant slug
            let requestedSlug = tenantB.slug;
            if (caseVariation === 'upper') {
              requestedSlug = tenantB.slug.toUpperCase();
            } else if (caseVariation === 'mixed') {
              requestedSlug = tenantB.slug
                .split('')
                .map((c, i) => i % 2 === 0 ? c.toUpperCase() : c.toLowerCase())
                .join('');
            }

            // Create request
            const req = {
              headers: { 'x-tenant-slug': requestedSlug },
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tenant: tenantA.slug.toLowerCase()
              },
              path: '/api/menu',
              method: 'GET',
              ip: '127.0.0.1'
            };

            const res = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn()
            };

            const next = jest.fn();

            // Execute middleware
            await tenantResolver(req, res, next);

            // Property: Must reject regardless of case variation
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: 'Unauthorized access to tenant data',
              code: 'CROSS_TENANT_ACCESS'
            });
            expect(next).not.toHaveBeenCalled();

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should prevent cross-tenant access for all HTTP methods', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantArbitrary(),
          tenantArbitrary(),
          fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
          fc.constantFrom('/api/menu', '/api/orders', '/api/tables', '/api/employees', '/api/reports'),
          async (tenantA, tenantB, method, path) => {
            // Clean up before each iteration
            await Tenant.deleteMany({});
            
            // Ensure different slugs
            if (tenantA.slug === tenantB.slug) {
              tenantB.slug = tenantB.slug + '-diff';
            }

            // Create tenants
            await Tenant.create({
              _id: new mongoose.Types.ObjectId(tenantA._id),
              name: tenantA.name,
              slug: tenantA.slug,
              dbName: tenantA.dbName,
              isActive: tenantA.isActive,
              status: tenantA.status
            });

            await Tenant.create({
              _id: new mongoose.Types.ObjectId(tenantB._id),
              name: tenantB.name,
              slug: tenantB.slug,
              dbName: tenantB.dbName,
              isActive: tenantB.isActive,
              status: tenantB.status
            });

            // Generate user with tenant A
            const user = fc.sample(userArbitrary(tenantA.slug), 1)[0];

            // Create request for tenant B
            const req = {
              headers: { 'x-tenant-slug': tenantB.slug },
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tenant: tenantA.slug
              },
              path,
              method,
              ip: '127.0.0.1'
            };

            const res = {
              status: jest.fn().mockReturnThis(),
              json: jest.fn()
            };

            const next = jest.fn();

            // Execute middleware
            await tenantResolver(req, res, next);

            // Property: Must reject for all HTTP methods
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
              success: false,
              message: 'Unauthorized access to tenant data',
              code: 'CROSS_TENANT_ACCESS'
            });
            expect(next).not.toHaveBeenCalled();

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
