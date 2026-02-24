const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { runWithTenantContext } = require('../../utils/tenantContext');
const Tenant = require('../../models/Tenant');
const MenuItem = require('../../models/MenuItem');

/**
 * Property-Based Tests for Concurrent Multi-Tenant Isolation
 * 
 * Feature: unified-nexus-architecture
 * Property 9: Concurrent Multi-Tenant Isolation
 * 
 * For any set of concurrent requests from different tenants, each request
 * SHALL only access data belonging to its own tenant context, with no data
 * leakage between concurrent tenant operations.
 * 
 * **Validates: Requirements 8.3**
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

describe('Concurrent Multi-Tenant Isolation - Property Tests', () => {
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
   * Property 9: Concurrent Multi-Tenant Isolation
   * 
   * For any set of concurrent requests from different tenants, each request
   * SHALL only access data belonging to its own tenant context, with no data
   * leakage between concurrent tenant operations.
   */
  describe('Property 9: Concurrent Multi-Tenant Isolation', () => {
    test('should isolate data between concurrent tenant operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 2-5 tenants
          fc.array(tenantArbitrary(), { minLength: 2, maxLength: 5 }),
          // Generate 1-3 menu items per tenant
          fc.integer({ min: 1, max: 3 }),
          async (tenants, itemsPerTenant) => {
            // Clean up before each iteration
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

            // Create all tenants in database
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

            // Generate menu items for each tenant
            const menuItemsData = tenants.map(() => 
              fc.sample(menuItemArbitrary(), itemsPerTenant)
            );

            // Concurrently create menu items for each tenant
            const createOperations = createdTenants.map((tenant, idx) => {
              return runWithTenantContext(
                { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName },
                async () => {
                  const items = await Promise.all(
                    menuItemsData[idx].map(itemData => MenuItem.create(itemData))
                  );
                  return items;
                }
              );
            });

            const createdItemsByTenant = await Promise.all(createOperations);

            // Property 1: Each tenant should have created the correct number of items
            createdItemsByTenant.forEach((items, idx) => {
              expect(items).toHaveLength(itemsPerTenant);
              // Verify all items have the correct tenantId
              items.forEach(item => {
                expect(item.tenantId.toString()).toBe(createdTenants[idx]._id.toString());
              });
            });

            // Property 2: Concurrent read operations should only return tenant-specific data
            const readOperations = createdTenants.map((tenant) => {
              return runWithTenantContext(
                { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName },
                async () => {
                  const items = await MenuItem.find({});
                  return { tenantId: tenant._id.toString(), items };
                }
              );
            });

            const readResults = await Promise.all(readOperations);

            // Verify each tenant only sees their own data
            readResults.forEach((result, idx) => {
              expect(result.items).toHaveLength(itemsPerTenant);
              result.items.forEach(item => {
                expect(item.tenantId.toString()).toBe(result.tenantId);
              });
            });

            // Property 3: Concurrent update operations should only affect tenant-specific data
            const updateOperations = createdTenants.map((tenant, idx) => {
              return runWithTenantContext(
                { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName },
                async () => {
                  const updateResult = await MenuItem.updateMany(
                    {},
                    { $set: { is_active: false } }
                  );
                  return { tenantId: tenant._id.toString(), modifiedCount: updateResult.modifiedCount };
                }
              );
            });

            const updateResults = await Promise.all(updateOperations);

            // Verify each tenant only updated their own items
            updateResults.forEach((result, idx) => {
              // modifiedCount should match itemsPerTenant (or 0 if no items were created)
              expect(result.modifiedCount).toBeGreaterThanOrEqual(0);
              expect(result.modifiedCount).toBeLessThanOrEqual(itemsPerTenant);
            });

            // Verify updates were isolated - check that each tenant's items were updated
            const verifyOperations = createdTenants.map((tenant) => {
              return runWithTenantContext(
                { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName },
                async () => {
                  const items = await MenuItem.find({});
                  return items;
                }
              );
            });

            const verifyResults = await Promise.all(verifyOperations);

            verifyResults.forEach((items, idx) => {
              expect(items.length).toBeGreaterThanOrEqual(0);
              expect(items.length).toBeLessThanOrEqual(itemsPerTenant);
              items.forEach(item => {
                expect(item.is_active).toBe(false);
                expect(item.tenantId.toString()).toBe(createdTenants[idx]._id.toString());
              });
            });

            // Property 4: Concurrent delete operations should only affect tenant-specific data
            const deleteOperations = createdTenants.map((tenant) => {
              return runWithTenantContext(
                { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName },
                async () => {
                  const deleteResult = await MenuItem.deleteMany({});
                  return { tenantId: tenant._id.toString(), deletedCount: deleteResult.deletedCount };
                }
              );
            });

            const deleteResults = await Promise.all(deleteOperations);

            // Verify each tenant only deleted their own items
            deleteResults.forEach((result, idx) => {
              expect(result.deletedCount).toBeGreaterThanOrEqual(0);
              expect(result.deletedCount).toBeLessThanOrEqual(itemsPerTenant);
            });

            // Verify all items are deleted
            const finalCount = await MenuItem.countDocuments({});
            expect(finalCount).toBe(0);

            return true;
          }
        ),
        { numRuns: 100, timeout: 10000 }
      );
    }, 15000);

    test('should maintain isolation during mixed concurrent operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 3 tenants for this test
          fc.array(tenantArbitrary(), { minLength: 3, maxLength: 3 }),
          fc.integer({ min: 2, max: 5 }),
          async (tenants, itemsPerTenant) => {
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

            // Create initial data for all tenants
            const menuItemsData = tenants.map(() => 
              fc.sample(menuItemArbitrary(), itemsPerTenant)
            );

            await Promise.all(
              createdTenants.map((tenant, idx) =>
                runWithTenantContext(
                  { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName },
                  async () => {
                    await Promise.all(
                      menuItemsData[idx].map(itemData => MenuItem.create(itemData))
                    );
                  }
                )
              )
            );

            // Perform mixed concurrent operations:
            // Tenant 0: Read
            // Tenant 1: Update
            // Tenant 2: Delete and recreate
            const mixedOperations = [
              // Tenant 0: Read operation
              runWithTenantContext(
                { 
                  id: createdTenants[0]._id.toString(), 
                  slug: createdTenants[0].slug, 
                  name: createdTenants[0].name, 
                  dbName: createdTenants[0].dbName 
                },
                async () => {
                  const items = await MenuItem.find({});
                  return { operation: 'read', tenantId: createdTenants[0]._id.toString(), count: items.length };
                }
              ),
              // Tenant 1: Update operation
              runWithTenantContext(
                { 
                  id: createdTenants[1]._id.toString(), 
                  slug: createdTenants[1].slug, 
                  name: createdTenants[1].name, 
                  dbName: createdTenants[1].dbName 
                },
                async () => {
                  const result = await MenuItem.updateMany({}, { $set: { price: 99999 } });
                  return { operation: 'update', tenantId: createdTenants[1]._id.toString(), modifiedCount: result.modifiedCount };
                }
              ),
              // Tenant 2: Delete operation
              runWithTenantContext(
                { 
                  id: createdTenants[2]._id.toString(), 
                  slug: createdTenants[2].slug, 
                  name: createdTenants[2].name, 
                  dbName: createdTenants[2].dbName 
                },
                async () => {
                  const result = await MenuItem.deleteMany({});
                  return { operation: 'delete', tenantId: createdTenants[2]._id.toString(), deletedCount: result.deletedCount };
                }
              )
            ];

            const results = await Promise.all(mixedOperations);

            // Verify results
            expect(results[0].count).toBe(itemsPerTenant); // Tenant 0 read all items
            expect(results[1].modifiedCount).toBe(itemsPerTenant); // Tenant 1 updated all items
            expect(results[2].deletedCount).toBe(itemsPerTenant); // Tenant 2 deleted all items

            // Verify final state for each tenant
            const tenant0Items = await runWithTenantContext(
              { 
                id: createdTenants[0]._id.toString(), 
                slug: createdTenants[0].slug, 
                name: createdTenants[0].name, 
                dbName: createdTenants[0].dbName 
              },
              async () => MenuItem.find({})
            );
            expect(tenant0Items).toHaveLength(itemsPerTenant);
            tenant0Items.forEach(item => {
              expect(item.price).not.toBe(99999); // Not affected by tenant 1's update
            });

            const tenant1Items = await runWithTenantContext(
              { 
                id: createdTenants[1]._id.toString(), 
                slug: createdTenants[1].slug, 
                name: createdTenants[1].name, 
                dbName: createdTenants[1].dbName 
              },
              async () => MenuItem.find({})
            );
            expect(tenant1Items).toHaveLength(itemsPerTenant);
            tenant1Items.forEach(item => {
              expect(item.price).toBe(99999); // Updated by tenant 1
            });

            const tenant2Items = await runWithTenantContext(
              { 
                id: createdTenants[2]._id.toString(), 
                slug: createdTenants[2].slug, 
                name: createdTenants[2].name, 
                dbName: createdTenants[2].dbName 
              },
              async () => MenuItem.find({})
            );
            expect(tenant2Items).toHaveLength(0); // Deleted by tenant 2

            return true;
          }
        ),
        { numRuns: 30, timeout: 10000 }
      );
    }, 15000);

    test('should handle high concurrency with many tenants', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 5-10 tenants for high concurrency test
          fc.array(tenantArbitrary(), { minLength: 5, maxLength: 10 }),
          fc.integer({ min: 1, max: 3 }),
          async (tenants, itemsPerTenant) => {
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

            // Generate menu items data
            const menuItemsData = tenants.map(() => 
              fc.sample(menuItemArbitrary(), itemsPerTenant)
            );

            // Perform highly concurrent operations
            const operations = createdTenants.flatMap((tenant, idx) => [
              // Create operation
              runWithTenantContext(
                { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName },
                async () => {
                  await Promise.all(
                    menuItemsData[idx].map(itemData => MenuItem.create(itemData))
                  );
                  return { tenantId: tenant._id.toString(), operation: 'create' };
                }
              ),
              // Read operation
              runWithTenantContext(
                { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName },
                async () => {
                  const items = await MenuItem.find({});
                  return { tenantId: tenant._id.toString(), operation: 'read', count: items.length };
                }
              ),
              // Count operation
              runWithTenantContext(
                { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName },
                async () => {
                  const count = await MenuItem.countDocuments({});
                  return { tenantId: tenant._id.toString(), operation: 'count', count };
                }
              )
            ]);

            const results = await Promise.all(operations);

            // Verify each tenant's operations were isolated
            createdTenants.forEach((tenant, idx) => {
              const tenantResults = results.filter(r => r.tenantId === tenant._id.toString());
              
              // Should have 3 operations per tenant (create, read, count)
              expect(tenantResults.length).toBe(3);
              
              // Read and count should return correct number
              const readResult = tenantResults.find(r => r.operation === 'read');
              const countResult = tenantResults.find(r => r.operation === 'count');
              
              expect(readResult.count).toBe(itemsPerTenant);
              expect(countResult.count).toBe(itemsPerTenant);
            });

            return true;
          }
        ),
        { numRuns: 20, timeout: 10000 }
      );
    }, 15000);

    test('should maintain isolation during concurrent aggregation queries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(tenantArbitrary(), { minLength: 2, maxLength: 4 }),
          fc.integer({ min: 3, max: 6 }),
          async (tenants, itemsPerTenant) => {
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

            // Create menu items with specific prices for aggregation testing
            await Promise.all(
              createdTenants.map((tenant, idx) =>
                runWithTenantContext(
                  { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName },
                  async () => {
                    const basePrice = (idx + 1) * 10000;
                    await Promise.all(
                      Array.from({ length: itemsPerTenant }, (_, i) =>
                        MenuItem.create({
                          id: `item-${idx}-${i}`,
                          name: `Item ${i}`,
                          price: basePrice + (i * 1000),
                          category: 'Food',
                          is_active: true,
                          order: i
                        })
                      )
                    );
                  }
                )
              )
            );

            // Perform concurrent aggregation queries
            const aggregationOperations = createdTenants.map((tenant, idx) => {
              return runWithTenantContext(
                { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName },
                async () => {
                  const result = await MenuItem.aggregate([
                    {
                      $group: {
                        _id: null,
                        totalPrice: { $sum: '$price' },
                        avgPrice: { $avg: '$price' },
                        count: { $sum: 1 }
                      }
                    }
                  ]);
                  return { 
                    tenantId: tenant._id.toString(), 
                    tenantIndex: idx,
                    aggregation: result[0] 
                  };
                }
              );
            });

            const aggregationResults = await Promise.all(aggregationOperations);

            // Verify each tenant's aggregation only includes their own data
            aggregationResults.forEach((result, idx) => {
              expect(result.aggregation.count).toBe(itemsPerTenant);
              
              // Calculate expected total price
              const basePrice = (idx + 1) * 10000;
              const expectedTotal = Array.from({ length: itemsPerTenant }, (_, i) => 
                basePrice + (i * 1000)
              ).reduce((sum, price) => sum + price, 0);
              
              expect(result.aggregation.totalPrice).toBe(expectedTotal);
              expect(result.aggregation.avgPrice).toBe(expectedTotal / itemsPerTenant);
            });

            return true;
          }
        ),
        { numRuns: 30, timeout: 10000 }
      );
    }, 15000);
  });
});
