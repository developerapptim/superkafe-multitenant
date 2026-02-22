const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fc = require('fast-check');
const MenuItem = require('../../models/MenuItem');
const Order = require('../../models/Order');
const Table = require('../../models/Table');
const { runWithTenantContext } = require('../../utils/tenantContext');

/**
 * Property-Based Tests for Cross-Tenant Data Isolation
 * 
 * Feature: tenant-data-isolation
 * 
 * These tests verify that tenant data is completely isolated:
 * - Property 11: Cross-Tenant Data Isolation
 * - Property 13: Cross-Tenant Modification Prevention
 * 
 * Validates: Requirements 2.3, 2.5
 */

// Helper: Generate valid MongoDB ObjectId hex string (24 hex characters)
const objectIdArbitrary = () => 
  fc.integer({ min: 0, max: 15 }).chain(() =>
    fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 24, maxLength: 24 })
      .map(arr => arr.map(n => n.toString(16)).join(''))
  );

// Helper: Generate menu item data with tenant-specific IDs
const menuItemArbitrary = (tenantPrefix = '') => fc.record({
  id: fc.uuid().map(uuid => `menu_${tenantPrefix}_${uuid}`),
  name: fc.string({ minLength: 3, maxLength: 50 }),
  description: fc.string({ minLength: 0, maxLength: 100 }),
  price: fc.integer({ min: 1000, max: 100000 }),
  category: fc.constantFrom('food', 'drink', 'snack', 'dessert'),
  is_active: fc.boolean()
});

// Helper: Generate order data with tenant-specific IDs
const orderArbitrary = (tenantPrefix = '') => fc.record({
  id: fc.uuid().map(uuid => `order_${tenantPrefix}_${uuid}`),
  customerName: fc.string({ minLength: 2, maxLength: 50 }),
  tableNumber: fc.string({ minLength: 1, maxLength: 5 }),
  total: fc.integer({ min: 10000, max: 500000 }),
  status: fc.constantFrom('new', 'process', 'served', 'done'),
  paymentStatus: fc.constantFrom('paid', 'unpaid')
});

// Helper: Generate table data with tenant-specific IDs
const tableArbitrary = (tenantPrefix = '') => fc.record({
  id: fc.uuid().map(uuid => `table_${tenantPrefix}_${uuid}`),
  number: fc.uuid().map(uuid => `${tenantPrefix}_${uuid}`),
  capacity: fc.integer({ min: 2, max: 10 }),
  status: fc.constantFrom('available', 'occupied', 'reserved'),
  location: fc.constantFrom('indoor', 'outdoor')
});

