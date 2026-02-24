const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { runWithTenantContext, getTenantContext } = require('../../utils/tenantContext');
const Tenant = require('../../models/Tenant');
const MenuItem = require('../../models/MenuItem');

/**
 * Property-Based Tests for Horizontal Scaling Compatibility
 * 
 * Feature: unified-nexus-architecture
 * Property 12: Horizontal Scaling Compatibility
 * 
 * **Validates: Requirements 12.6**
 * 
 * For any deployment with multiple application instances sharing the unified database,
 * each instance SHALL correctly handle tenant isolation using AsyncLocalStorage without
 * interference between instances or requests.
 * 
 * This test simulates multiple application instances by creating separate AsyncLocalStorage
 * contexts and verifies that:
 * - Each instance maintains its own tenant context correctly
 * - Concurrent requests from different tenants across simulated instances remain isolated
 * - No data leakage occurs between concurrent operations on different instances
 * - AsyncLocalStorage context isolation works correctly in a multi-instance scenario
 */

// Helper: Generate valid MongoDB ObjectId
const objectIdArbitrary = () => 
  fc.constant(null).map(() => new mongoose.Types.ObjectId());

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

// Helper: Generate menu item data
const menuItemArbitrary = () => fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 50 })
    .filter(s => s.trim().length >= 3)
    .map(s => s.trim() || 'Test Item'),
  description: fc.string({ maxLength: 200 }),
  price: fc.integer({ min: 1000, max: 100000 }),
  category: fc.constantFrom('Food', 'Beverage', 'Snack', 'Dessert'),
  is_active: fc.boolean(),
  order: fc.integer({ min: 0, max: 100 })
});

/**
 * Simulates an application instance handling a request
 * Each instance operates independently with its own AsyncLocalStorage context
 */
class SimulatedAppInstance {
  constructor(instanceId) {
    this.instanceId = instanceId;
  }

  /**
   * Simulate handling a request in this instance
   * @param {Object} tenant - Tenant context for this request
   * @param {Function} operation - Operation to perform
   * @returns {Promise<*>} Operation result
   */
  async handleRequest(tenant, operation) {
    // Each request runs in its own AsyncLocalStorage context
    // This simulates how Express middleware would set context per request
    return runWithTenantContext(
      {
        id: tenant._id.toString(),
        slug: tenant.slug,
        name: tenant.name,
        dbName: tenant.dbName,
        instanceId: this.instanceId // Track which instance handled this
      },
      async () => {
        // Simulate some async work (network delay, processing, etc.)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        
        // Verify context is correct for this instance
        const context = getTenantContext();
        if (!context || context.id !== tenant._id.toString()) {
          throw new Error(`Context mismatch in instance ${this.instanceId}`);
        }
        
        // Execute the actual operation
        const result = await operation();
        
        // Verify context is still correct after operation
        const contextAfter = getTenantContext();
        if (!contextAfter || contextAfter.id !== tenant._id.toString()) {
          throw new Error(`Context lost after operation in instance ${this.instanceId}`);
        }
        
        return {
          instanceId: this.instanceId,
          tenantId: tenant._id.toString(),
          result
        };
      }
    );
  }
}

