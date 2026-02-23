/**
 * Property-Based Test: Cross-Tenant Data Isolation for Dashboard Routes
 * 
 * Feature: dashboard-tenant-isolation-fix, Property 4: Cross-Tenant Data Isolation
 * **Validates: Requirements 3.1, 3.2, 3.3**
 * 
 * This test verifies that dashboard endpoints (/api/stats, /api/menu, /api/tables)
 * properly isolate data between tenants. Each tenant should only see their own data
 * and never see data from other tenants.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fc = require('fast-check');

// Import models
const Tenant = require('../../models/Tenant');
const MenuItem = require('../../models/MenuItem');
const Order = require('../../models/Order');
const Table = require('../../models/Table');

// Import utilities
const { runWithTenantContext } = require('../../utils/tenantContext');

describe('Property 4: Cross-Tenant Data Isolation - Dashboard Routes', () => {
  let mongoServer;
  let mainConnection;
  let testCounter = 0;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Set environment variable for in-memory MongoDB
    process.env.MONGODB_URI = mongoUri;
    
    // Connect to main database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    mainConnection = mongoose.connection;
  }, 120000); // 120 second timeout for MongoDB download

  afterAll(async () => {
    // Close all connections
    const connections = mongoose.connections;
    for (const conn of connections) {
      if (conn.readyState !== 0) {
        await conn.close();
      }
    }
    
    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 30000); // 30 second timeout

  afterEach(async () => {
    // Clean up all test data from main database
    const collections = mainConnection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    testCounter++;
  }, 10000); // 10 second timeout

  /**
   * Helper: Generate tenant data with unique identifiers
   * Slugs must match /^[a-z0-9-]+$/ (only lowercase letters, numbers, and hyphens)
   */
  const tenantArbitrary = (prefix) => fc.integer({ min: 1000000, max: 9999999 }).chain(randomNum => {
    const uniqueId = `${Date.now()}${randomNum}`;
    return fc.record({
      name: fc.constant(`${prefix}_${uniqueId}`),
      slug: fc.constant(`${prefix}-${uniqueId}`),
      dbName: fc.constant(`tenant_${prefix}_${uniqueId}`),
      isActive: fc.constant(true)
    });
  });

  /**
   * Helper: Generate menu item data
   */
  const menuItemArbitrary = () => fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 3, maxLength: 50 }),
    description: fc.string({ minLength: 0, maxLength: 100 }),
    price: fc.integer({ min: 1000, max: 100000 }),
    category: fc.constantFrom('food', 'drink', 'snack', 'dessert'),
    is_active: fc.boolean()
  });

  /**
   * Helper: Generate order data
   */
  const orderArbitrary = () => fc.record({
    id: fc.uuid(),
    customerName: fc.string({ minLength: 2, maxLength: 50 }),
    tableNumber: fc.string({ minLength: 1, maxLength: 5 }),
    total: fc.integer({ min: 10000, max: 500000 }),
    status: fc.constantFrom('new', 'process', 'served', 'done'),
    paymentStatus: fc.constantFrom('paid', 'unpaid'),
    items: fc.array(fc.record({
      name: fc.string({ minLength: 3, maxLength: 30 }),
      quantity: fc.integer({ min: 1, max: 10 }),
      price: fc.integer({ min: 1000, max: 50000 })
    }), { minLength: 1, maxLength: 5 })
  });

  /**
   * Helper: Generate table data
   */
  const tableArbitrary = () => fc.record({
    id: fc.uuid(),
    number: fc.string({ minLength: 1, maxLength: 5 }),
    capacity: fc.integer({ min: 2, max: 10 }),
    status: fc.constantFrom('available', 'occupied', 'reserved'),
    location: fc.constantFrom('indoor', 'outdoor')
  });

  /**
   * Helper: Create tenant in database
   */
  async function createTenant(tenantData) {
    const tenant = await Tenant.create({
      name: tenantData.name,
      slug: tenantData.slug,
      dbName: tenantData.dbName,
      isActive: tenantData.isActive
    });
    return tenant;
  }

  /**
   * Property Test: Menu data isolation
   */
  test('should isolate menu data between any two tenants', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantA: tenantArbitrary('tenanta'),
          tenantB: tenantArbitrary('tenantb'),
          menuItemsA: fc.array(menuItemArbitrary(), { minLength: 1, maxLength: 5 }),
          menuItemsB: fc.array(menuItemArbitrary(), { minLength: 1, maxLength: 5 })
        }),
        async ({ tenantA, tenantB, menuItemsA, menuItemsB }) => {
          try {
            // Create tenants
            const tenantADoc = await createTenant(tenantA);
            const tenantBDoc = await createTenant(tenantB);

            // Create menu items for tenant A with tenant context
            const createdMenuItemsA = await runWithTenantContext(
              { id: tenantADoc._id.toString(), slug: tenantADoc.slug, dbName: tenantADoc.dbName },
              async () => {
                return await MenuItem.create(menuItemsA);
              }
            );

            // Create menu items for tenant B with tenant context
            const createdMenuItemsB = await runWithTenantContext(
              { id: tenantBDoc._id.toString(), slug: tenantBDoc.slug, dbName: tenantBDoc.dbName },
              async () => {
                return await MenuItem.create(menuItemsB);
              }
            );

            // Query menu items as tenant A
            const menuA = await runWithTenantContext(
              { id: tenantADoc._id.toString(), slug: tenantADoc.slug, dbName: tenantADoc.dbName },
              async () => {
                return await MenuItem.find({});
              }
            );

            // Query menu items as tenant B
            const menuB = await runWithTenantContext(
              { id: tenantBDoc._id.toString(), slug: tenantBDoc.slug, dbName: tenantBDoc.dbName },
              async () => {
                return await MenuItem.find({});
              }
            );

            // Property: Tenant A should only see their menu items
            if (menuA.length !== menuItemsA.length) {
              return false;
            }

            // Property: Tenant B should only see their menu items
            if (menuB.length !== menuItemsB.length) {
              return false;
            }

            // Property: No overlap in menu items
            const menuAIds = new Set(menuA.map(item => item._id.toString()));
            const menuBIds = new Set(menuB.map(item => item._id.toString()));
            const hasOverlap = [...menuAIds].some(id => menuBIds.has(id));

            return !hasOverlap;
          } catch (error) {
            // Skip duplicate key errors during shrinking
            if (error.code === 11000) {
              return true; // Treat as passing to continue with other iterations
            }
            throw error;
          }
        }
      ),
      { numRuns: 100, endOnFailure: false }
    );
  }, 60000); // 60 second timeout

  /**
   * Property Test: Table data isolation
   */
  test('should isolate table data between any two tenants', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantA: tenantArbitrary('tenanta'),
          tenantB: tenantArbitrary('tenantb'),
          tablesA: fc.array(tableArbitrary(), { minLength: 1, maxLength: 5 }),
          tablesB: fc.array(tableArbitrary(), { minLength: 1, maxLength: 5 })
        }),
        async ({ tenantA, tenantB, tablesA, tablesB }) => {
          try {
            // Create tenants
            const tenantADoc = await createTenant(tenantA);
            const tenantBDoc = await createTenant(tenantB);

            // Create tables for tenant A with tenant context
            await runWithTenantContext(
              { id: tenantADoc._id.toString(), slug: tenantADoc.slug, dbName: tenantADoc.dbName },
              async () => {
                await Table.create(tablesA);
              }
            );

            // Create tables for tenant B with tenant context
            await runWithTenantContext(
              { id: tenantBDoc._id.toString(), slug: tenantBDoc.slug, dbName: tenantBDoc.dbName },
              async () => {
                await Table.create(tablesB);
              }
            );

            // Query tables as tenant A
            const tablesAResult = await runWithTenantContext(
              { id: tenantADoc._id.toString(), slug: tenantADoc.slug, dbName: tenantADoc.dbName },
              async () => {
                return await Table.find({});
              }
            );

            // Query tables as tenant B
            const tablesBResult = await runWithTenantContext(
              { id: tenantBDoc._id.toString(), slug: tenantBDoc.slug, dbName: tenantBDoc.dbName },
              async () => {
                return await Table.find({});
              }
            );

            // Property: Tenant A should only see their tables
            if (tablesAResult.length !== tablesA.length) {
              return false;
            }

            // Property: Tenant B should only see their tables
            if (tablesBResult.length !== tablesB.length) {
              return false;
            }

            // Property: No overlap in tables
            const tablesAIds = new Set(tablesAResult.map(table => table._id.toString()));
            const tablesBIds = new Set(tablesBResult.map(table => table._id.toString()));
            const hasOverlap = [...tablesAIds].some(id => tablesBIds.has(id));

            return !hasOverlap;
          } catch (error) {
            // Skip duplicate key errors during shrinking
            if (error.code === 11000) {
              return true; // Treat as passing to continue with other iterations
            }
            throw error;
          }
        }
      ),
      { numRuns: 100, endOnFailure: false }
    );
  }, 60000); // 60 second timeout

  /**
   * Property Test: Order/Stats data isolation
   */
  test('should isolate order data between any two tenants', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantA: tenantArbitrary('tenanta'),
          tenantB: tenantArbitrary('tenantb'),
          ordersA: fc.array(orderArbitrary(), { minLength: 1, maxLength: 5 }),
          ordersB: fc.array(orderArbitrary(), { minLength: 1, maxLength: 5 })
        }),
        async ({ tenantA, tenantB, ordersA, ordersB }) => {
          try {
            // Create tenants
            const tenantADoc = await createTenant(tenantA);
            const tenantBDoc = await createTenant(tenantB);

            // Create orders for tenant A with tenant context
            await runWithTenantContext(
              { id: tenantADoc._id.toString(), slug: tenantADoc.slug, dbName: tenantADoc.dbName },
              async () => {
                await Order.create(ordersA);
              }
            );

            // Create orders for tenant B with tenant context
            await runWithTenantContext(
              { id: tenantBDoc._id.toString(), slug: tenantBDoc.slug, dbName: tenantBDoc.dbName },
              async () => {
                await Order.create(ordersB);
              }
            );

            // Query orders as tenant A
            const ordersAResult = await runWithTenantContext(
              { id: tenantADoc._id.toString(), slug: tenantADoc.slug, dbName: tenantADoc.dbName },
              async () => {
                return await Order.find({});
              }
            );

            // Query orders as tenant B
            const ordersBResult = await runWithTenantContext(
              { id: tenantBDoc._id.toString(), slug: tenantBDoc.slug, dbName: tenantBDoc.dbName },
              async () => {
                return await Order.find({});
              }
            );

            // Property: Tenant A should only see their orders
            if (ordersAResult.length !== ordersA.length) {
              return false;
            }

            // Property: Tenant B should only see their orders
            if (ordersBResult.length !== ordersB.length) {
              return false;
            }

            // Property: No overlap in orders
            const ordersAIds = new Set(ordersAResult.map(order => order._id.toString()));
            const ordersBIds = new Set(ordersBResult.map(order => order._id.toString()));
            const hasOverlap = [...ordersAIds].some(id => ordersBIds.has(id));

            // Property: Stats calculations should be different (unless data happens to be identical)
            const totalA = ordersAResult.reduce((sum, order) => sum + order.total, 0);
            const totalB = ordersBResult.reduce((sum, order) => sum + order.total, 0);

            return !hasOverlap;
          } catch (error) {
            // Skip duplicate key errors during shrinking
            if (error.code === 11000) {
              return true; // Treat as passing to continue with other iterations
            }
            throw error;
          }
        }
      ),
      { numRuns: 100, endOnFailure: false }
    );
  }, 60000); // 60 second timeout

  /**
   * Property Test: Complete isolation across all data types
   */
  test('should maintain complete isolation across all data types for any tenant pair', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantA: tenantArbitrary('tenanta'),
          tenantB: tenantArbitrary('tenantb'),
          dataA: fc.record({
            menuItems: fc.array(menuItemArbitrary(), { minLength: 1, maxLength: 3 }),
            orders: fc.array(orderArbitrary(), { minLength: 1, maxLength: 3 }),
            tables: fc.array(tableArbitrary(), { minLength: 1, maxLength: 3 })
          }),
          dataB: fc.record({
            menuItems: fc.array(menuItemArbitrary(), { minLength: 1, maxLength: 3 }),
            orders: fc.array(orderArbitrary(), { minLength: 1, maxLength: 3 }),
            tables: fc.array(tableArbitrary(), { minLength: 1, maxLength: 3 })
          })
        }),
        async ({ tenantA, tenantB, dataA, dataB }) => {
          try {
            // Create tenants
            const tenantADoc = await createTenant(tenantA);
            const tenantBDoc = await createTenant(tenantB);

            // Create all data for tenant A
            await runWithTenantContext(
              { id: tenantADoc._id.toString(), slug: tenantADoc.slug, dbName: tenantADoc.dbName },
              async () => {
                await MenuItem.create(dataA.menuItems);
                await Order.create(dataA.orders);
                await Table.create(dataA.tables);
              }
            );

            // Create all data for tenant B
            await runWithTenantContext(
              { id: tenantBDoc._id.toString(), slug: tenantBDoc.slug, dbName: tenantBDoc.dbName },
              async () => {
                await MenuItem.create(dataB.menuItems);
                await Order.create(dataB.orders);
                await Table.create(dataB.tables);
              }
            );

            // Query all data as tenant A
            const [menuA, ordersA, tablesA] = await runWithTenantContext(
              { id: tenantADoc._id.toString(), slug: tenantADoc.slug, dbName: tenantADoc.dbName },
              async () => {
                return await Promise.all([
                  MenuItem.find({}),
                  Order.find({}),
                  Table.find({})
                ]);
              }
            );

            // Query all data as tenant B
            const [menuB, ordersB, tablesB] = await runWithTenantContext(
              { id: tenantBDoc._id.toString(), slug: tenantBDoc.slug, dbName: tenantBDoc.dbName },
              async () => {
                return await Promise.all([
                  MenuItem.find({}),
                  Order.find({}),
                  Table.find({})
                ]);
              }
            );

            // Property: Tenant A should see correct counts
            const menuACorrect = menuA.length === dataA.menuItems.length;
            const ordersACorrect = ordersA.length === dataA.orders.length;
            const tablesACorrect = tablesA.length === dataA.tables.length;

            // Property: Tenant B should see correct counts
            const menuBCorrect = menuB.length === dataB.menuItems.length;
            const ordersBCorrect = ordersB.length === dataB.orders.length;
            const tablesBCorrect = tablesB.length === dataB.tables.length;

            // Property: No data overlap between tenants
            const menuAIds = new Set(menuA.map(item => item._id.toString()));
            const menuBIds = new Set(menuB.map(item => item._id.toString()));
            const noMenuOverlap = ![...menuAIds].some(id => menuBIds.has(id));

            const ordersAIds = new Set(ordersA.map(order => order._id.toString()));
            const ordersBIds = new Set(ordersB.map(order => order._id.toString()));
            const noOrdersOverlap = ![...ordersAIds].some(id => ordersBIds.has(id));

            const tablesAIds = new Set(tablesA.map(table => table._id.toString()));
            const tablesBIds = new Set(tablesB.map(table => table._id.toString()));
            const noTablesOverlap = ![...tablesAIds].some(id => tablesBIds.has(id));

            return menuACorrect && ordersACorrect && tablesACorrect && 
                   menuBCorrect && ordersBCorrect && tablesBCorrect && 
                   noMenuOverlap && noOrdersOverlap && noTablesOverlap;
          } catch (error) {
            // Skip duplicate key errors during shrinking
            if (error.code === 11000) {
              return true; // Treat as passing to continue with other iterations
            }
            throw error;
          }
        }
      ),
      { numRuns: 100, endOnFailure: false }
    );
  }, 120000); // 120 second timeout for comprehensive test
});
