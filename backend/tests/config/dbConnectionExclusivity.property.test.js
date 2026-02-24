const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fc = require('fast-check');
const { connectMainDB, getConnection, closeConnection } = require('../../config/db');
const tenantScopingPlugin = require('../../plugins/tenantScopingPlugin');
const { runWithTenantContext } = require('../../utils/tenantContext');

/**
 * Property-Based Tests for Database Connection Exclusivity
 * 
 * Feature: unified-nexus-architecture
 * Property 1: Database Connection Exclusivity
 * 
 * **Validates: Requirements 1.1, 1.3, 1.4, 1.5**
 * 
 * For any database operation in the system, the connection used SHALL always 
 * target the `superkafe_v2` database and never create or connect to 
 * tenant-specific databases.
 * 
 * This test verifies that:
 * - All Mongoose models use the superkafe_v2 database
 * - No tenant-specific databases are created or accessed
 * - Database operations across different tenants use the same database
 * - The connection remains exclusive to superkafe_v2 throughout operations
 */

// Helper: Generate valid MongoDB ObjectId hex string (24 hex characters)
const objectIdArbitrary = () => 
  fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 24, maxLength: 24 })
    .map(arr => arr.map(n => n.toString(16)).join(''));

// Helper: Generate tenant slug
const tenantSlugArbitrary = () =>
  fc.stringMatching(/^[a-z0-9-]{3,20}$/);