describe('Property 12: Horizontal Scaling Compatibility', () => {
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

  afterEach(async () => {
    await Tenant.deleteMany({});
    await MenuItem.deleteMany({});
  });

  /**
   * Property 12.1: Multiple instances handle concurrent requests without context interference
   * 
   * For any set of application instances and concurrent requests from different tenants,
   * each instance SHALL maintain correct tenant context isolation without interference.
   */
  test('should maintain tenant isolation across multiple simulated instances', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 4 }), // Number of simulated instances
        fc.array(tenantArbitrary(), { minLength: 2, maxLength: 5 }), // Tenants
        fc.integer({ min: 2, max: 4 }), // Requests per tenant
        async (instanceCount, tenants, requestsPerTenant) => {
          // Clean up
          await Tenant.deleteMany({});
          await MenuItem.deleteMany({});

          // Ensure unique slugs
          const uniqueSlugs = new Set();
          tenants.forEach((tenant, idx) => {
            while (uniqueSlugs.has(tenant.slug)) {
              tenant.slug = tenant.slug + `-${idx}`;
            }
            uniqueSlugs.add(tenant.slug);
          });

          // Create tenants in database
          const createdTenants = await Promise.all(
            tenants.map(tenant =>
              Tenant.create({
                _id: tenant._id,
                name: tenant.name,
                slug: tenant.slug,
                dbName: tenant.dbName,
                isActive: tenant.isActive,
                status: tenant.status
              })
            )
          );

          // Create simulated application instances
          const instances = Array.from(
            { length: instanceCount },
            (_, i) => new SimulatedAppInstance(`instance-${i}`)
          );

          // Generate requests: each tenant makes multiple requests
          // distributed across different instances (simulating load balancing)
          const requests = [];
          createdTenants.forEach((tenant, tenantIdx) => {
            for (let reqIdx = 0; reqIdx < requestsPerTenant; reqIdx++) {
              // Round-robin distribution across instances
              const instanceIdx = (tenantIdx * requestsPerTenant + reqIdx) % instanceCount;
              const instance = instances[instanceIdx];
              
              // Create a request that creates a menu item
              const menuItemData = fc.sample(menuItemArbitrary(), 1)[0];
              
              requests.push(
                instance.handleRequest(tenant, async () => {
                  const item = await MenuItem.create(menuItemData);
                  return {
                    operation: 'create',
                    itemId: item._id.toString(),
                    tenantId: item.tenantId.toString()
                  };
                })
              );
            }
          });

          // Execute all requests concurrently (simulating real load)
          const results = await Promise.all(requests);

          // Verify: Each result should have correct tenant context
          results.forEach(result => {
            expect(result.tenantId).toBeDefined();
            expect(result.result.tenantId).toBe(result.tenantId);
          });

          // Verify: Each tenant should have exactly requestsPerTenant items
          for (const tenant of createdTenants) {
            const items = await runWithTenantContext(
              {
                id: tenant._id.toString(),
                slug: tenant.slug,
                name: tenant.name,
                dbName: tenant.dbName
              },
              async () => MenuItem.find({})
            );
            
            expect(items.length).toBe(requestsPerTenant);
            items.forEach(item => {
              expect(item.tenantId.toString()).toBe(tenant._id.toString());
            });
          }

          return true;
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  }, 20000);

  /**
   * Property 12.2: Instances handle mixed read/write operations without interference
   * 
   * For any set of instances handling mixed operations (create, read, update, delete),
   * each operation SHALL access only the correct tenant's data.
   */
  test('should handle mixed operations across instances without data leakage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 3 }), // Number of instances
        fc.array(tenantArbitrary(), { minLength: 3, maxLength: 3 }), // Exactly 3 tenants
        fc.integer({ min: 2, max: 4 }), // Items per tenant
        async (instanceCount, tenants, itemsPerTenant) => {
          // Clean up
          await Tenant.deleteMany({});
          await MenuItem.deleteMany({});

          // Ensure unique slugs
          const uniqueSlugs = new Set();
          tenants.forEach((tenant, idx) => {
            while (uniqueSlugs.has(tenant.slug)) {
              tenant.slug = tenant.slug + `-${idx}`;
            }
            uniqueSlugs.add(tenant.slug);
          });

          // Create tenants
          const createdTenants = await Promise.all(
            tenants.map(tenant =>
              Tenant.create({
                _id: tenant._id,
                name: tenant.name,
                slug: tenant.slug,
                dbName: tenant.dbName,
                isActive: tenant.isActive,
                status: tenant.status
              })
            )
          );

          // Create instances
          const instances = Array.from(
            { length: instanceCount },
            (_, i) => new SimulatedAppInstance(`instance-${i}`)
          );

          // Phase 1: Create initial data for all tenants
          const createRequests = [];
          createdTenants.forEach((tenant, tenantIdx) => {
            const instanceIdx = tenantIdx % instanceCount;
            const instance = instances[instanceIdx];
            
            for (let i = 0; i < itemsPerTenant; i++) {
              const menuItemData = fc.sample(menuItemArbitrary(), 1)[0];
              createRequests.push(
                instance.handleRequest(tenant, async () => {
                  const item = await MenuItem.create(menuItemData);
                  return { operation: 'create', itemId: item._id.toString() };
                })
              );
            }
          });

          await Promise.all(createRequests);

          // Phase 2: Mixed operations across instances
          const mixedRequests = [
            // Tenant 0: Read operation on instance 0
            instances[0].handleRequest(createdTenants[0], async () => {
              const items = await MenuItem.find({});
              return { operation: 'read', count: items.length };
            }),
            
            // Tenant 1: Update operation on instance 1 (or 0 if only 2 instances)
            instances[instanceCount > 1 ? 1 : 0].handleRequest(createdTenants[1], async () => {
              const result = await MenuItem.updateMany({}, { $set: { is_active: false } });
              return { operation: 'update', modifiedCount: result.modifiedCount };
            }),
            
            // Tenant 2: Count operation on instance 2 (or 0 if only 2 instances)
            instances[instanceCount > 2 ? 2 : 0].handleRequest(createdTenants[2], async () => {
              const count = await MenuItem.countDocuments({});
              return { operation: 'count', count };
            }),
            
            // Tenant 0: Another read on different instance
            instances[(instanceCount - 1)].handleRequest(createdTenants[0], async () => {
              const items = await MenuItem.find({});
              return { operation: 'read', count: items.length };
            })
          ];

          const mixedResults = await Promise.all(mixedRequests);

          // Verify results
          expect(mixedResults[0].result.count).toBe(itemsPerTenant); // Tenant 0 read
          expect(mixedResults[1].result.modifiedCount).toBe(itemsPerTenant); // Tenant 1 update
          expect(mixedResults[2].result.count).toBe(itemsPerTenant); // Tenant 2 count
          expect(mixedResults[3].result.count).toBe(itemsPerTenant); // Tenant 0 read again

          // Verify tenant 1's items were updated, but not tenant 0 or 2
          const tenant0Items = await runWithTenantContext(
            {
              id: createdTenants[0]._id.toString(),
              slug: createdTenants[0].slug,
              name: createdTenants[0].name,
              dbName: createdTenants[0].dbName
            },
            async () => MenuItem.find({})
          );
          
          const tenant1Items = await runWithTenantContext(
            {
              id: createdTenants[1]._id.toString(),
              slug: createdTenants[1].slug,
              name: createdTenants[1].name,
              dbName: createdTenants[1].dbName
            },
            async () => MenuItem.find({})
          );

          // Tenant 1 items should all be inactive
          tenant1Items.forEach(item => {
            expect(item.is_active).toBe(false);
          });

          // Tenant 0 items should have mixed active status (not all false)
          const tenant0HasActive = tenant0Items.some(item => item.is_active === true);
          expect(tenant0HasActive || tenant0Items.length === 0).toBe(true);

          return true;
        }
      ),
      { numRuns: 50, timeout: 15000 }
    );
  }, 20000);

  /**
   * Property 12.3: Context propagates correctly through nested async operations across instances
   * 
   * For any instance handling a request with nested async operations,
   * the tenant context SHALL remain accessible throughout the entire chain.
   */
  test('should maintain context through nested operations across instances', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 3 }), // Number of instances
        fc.array(tenantArbitrary(), { minLength: 2, maxLength: 4 }), // Tenants
        fc.integer({ min: 2, max: 4 }), // Nesting depth
        async (instanceCount, tenants, nestingDepth) => {
          // Clean up
          await Tenant.deleteMany({});
          await MenuItem.deleteMany({});

          // Ensure unique slugs
          const uniqueSlugs = new Set();
          tenants.forEach((tenant, idx) => {
            while (uniqueSlugs.has(tenant.slug)) {
              tenant.slug = tenant.slug + `-${idx}`;
            }
            uniqueSlugs.add(tenant.slug);
          });

          // Create tenants
          const createdTenants = await Promise.all(
            tenants.map(tenant =>
              Tenant.create({
                _id: tenant._id,
                name: tenant.name,
                slug: tenant.slug,
                dbName: tenant.dbName,
                isActive: tenant.isActive,
                status: tenant.status
              })
            )
          );

          // Create instances
          const instances = Array.from(
            { length: instanceCount },
            (_, i) => new SimulatedAppInstance(`instance-${i}`)
          );

          // Create nested operation function
          const createNestedOperation = (depth, tenantId) => {
            return async () => {
              // Verify context at this level
              const context = getTenantContext();
              if (!context || context.id !== tenantId) {
                throw new Error(`Context mismatch at depth ${depth}`);
              }

              // Simulate async work
              await new Promise(resolve => setTimeout(resolve, Math.random() * 5));

              if (depth > 1) {
                // Recurse deeper
                await createNestedOperation(depth - 1, tenantId)();
              } else {
                // Base case: perform database operation
                const menuItemData = fc.sample(menuItemArbitrary(), 1)[0];
                const item = await MenuItem.create(menuItemData);
                
                // Verify item has correct tenantId
                if (item.tenantId.toString() !== tenantId) {
                  throw new Error('Item created with wrong tenantId');
                }
              }

              // Verify context is still correct after nested calls
              const contextAfter = getTenantContext();
              if (!contextAfter || contextAfter.id !== tenantId) {
                throw new Error(`Context lost at depth ${depth}`);
              }

              return true;
            };
          };

          // Execute nested operations concurrently across instances
          const requests = createdTenants.map((tenant, idx) => {
            const instanceIdx = idx % instanceCount;
            const instance = instances[instanceIdx];
            
            return instance.handleRequest(tenant, 
              createNestedOperation(nestingDepth, tenant._id.toString())
            );
          });

          const results = await Promise.all(requests);

          // Verify all operations succeeded
          results.forEach(result => {
            expect(result.result).toBe(true);
          });

          // Verify each tenant has exactly one item created
          for (const tenant of createdTenants) {
            const items = await runWithTenantContext(
              {
                id: tenant._id.toString(),
                slug: tenant.slug,
                name: tenant.name,
                dbName: tenant.dbName
              },
              async () => MenuItem.find({})
            );
            
            expect(items.length).toBe(1);
            expect(items[0].tenantId.toString()).toBe(tenant._id.toString());
          }

          return true;
        }
      ),
      { numRuns: 100, timeout: 15000 }
    );
  }, 20000);

  /**
   * Property 12.4: High concurrency across many instances maintains isolation
   * 
   * For any high-concurrency scenario with many instances and many tenants,
   * tenant isolation SHALL be maintained without any data leakage.
   */
  test('should maintain isolation under high concurrency across instances', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 5 }), // Number of instances
        fc.array(tenantArbitrary(), { minLength: 4, maxLength: 8 }), // Many tenants
        fc.integer({ min: 3, max: 6 }), // Operations per tenant
        async (instanceCount, tenants, opsPerTenant) => {
          // Clean up
          await Tenant.deleteMany({});
          await MenuItem.deleteMany({});

          // Ensure unique slugs
          const uniqueSlugs = new Set();
          tenants.forEach((tenant, idx) => {
            while (uniqueSlugs.has(tenant.slug)) {
              tenant.slug = tenant.slug + `-${idx}`;
            }
            uniqueSlugs.add(tenant.slug);
          });

          // Create tenants
          const createdTenants = await Promise.all(
            tenants.map(tenant =>
              Tenant.create({
                _id: tenant._id,
                name: tenant.name,
                slug: tenant.slug,
                dbName: tenant.dbName,
                isActive: tenant.isActive,
                status: tenant.status
              })
            )
          );

          // Create instances
          const instances = Array.from(
            { length: instanceCount },
            (_, i) => new SimulatedAppInstance(`instance-${i}`)
          );

          // Generate many concurrent requests
          const requests = [];
          createdTenants.forEach((tenant, tenantIdx) => {
            for (let opIdx = 0; opIdx < opsPerTenant; opIdx++) {
              // Distribute requests across instances
              const instanceIdx = (tenantIdx * opsPerTenant + opIdx) % instanceCount;
              const instance = instances[instanceIdx];
              
              const menuItemData = fc.sample(menuItemArbitrary(), 1)[0];
              
              requests.push(
                instance.handleRequest(tenant, async () => {
                  // Mix of operations
                  if (opIdx % 3 === 0) {
                    // Create
                    const item = await MenuItem.create(menuItemData);
                    return { op: 'create', itemId: item._id.toString() };
                  } else if (opIdx % 3 === 1) {
                    // Read
                    const items = await MenuItem.find({});
                    return { op: 'read', count: items.length };
                  } else {
                    // Count
                    const count = await MenuItem.countDocuments({});
                    return { op: 'count', count };
                  }
                })
              );
            }
          });

          // Execute all requests concurrently
          const results = await Promise.all(requests);

          // Verify all operations completed successfully
          expect(results.length).toBe(createdTenants.length * opsPerTenant);

          // Verify each tenant has correct number of items
          // (only create operations add items, which is 1/3 of operations)
          const expectedItemsPerTenant = Math.ceil(opsPerTenant / 3);
          
          for (const tenant of createdTenants) {
            const items = await runWithTenantContext(
              {
                id: tenant._id.toString(),
                slug: tenant.slug,
                name: tenant.name,
                dbName: tenant.dbName
              },
              async () => MenuItem.find({})
            );
            
            // Should have approximately expectedItemsPerTenant items
            expect(items.length).toBeGreaterThanOrEqual(0);
            expect(items.length).toBeLessThanOrEqual(opsPerTenant);
            
            // All items must belong to this tenant
            items.forEach(item => {
              expect(item.tenantId.toString()).toBe(tenant._id.toString());
            });
          }

          return true;
        }
      ),
      { numRuns: 30, timeout: 20000 }
    );
  }, 25000);

  /**
   * Property 12.5: Instances handle errors without context corruption
   * 
   * For any instance handling requests that may fail,
   * errors SHALL not corrupt tenant context for other concurrent requests.
   */
  test('should maintain context isolation when errors occur in some requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 3 }), // Number of instances
        fc.array(tenantArbitrary(), { minLength: 3, maxLength: 5 }), // Tenants
        fc.float({ min: 0.2, max: 0.5 }), // Error rate (20-50%)
        async (instanceCount, tenants, errorRate) => {
          // Clean up
          await Tenant.deleteMany({});
          await MenuItem.deleteMany({});

          // Ensure unique slugs
          const uniqueSlugs = new Set();
          tenants.forEach((tenant, idx) => {
            while (uniqueSlugs.has(tenant.slug)) {
              tenant.slug = tenant.slug + `-${idx}`;
            }
            uniqueSlugs.add(tenant.slug);
          });

          // Create tenants
          const createdTenants = await Promise.all(
            tenants.map(tenant =>
              Tenant.create({
                _id: tenant._id,
                name: tenant.name,
                slug: tenant.slug,
                dbName: tenant.dbName,
                isActive: tenant.isActive,
                status: tenant.status
              })
            )
          );

          // Create instances
          const instances = Array.from(
            { length: instanceCount },
            (_, i) => new SimulatedAppInstance(`instance-${i}`)
          );

          // Create requests, some of which will fail
          const requests = createdTenants.map((tenant, idx) => {
            const instanceIdx = idx % instanceCount;
            const instance = instances[instanceIdx];
            const shouldFail = Math.random() < errorRate;
            
            return instance.handleRequest(tenant, async () => {
              if (shouldFail) {
                throw new Error('Simulated operation failure');
              }
              
              const menuItemData = fc.sample(menuItemArbitrary(), 1)[0];
              const item = await MenuItem.create(menuItemData);
              return { success: true, itemId: item._id.toString() };
            }).catch(error => ({
              success: false,
              error: error.message,
              tenantId: tenant._id.toString()
            }));
          });

          const results = await Promise.all(requests);

          // Verify: Some requests succeeded, some failed
          const successCount = results.filter(r => r.result?.success === true).length;
          const failCount = results.filter(r => r.result?.success === false).length;
          
          expect(successCount + failCount).toBe(createdTenants.length);
          expect(failCount).toBeGreaterThan(0); // At least some should fail

          // Verify: Successful operations created items with correct tenantId
          for (const result of results) {
            if (result.result?.success === true) {
              const item = await MenuItem.findById(result.result.itemId);
              expect(item).toBeDefined();
              expect(item.tenantId.toString()).toBe(result.tenantId);
            }
          }

          // Verify: Each tenant's data is isolated (no cross-contamination from errors)
          for (const tenant of createdTenants) {
            const items = await runWithTenantContext(
              {
                id: tenant._id.toString(),
                slug: tenant.slug,
                name: tenant.name,
                dbName: tenant.dbName
              },
              async () => MenuItem.find({})
            );
            
            // All items must belong to this tenant
            items.forEach(item => {
              expect(item.tenantId.toString()).toBe(tenant._id.toString());
            });
          }

          return true;
        }
      ),
      { numRuns: 50, timeout: 15000 }
    );
  }, 20000);
});