describe('Cross-Tenant Data Isolation - Property Tests', () => {
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
    await MenuItem.deleteMany({});
    await Order.deleteMany({});
    await Table.deleteMany({});
  });

  /**
   * Property 11: Cross-Tenant Data Isolation
   * 
   * For any two tenants A and B, a query made by tenant A should never 
   * return data records belonging to tenant B.
   * 
   * **Validates: Requirements 2.3**
   */
  describe('Property 11: Cross-Tenant Data Isolation', () => {
    test('should isolate menu items between any two tenants', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two different tenants with their menu items
          fc.record({
            tenantA: fc.record({
              id: objectIdArbitrary(),
              items: fc.array(menuItemArbitrary('tenantA'), { minLength: 1, maxLength: 5 })
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              items: fc.array(menuItemArbitrary('tenantB'), { minLength: 1, maxLength: 5 })
            })
          }),
          async ({ tenantA, tenantB }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // Create menu items for tenant A
            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.create(tenantA.items)
            );

            // Create menu items for tenant B
            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.create(tenantB.items)
            );

            // Query as tenant A
            const tenantAResults = await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.find({}).lean()
            );

            // Query as tenant B
            const tenantBResults = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.find({}).lean()
            );

            // Property: Tenant A should only see their own items
            const allATenantA = tenantAResults.every(
              item => item.tenantId.toString() === tenantAId.toString()
            );

            // Property: Tenant B should only see their own items
            const allBTenantB = tenantBResults.every(
              item => item.tenantId.toString() === tenantBId.toString()
            );

            // Property: Count should match created items
            const countMatch = 
              tenantAResults.length === tenantA.items.length &&
              tenantBResults.length === tenantB.items.length;

            // Property: No overlap in results
            const tenantAIds = new Set(tenantAResults.map(i => i.id));
            const tenantBIds = new Set(tenantBResults.map(i => i.id));
            const noOverlap = ![...tenantAIds].some(id => tenantBIds.has(id));

            return allATenantA && allBTenantB && countMatch && noOverlap;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should isolate orders between any two tenants', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantA: fc.record({
              id: objectIdArbitrary(),
              orders: fc.array(orderArbitrary('tenantA'), { minLength: 1, maxLength: 5 })
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              orders: fc.array(orderArbitrary('tenantB'), { minLength: 1, maxLength: 5 })
            })
          }),
          async ({ tenantA, tenantB }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // Create orders for both tenants
            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => Order.create(tenantA.orders)
            );

            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => Order.create(tenantB.orders)
            );

            // Query as each tenant
            const tenantAResults = await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => Order.find({}).lean()
            );

            const tenantBResults = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => Order.find({}).lean()
            );

            // Property: Complete isolation
            const allATenantA = tenantAResults.every(
              order => order.tenantId.toString() === tenantAId.toString()
            );

            const allBTenantB = tenantBResults.every(
              order => order.tenantId.toString() === tenantBId.toString()
            );

            const countMatch = 
              tenantAResults.length === tenantA.orders.length &&
              tenantBResults.length === tenantB.orders.length;

            return allATenantA && allBTenantB && countMatch;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should isolate tables between any two tenants', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantA: fc.record({
              id: objectIdArbitrary(),
              tables: fc.array(tableArbitrary('tenantA'), { minLength: 1, maxLength: 5 })
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              tables: fc.array(tableArbitrary('tenantB'), { minLength: 1, maxLength: 5 })
            })
          }),
          async ({ tenantA, tenantB }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // Create tables for both tenants
            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => Table.create(tenantA.tables)
            );

            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => Table.create(tenantB.tables)
            );

            // Query as each tenant
            const tenantAResults = await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => Table.find({}).lean()
            );

            const tenantBResults = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => Table.find({}).lean()
            );

            // Property: Complete isolation
            const allATenantA = tenantAResults.every(
              table => table.tenantId.toString() === tenantAId.toString()
            );

            const allBTenantB = tenantBResults.every(
              table => table.tenantId.toString() === tenantBId.toString()
            );

            const countMatch = 
              tenantAResults.length === tenantA.tables.length &&
              tenantBResults.length === tenantB.tables.length;

            return allATenantA && allBTenantB && countMatch;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should isolate data across multiple tenants with concurrent queries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({
            tenantId: objectIdArbitrary(),
            menuItems: fc.array(menuItemArbitrary(), { minLength: 1, maxLength: 3 }),
            orders: fc.array(orderArbitrary(), { minLength: 1, maxLength: 3 })
          }), { minLength: 2, maxLength: 5 }),
          async (tenants) => {
            // Create data for all tenants with unique IDs per tenant
            for (let i = 0; i < tenants.length; i++) {
              const tenant = tenants[i];
              const tenantId = new mongoose.Types.ObjectId(tenant.tenantId);
              const tenantPrefix = `t${i}`;
              
              // Add tenant prefix and UUID to IDs to ensure uniqueness
              const menuItems = tenant.menuItems.map((item, idx) => ({
                ...item,
                id: `menu_${tenantPrefix}_${fc.sample(fc.uuid(), 1)[0]}_${idx}`
              }));
              const orders = tenant.orders.map((order, idx) => ({
                ...order,
                id: `order_${tenantPrefix}_${fc.sample(fc.uuid(), 1)[0]}_${idx}`
              }));
              
              await runWithTenantContext(
                { id: tenantId, slug: `tenant-${tenantPrefix}` },
                async () => {
                  await MenuItem.create(menuItems);
                  await Order.create(orders);
                }
              );
            }

            // Query concurrently as all tenants
            const results = await Promise.all(
              tenants.map((tenant, i) => {
                const tenantId = new mongoose.Types.ObjectId(tenant.tenantId);
                const tenantPrefix = `t${i}`;
                return runWithTenantContext(
                  { id: tenantId, slug: `tenant-${tenantPrefix}` },
                  async () => {
                    const menuItems = await MenuItem.find({}).lean();
                    const orders = await Order.find({}).lean();
                    return { tenantId, menuItems, orders };
                  }
                );
              })
            );

            // Property: Each tenant should only see their own data
            for (let i = 0; i < results.length; i++) {
              const { tenantId, menuItems, orders } = results[i];
              const expectedMenuCount = tenants[i].menuItems.length;
              const expectedOrderCount = tenants[i].orders.length;

              // Check counts match
              if (menuItems.length !== expectedMenuCount) return false;
              if (orders.length !== expectedOrderCount) return false;

              // Check all items belong to correct tenant
              const allMenuItemsCorrect = menuItems.every(
                item => item.tenantId.toString() === tenantId.toString()
              );
              const allOrdersCorrect = orders.every(
                order => order.tenantId.toString() === tenantId.toString()
              );

              if (!allMenuItemsCorrect || !allOrdersCorrect) return false;
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    test('should isolate findOne queries between tenants', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseId: fc.string({ minLength: 5, maxLength: 20 }),
            tenantA: fc.record({
              id: objectIdArbitrary(),
              name: fc.string({ minLength: 3, maxLength: 50 }),
              price: fc.integer({ min: 1000, max: 50000 })
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              name: fc.string({ minLength: 3, maxLength: 50 }),
              price: fc.integer({ min: 1000, max: 50000 })
            })
          }),
          async ({ baseId, tenantA, tenantB }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // Create menu items with tenant-specific IDs
            const itemAId = `menu_a_${baseId}`;
            const itemBId = `menu_b_${baseId}`;
            
            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.create({
                id: itemAId,
                name: tenantA.name,
                price: tenantA.price,
                category: 'food'
              })
            );

            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.create({
                id: itemBId,
                name: tenantB.name,
                price: tenantB.price,
                category: 'drink'
              })
            );

            // Query as tenant A - should only find their item
            const resultA = await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.findOne({ id: itemAId }).lean()
            );

            // Query as tenant B trying to find tenant A's item - should return null
            const resultBTryingA = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.findOne({ id: itemAId }).lean()
            );

            // Query as tenant B for their own item
            const resultB = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.findOne({ id: itemBId }).lean()
            );

            // Property: Each tenant should only find their own items
            const tenantACorrect = 
              resultA && 
              resultA.tenantId.toString() === tenantAId.toString() &&
              resultA.name === tenantA.name &&
              resultA.price === tenantA.price;

            const tenantBCorrect = 
              resultB && 
              resultB.tenantId.toString() === tenantBId.toString() &&
              resultB.name === tenantB.name &&
              resultB.price === tenantB.price;

            // Tenant B should not be able to find tenant A's item
            const crossTenantIsolation = resultBTryingA === null;

            return tenantACorrect && tenantBCorrect && crossTenantIsolation;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should isolate count queries between tenants', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantA: fc.record({
              id: objectIdArbitrary(),
              itemCount: fc.integer({ min: 1, max: 10 })
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              itemCount: fc.integer({ min: 1, max: 10 })
            })
          }),
          async ({ tenantA, tenantB }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // Create items for tenant A
            const tenantAItems = Array.from({ length: tenantA.itemCount }, (_, i) => ({
              id: `menu_a_${fc.sample(fc.uuid(), 1)[0]}_${i}`,
              name: `Item A ${i}`,
              price: 10000,
              category: 'food'
            }));

            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.create(tenantAItems)
            );

            // Create items for tenant B
            const tenantBItems = Array.from({ length: tenantB.itemCount }, (_, i) => ({
              id: `menu_b_${fc.sample(fc.uuid(), 1)[0]}_${i}`,
              name: `Item B ${i}`,
              price: 20000,
              category: 'drink'
            }));

            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.create(tenantBItems)
            );

            // Count as each tenant
            const countA = await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.countDocuments({})
            );

            const countB = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.countDocuments({})
            );

            // Property: Counts should match created items
            return countA === tenantA.itemCount && countB === tenantB.itemCount;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 13: Cross-Tenant Modification Prevention
   * 
   * For any update or delete operation, if the target record's tenantId 
   * does not match the requesting tenant's ID, the operation should fail 
   * or have no effect.
   * 
   * **Validates: Requirements 2.5**
   */
  describe('Property 13: Cross-Tenant Modification Prevention', () => {
    test('should prevent tenant A from updating tenant B menu items', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantA: fc.record({
              id: objectIdArbitrary()
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              item: menuItemArbitrary('tenantB')
            }),
            newPrice: fc.integer({ min: 1000, max: 100000 })
          }),
          async ({ tenantA, tenantB, newPrice }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // Create item for tenant B
            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.create(tenantB.item)
            );

            // Get original price
            const originalItem = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.findOne({ id: tenantB.item.id }).lean()
            );

            // Attempt to update as tenant A
            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.updateOne(
                { id: tenantB.item.id },
                { price: newPrice }
              )
            );

            // Verify item was NOT updated
            const afterUpdate = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.findOne({ id: tenantB.item.id }).lean()
            );

            // Property: Price should remain unchanged
            return afterUpdate && afterUpdate.price === originalItem.price;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should prevent tenant A from deleting tenant B orders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantA: fc.record({
              id: objectIdArbitrary()
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              order: orderArbitrary('tenantB')
            })
          }),
          async ({ tenantA, tenantB }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // Create order for tenant B
            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => Order.create(tenantB.order)
            );

            // Attempt to delete as tenant A
            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => Order.deleteOne({ id: tenantB.order.id })
            );

            // Verify order still exists for tenant B
            const orderStillExists = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => Order.findOne({ id: tenantB.order.id }).lean()
            );

            // Property: Order should still exist
            return orderStillExists !== null;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should prevent tenant A from bulk updating tenant B data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantA: fc.record({
              id: objectIdArbitrary()
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              items: fc.array(menuItemArbitrary('tenantB'), { minLength: 2, maxLength: 5 })
            }),
            newCategory: fc.constantFrom('updated-food', 'updated-drink')
          }),
          async ({ tenantA, tenantB, newCategory }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // Create items for tenant B
            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.create(tenantB.items)
            );

            // Get original categories
            const originalItems = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.find({}).lean()
            );

            // Attempt bulk update as tenant A
            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.updateMany({}, { category: newCategory })
            );

            // Verify items were NOT updated
            const afterUpdate = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.find({}).lean()
            );

            // Property: Categories should remain unchanged
            for (let i = 0; i < originalItems.length; i++) {
              const original = originalItems.find(item => item.id === afterUpdate[i].id);
              if (afterUpdate[i].category !== original.category) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should prevent tenant A from bulk deleting tenant B data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantA: fc.record({
              id: objectIdArbitrary()
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              tables: fc.array(tableArbitrary('tenantB'), { minLength: 2, maxLength: 5 })
            })
          }),
          async ({ tenantA, tenantB }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // Create tables for tenant B
            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => Table.create(tenantB.tables)
            );

            const originalCount = tenantB.tables.length;

            // Attempt bulk delete as tenant A
            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => Table.deleteMany({})
            );

            // Verify tables still exist for tenant B
            const remainingCount = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => Table.countDocuments({})
            );

            // Property: All tables should still exist
            return remainingCount === originalCount;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should allow tenant to update their own data while preventing cross-tenant updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantA: fc.record({
              id: objectIdArbitrary(),
              item: menuItemArbitrary('tenantA'),
              newPrice: fc.integer({ min: 1000, max: 100000 })
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              item: menuItemArbitrary('tenantB')
            })
          }),
          async ({ tenantA, tenantB }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // Create items for both tenants
            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.create(tenantA.item)
            );

            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.create(tenantB.item)
            );

            // Tenant A updates their own item
            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.updateOne(
                { id: tenantA.item.id },
                { price: tenantA.newPrice }
              )
            );

            // Verify tenant A's item was updated
            const tenantAItem = await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.findOne({ id: tenantA.item.id }).lean()
            );

            // Verify tenant B's item was NOT affected
            const tenantBItem = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.findOne({ id: tenantB.item.id }).lean()
            );

            // Property: Tenant A's update succeeded, Tenant B's data unchanged
            return (
              tenantAItem && 
              tenantAItem.price === tenantA.newPrice &&
              tenantBItem && 
              tenantBItem.price === tenantB.item.price
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should prevent findOneAndUpdate from crossing tenant boundaries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantA: fc.record({
              id: objectIdArbitrary()
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              order: orderArbitrary('tenantB')
            }),
            newStatus: fc.constantFrom('done', 'cancel')
          }),
          async ({ tenantA, tenantB, newStatus }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // Create order for tenant B
            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => Order.create(tenantB.order)
            );

            const originalStatus = tenantB.order.status;

            // Attempt findOneAndUpdate as tenant A
            const updateResult = await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => Order.findOneAndUpdate(
                { id: tenantB.order.id },
                { status: newStatus },
                { new: true }
              )
            );

            // Verify update returned null (not found in tenant A's scope)
            if (updateResult !== null) return false;

            // Verify order status unchanged for tenant B
            const tenantBOrder = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => Order.findOne({ id: tenantB.order.id }).lean()
            );

            // Property: Status should remain unchanged
            return tenantBOrder && tenantBOrder.status === originalStatus;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should prevent findOneAndDelete from crossing tenant boundaries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantA: fc.record({
              id: objectIdArbitrary()
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              table: tableArbitrary('tenantB')
            })
          }),
          async ({ tenantA, tenantB }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // Create table for tenant B
            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => Table.create(tenantB.table)
            );

            // Attempt findOneAndDelete as tenant A
            const deleteResult = await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => Table.findOneAndDelete({ id: tenantB.table.id })
            );

            // Verify delete returned null (not found in tenant A's scope)
            if (deleteResult !== null) return false;

            // Verify table still exists for tenant B
            const tenantBTable = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => Table.findOne({ id: tenantB.table.id }).lean()
            );

            // Property: Table should still exist
            return tenantBTable !== null;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Combined Property: Complete Isolation Guarantee
   * 
   * Verifies that Properties 11 and 13 work together to ensure
   * complete tenant isolation across all CRUD operations.
   */
  describe('Combined: Complete Isolation Across CRUD Operations', () => {
    test('should maintain complete isolation through create, read, update, delete cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantA: fc.record({
              id: objectIdArbitrary(),
              items: fc.array(menuItemArbitrary('tenantA'), { minLength: 2, maxLength: 4 })
            }),
            tenantB: fc.record({
              id: objectIdArbitrary(),
              items: fc.array(menuItemArbitrary('tenantB'), { minLength: 2, maxLength: 4 })
            }),
            updatePrice: fc.integer({ min: 1000, max: 100000 })
          }),
          async ({ tenantA, tenantB, updatePrice }) => {
            const tenantAId = new mongoose.Types.ObjectId(tenantA.id);
            const tenantBId = new mongoose.Types.ObjectId(tenantB.id);

            // CREATE: Both tenants create items
            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.create(tenantA.items)
            );

            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.create(tenantB.items)
            );

            // READ: Each tenant reads their own data
            const tenantARead = await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.find({}).lean()
            );

            const tenantBRead = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.find({}).lean()
            );

            // Verify read isolation
            if (tenantARead.length !== tenantA.items.length) return false;
            if (tenantBRead.length !== tenantB.items.length) return false;

            // UPDATE: Tenant A updates their first item
            const firstItemA = tenantA.items[0];
            await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.updateOne(
                { id: firstItemA.id },
                { price: updatePrice }
              )
            );

            // Verify update only affected tenant A
            const tenantAAfterUpdate = await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.findOne({ id: firstItemA.id }).lean()
            );

            const tenantBAfterUpdate = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.find({}).lean()
            );

            if (!tenantAAfterUpdate || tenantAAfterUpdate.price !== updatePrice) return false;
            if (tenantBAfterUpdate.length !== tenantB.items.length) return false;

            // DELETE: Tenant B deletes their first item
            const firstItemB = tenantB.items[0];
            await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.deleteOne({ id: firstItemB.id })
            );

            // Verify delete only affected tenant B
            const tenantAAfterDelete = await runWithTenantContext(
              { id: tenantAId, slug: 'tenant-a' },
              async () => MenuItem.find({}).lean()
            );

            const tenantBAfterDelete = await runWithTenantContext(
              { id: tenantBId, slug: 'tenant-b' },
              async () => MenuItem.find({}).lean()
            );

            // Property: Tenant A still has all items, Tenant B has one less
            return (
              tenantAAfterDelete.length === tenantA.items.length &&
              tenantBAfterDelete.length === tenantB.items.length - 1
            );
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