describe('Property 1: Database Connection Exclusivity', () => {
  let mongoServer;
  let TestModel;
  const EXPECTED_DB_NAME = 'superkafe_v2';

  beforeAll(async () => {
    // Create in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    
    // Get the URI and append the database name
    const mongoUri = mongoServer.getUri();
    const mongoUriWithDb = mongoUri.replace(/\/$/, '') + '/' + EXPECTED_DB_NAME;
    
    // Override MONGODB_URI for testing
    process.env.MONGODB_URI = mongoUriWithDb;
    
    // Connect using the actual db.js module
    await connectMainDB();

    // Create test schema with tenant scoping plugin
    const testSchema = new mongoose.Schema({
      name: { type: String, required: true },
      value: { type: Number },
      category: { type: String }
    });

    testSchema.plugin(tenantScopingPlugin);

    TestModel = mongoose.model('DbExclusivityTest', testSchema);
  });

  afterAll(async () => {
    await closeConnection();
    await mongoServer.stop();
  });

  afterEach(async () => {
    // Clean up test data
    await TestModel.deleteMany({});
  });

  /**
   * Property 1.1: All model operations use superkafe_v2 database
   * 
   * For any operation (create, read, update, delete) on any model,
   * the database name must always be superkafe_v2.
   */
  test('should always use superkafe_v2 database for all CRUD operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          operation: fc.constantFrom('create', 'find', 'update', 'delete'),
          tenantId: objectIdArbitrary(),
          tenantSlug: tenantSlugArbitrary(),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          value: fc.integer({ min: 0, max: 10000 })
        }),
        async ({ operation, tenantId, tenantSlug, name, value }) => {
          const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
          
          // Execute operation within tenant context
          await runWithTenantContext(
            { id: tenantObjectId, slug: tenantSlug },
            async () => {
              let doc;
              
              switch (operation) {
                case 'create':
                  doc = await TestModel.create({ name, value });
                  break;
                  
                case 'find':
                  // Create a document first to find
                  await TestModel.create({ name, value });
                  await TestModel.find({});
                  break;
                  
                case 'update':
                  // Create a document first to update
                  doc = await TestModel.create({ name, value });
                  await TestModel.updateOne({ _id: doc._id }, { value: value + 1 });
                  break;
                  
                case 'delete':
                  // Create a document first to delete
                  doc = await TestModel.create({ name, value });
                  await TestModel.deleteOne({ _id: doc._id });
                  break;
              }
              
              // Property: The model's database must always be superkafe_v2
              const dbName = TestModel.db.name;
              return dbName === EXPECTED_DB_NAME;
            }
          );
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.2: Connection remains exclusive across multiple tenants
   * 
   * For any sequence of operations across different tenants,
   * all operations must use the same superkafe_v2 database.
   */
  test('should use superkafe_v2 database for operations across multiple tenants', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            tenantId: objectIdArbitrary(),
            tenantSlug: tenantSlugArbitrary(),
            documents: fc.array(
              fc.record({
                name: fc.string({ minLength: 1, maxLength: 50 }),
                value: fc.integer({ min: 0, max: 1000 })
              }),
              { minLength: 1, maxLength: 5 }
            )
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (tenants) => {
          const dbNames = new Set();
          
          // Create documents for each tenant and track database names
          for (const tenant of tenants) {
            const tenantObjectId = new mongoose.Types.ObjectId(tenant.tenantId);
            
            await runWithTenantContext(
              { id: tenantObjectId, slug: tenant.tenantSlug },
              async () => {
                await TestModel.create(tenant.documents);
                
                // Track the database name used
                dbNames.add(TestModel.db.name);
              }
            );
          }
          
          // Property: Only one database should be used (superkafe_v2)
          // and it must be the expected database name
          return dbNames.size === 1 && dbNames.has(EXPECTED_DB_NAME);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.3: No tenant-specific database connections are created
   * 
   * For any tenant operation, the system must not create or switch to
   * tenant-specific databases (e.g., tenant_negoes, tenant_xyz).
   */
  test('should never create tenant-specific database connections', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            tenantId: objectIdArbitrary(),
            tenantSlug: tenantSlugArbitrary(),
            name: fc.string({ minLength: 1, maxLength: 50 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (tenants) => {
          // Perform operations for multiple tenants
          for (const tenant of tenants) {
            const tenantObjectId = new mongoose.Types.ObjectId(tenant.tenantId);
            
            await runWithTenantContext(
              { id: tenantObjectId, slug: tenant.tenantSlug },
              async () => {
                await TestModel.create({ name: tenant.name, value: 100 });
              }
            );
          }
          
          // Property: The connection should still be to superkafe_v2
          const connection = getConnection();
          const dbName = connection.name;
          
          // Verify no tenant-specific database names
          const hasTenantSpecificDb = tenants.some(t => 
            dbName.includes(t.tenantSlug) || 
            dbName.includes('tenant_') ||
            dbName !== EXPECTED_DB_NAME
          );
          
          return !hasTenantSpecificDb && dbName === EXPECTED_DB_NAME;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.4: Database connection remains stable across concurrent operations
   * 
   * For any set of concurrent operations from different tenants,
   * all operations must use the same superkafe_v2 database without switching.
   */
  test('should maintain superkafe_v2 connection during concurrent tenant operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            tenantId: objectIdArbitrary(),
            tenantSlug: tenantSlugArbitrary(),
            operations: fc.array(
              fc.record({
                type: fc.constantFrom('create', 'find', 'update'),
                name: fc.string({ minLength: 1, maxLength: 30 }),
                value: fc.integer({ min: 0, max: 1000 })
              }),
              { minLength: 1, maxLength: 3 }
            )
          }),
          { minLength: 2, maxLength: 4 }
        ),
        async (tenants) => {
          // Execute operations concurrently for all tenants
          const results = await Promise.all(
            tenants.map(tenant => {
              const tenantObjectId = new mongoose.Types.ObjectId(tenant.tenantId);
              
              return runWithTenantContext(
                { id: tenantObjectId, slug: tenant.tenantSlug },
                async () => {
                  const dbNames = [];
                  
                  for (const op of tenant.operations) {
                    switch (op.type) {
                      case 'create':
                        await TestModel.create({ name: op.name, value: op.value });
                        break;
                      case 'find':
                        await TestModel.find({});
                        break;
                      case 'update':
                        await TestModel.updateMany({}, { value: op.value });
                        break;
                    }
                    
                    // Track database name after each operation
                    dbNames.push(TestModel.db.name);
                  }
                  
                  return dbNames;
                }
              );
            })
          );
          
          // Property: All operations across all tenants must use superkafe_v2
          const allDbNames = results.flat();
          return allDbNames.every(dbName => dbName === EXPECTED_DB_NAME);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1.5: Aggregation operations use superkafe_v2 database
   * 
   * For any aggregation pipeline operation, the database used
   * must be superkafe_v2.
   */
  test('should use superkafe_v2 database for aggregation operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: objectIdArbitrary(),
          tenantSlug: tenantSlugArbitrary(),
          documents: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              value: fc.integer({ min: 0, max: 1000 }),
              category: fc.constantFrom('food', 'drink', 'snack')
            }),
            { minLength: 3, maxLength: 10 }
          )
        }),
        async ({ tenantId, tenantSlug, documents }) => {
          const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
          
          await runWithTenantContext(
            { id: tenantObjectId, slug: tenantSlug },
            async () => {
              // Create documents
              await TestModel.create(documents);
              
              // Perform aggregation
              await TestModel.aggregate([
                { $group: { _id: '$category', total: { $sum: '$value' } } },
                { $sort: { total: -1 } }
              ]);
              
              // Property: Database must be superkafe_v2
              return TestModel.db.name === EXPECTED_DB_NAME;
            }
          );
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.6: Connection instance remains singular
   * 
   * For any sequence of operations, the system must maintain
   * a single connection instance to superkafe_v2.
   */
  test('should maintain single connection instance to superkafe_v2', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            tenantId: objectIdArbitrary(),
            tenantSlug: tenantSlugArbitrary(),
            name: fc.string({ minLength: 1, maxLength: 50 })
          }),
          { minLength: 2, maxLength: 8 }
        ),
        async (tenants) => {
          const connections = new Set();
          
          // Perform operations and track connection instances
          for (const tenant of tenants) {
            const tenantObjectId = new mongoose.Types.ObjectId(tenant.tenantId);
            
            await runWithTenantContext(
              { id: tenantObjectId, slug: tenant.tenantSlug },
              async () => {
                await TestModel.create({ name: tenant.name, value: 100 });
                
                // Track connection instance
                const conn = getConnection();
                connections.add(conn);
              }
            );
          }
          
          // Property: Only one connection instance should exist
          // and it should be connected to superkafe_v2
          const connection = getConnection();
          return connections.size === 1 && 
                 connection.name === EXPECTED_DB_NAME &&
                 connection.readyState === 1; // 1 = connected
        }
      ),
      { numRuns: 100 }
    );
  });
});
