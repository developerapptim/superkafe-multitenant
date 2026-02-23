/**
 * Property-Based Test: Automatic TenantId Filter Injection
 * 
 * Feature: dashboard-tenant-isolation-fix, Property 5: Automatic TenantId Filter Injection
 * **Validates: Requirements 3.4**
 * 
 * This test verifies that the tenantScopingPlugin automatically injects tenantId filters
 * into all database queries when tenant context is available. We intercept queries before
 * execution and verify the filter conditions contain the correct tenantId.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fc = require('fast-check');

// Import models that use the tenant scoping plugin
const MenuItem = require('../../models/MenuItem');
const Order = require('../../models/Order');
const Table = require('../../models/Table');
const Tenant = require('../../models/Tenant');

// Import utilities
const { runWithTenantContext } = require('../../utils/tenantContext');

describe('Property 5: Automatic TenantId Filter Injection', () => {
  let mongoServer;
  let mainConnection;

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
  }, 10000); // 10 second timeout

  /**
   * Helper: Generate valid MongoDB ObjectId hex string (24 hex characters)
   */
  const objectIdArbitrary = () => 
    fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 24, maxLength: 24 })
      .map(arr => arr.map(n => n.toString(16)).join(''));

  /**
   * Helper: Create a tenant in the database
   */
  async function createTenant(tenantId) {
    const uniqueId = `${Date.now()}${Math.floor(Math.random() * 1000000)}`;
    const tenant = await Tenant.create({
      _id: new mongoose.Types.ObjectId(tenantId),
      name: `Test Tenant ${uniqueId}`,
      slug: `test-tenant-${uniqueId}`,
      dbName: `tenant_test_${uniqueId}`,
      isActive: true
    });
    return tenant;
  }

  /**
   * Helper: Intercept query and capture filter conditions
   * Returns a promise that resolves with the filter when a query is executed
   */
  function interceptQuery(Model) {
    return new Promise((resolve) => {
      const originalFind = Model.find;
      
      // Override find method temporarily
      Model.find = function(filter, ...args) {
        // Capture the filter before query execution
        const query = originalFind.call(this, filter, ...args);
        
        // Hook into the query execution to capture final filter
        const originalExec = query.exec;
        query.exec = async function() {
          const finalFilter = this.getFilter();
          resolve(finalFilter);
          
          // Restore original methods
          Model.find = originalFind;
          
          // Execute the query
          return originalExec.call(this);
        };
        
        return query;
      };
    });
  }

  /**
   * Property Test: Find queries should have tenantId filter injected
   */
  test('should inject tenantId filter for find() queries with any random tenant ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArbitrary(),
        async (tenantIdHex) => {
          try {
            // Create tenant
            const tenant = await createTenant(tenantIdHex);
            const tenantId = tenant._id.toString();

            // Set up query interception
            const filterPromise = interceptQuery(MenuItem);

            // Execute query within tenant context
            await runWithTenantContext(
              { id: tenantId, slug: tenant.slug, dbName: tenant.dbName },
              async () => {
                // Trigger a find query
                const query = MenuItem.find({});
                await query.exec();
              }
            );

            // Get the captured filter
            const capturedFilter = await filterPromise;

            // Property: Filter must contain tenantId matching the context
            return capturedFilter.tenantId && 
                   capturedFilter.tenantId.toString() === tenantId;
          } catch (error) {
            // Skip duplicate key errors
            if (error.code === 11000) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100, endOnFailure: false }
    );
  }, 60000);

  /**
   * Property Test: FindOne queries should have tenantId filter injected
   */
  test('should inject tenantId filter for findOne() queries with any random tenant ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArbitrary(),
        async (tenantIdHex) => {
          try {
            // Create tenant
            const tenant = await createTenant(tenantIdHex);
            const tenantId = tenant._id.toString();

            // Set up query interception
            const filterPromise = new Promise((resolve) => {
              const originalFindOne = Order.findOne;
              
              Order.findOne = function(filter, ...args) {
                const query = originalFindOne.call(this, filter, ...args);
                
                const originalExec = query.exec;
                query.exec = async function() {
                  const finalFilter = this.getFilter();
                  resolve(finalFilter);
                  Order.findOne = originalFindOne;
                  return originalExec.call(this);
                };
                
                return query;
              };
            });

            // Execute query within tenant context
            await runWithTenantContext(
              { id: tenantId, slug: tenant.slug, dbName: tenant.dbName },
              async () => {
                const query = Order.findOne({});
                await query.exec();
              }
            );

            // Get the captured filter
            const capturedFilter = await filterPromise;

            // Property: Filter must contain tenantId matching the context
            return capturedFilter.tenantId && 
                   capturedFilter.tenantId.toString() === tenantId;
          } catch (error) {
            if (error.code === 11000) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100, endOnFailure: false }
    );
  }, 60000);

  /**
   * Property Test: Update queries should have tenantId filter injected
   */
  test('should inject tenantId filter for updateMany() queries with any random tenant ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArbitrary(),
        fc.string({ minLength: 1, maxLength: 10 }),
        async (tenantIdHex, newStatus) => {
          try {
            // Create tenant
            const tenant = await createTenant(tenantIdHex);
            const tenantId = tenant._id.toString();

            // Set up query interception
            const filterPromise = new Promise((resolve) => {
              const originalUpdateMany = Table.updateMany;
              
              Table.updateMany = function(filter, ...args) {
                const query = originalUpdateMany.call(this, filter, ...args);
                
                const originalExec = query.exec;
                query.exec = async function() {
                  const finalFilter = this.getFilter();
                  resolve(finalFilter);
                  Table.updateMany = originalUpdateMany;
                  return originalExec.call(this);
                };
                
                return query;
              };
            });

            // Execute query within tenant context
            await runWithTenantContext(
              { id: tenantId, slug: tenant.slug, dbName: tenant.dbName },
              async () => {
                const query = Table.updateMany({}, { status: newStatus });
                await query.exec();
              }
            );

            // Get the captured filter
            const capturedFilter = await filterPromise;

            // Property: Filter must contain tenantId matching the context
            return capturedFilter.tenantId && 
                   capturedFilter.tenantId.toString() === tenantId;
          } catch (error) {
            if (error.code === 11000) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100, endOnFailure: false }
    );
  }, 60000);

  /**
   * Property Test: Delete queries should have tenantId filter injected
   */
  test('should inject tenantId filter for deleteMany() queries with any random tenant ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArbitrary(),
        async (tenantIdHex) => {
          try {
            // Create tenant
            const tenant = await createTenant(tenantIdHex);
            const tenantId = tenant._id.toString();

            // Set up query interception
            const filterPromise = new Promise((resolve) => {
              const originalDeleteMany = MenuItem.deleteMany;
              
              MenuItem.deleteMany = function(filter, ...args) {
                const query = originalDeleteMany.call(this, filter, ...args);
                
                const originalExec = query.exec;
                query.exec = async function() {
                  const finalFilter = this.getFilter();
                  resolve(finalFilter);
                  MenuItem.deleteMany = originalDeleteMany;
                  return originalExec.call(this);
                };
                
                return query;
              };
            });

            // Execute query within tenant context
            await runWithTenantContext(
              { id: tenantId, slug: tenant.slug, dbName: tenant.dbName },
              async () => {
                const query = MenuItem.deleteMany({});
                await query.exec();
              }
            );

            // Get the captured filter
            const capturedFilter = await filterPromise;

            // Property: Filter must contain tenantId matching the context
            return capturedFilter.tenantId && 
                   capturedFilter.tenantId.toString() === tenantId;
          } catch (error) {
            if (error.code === 11000) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100, endOnFailure: false }
    );
  }, 60000);

  /**
   * Property Test: Count queries should have tenantId filter injected
   */
  test('should inject tenantId filter for countDocuments() queries with any random tenant ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArbitrary(),
        async (tenantIdHex) => {
          try {
            // Create tenant
            const tenant = await createTenant(tenantIdHex);
            const tenantId = tenant._id.toString();

            // Set up query interception
            const filterPromise = new Promise((resolve) => {
              const originalCountDocuments = Order.countDocuments;
              
              Order.countDocuments = function(filter, ...args) {
                const query = originalCountDocuments.call(this, filter, ...args);
                
                const originalExec = query.exec;
                query.exec = async function() {
                  const finalFilter = this.getFilter();
                  resolve(finalFilter);
                  Order.countDocuments = originalCountDocuments;
                  return originalExec.call(this);
                };
                
                return query;
              };
            });

            // Execute query within tenant context
            await runWithTenantContext(
              { id: tenantId, slug: tenant.slug, dbName: tenant.dbName },
              async () => {
                const query = Order.countDocuments({});
                await query.exec();
              }
            );

            // Get the captured filter
            const capturedFilter = await filterPromise;

            // Property: Filter must contain tenantId matching the context
            return capturedFilter.tenantId && 
                   capturedFilter.tenantId.toString() === tenantId;
          } catch (error) {
            if (error.code === 11000) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100, endOnFailure: false }
    );
  }, 60000);

  /**
   * Property Test: Filter injection should work with additional query conditions
   */
  test('should inject tenantId filter alongside other query conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArbitrary(),
        fc.constantFrom('available', 'occupied', 'reserved'),
        async (tenantIdHex, status) => {
          try {
            // Create tenant
            const tenant = await createTenant(tenantIdHex);
            const tenantId = tenant._id.toString();

            // Set up query interception
            const filterPromise = new Promise((resolve) => {
              const originalFind = Table.find;
              
              Table.find = function(filter, ...args) {
                const query = originalFind.call(this, filter, ...args);
                
                const originalExec = query.exec;
                query.exec = async function() {
                  const finalFilter = this.getFilter();
                  resolve(finalFilter);
                  Table.find = originalFind;
                  return originalExec.call(this);
                };
                
                return query;
              };
            });

            // Execute query with additional conditions within tenant context
            await runWithTenantContext(
              { id: tenantId, slug: tenant.slug, dbName: tenant.dbName },
              async () => {
                const query = Table.find({ status });
                await query.exec();
              }
            );

            // Get the captured filter
            const capturedFilter = await filterPromise;

            // Property: Filter must contain both tenantId and the original condition
            return capturedFilter.tenantId && 
                   capturedFilter.tenantId.toString() === tenantId &&
                   capturedFilter.status === status;
          } catch (error) {
            if (error.code === 11000) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100, endOnFailure: false }
    );
  }, 60000);

  /**
   * Property Test: Filter injection should work across different models
   */
  test('should inject tenantId filter consistently across all tenant-scoped models', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArbitrary(),
        async (tenantIdHex) => {
          try {
            // Create tenant
            const tenant = await createTenant(tenantIdHex);
            const tenantId = tenant._id.toString();

            const capturedFilters = [];

            // Intercept queries for multiple models
            const models = [
              { Model: MenuItem, name: 'MenuItem' },
              { Model: Order, name: 'Order' },
              { Model: Table, name: 'Table' }
            ];

            // Execute queries for all models within tenant context
            await runWithTenantContext(
              { id: tenantId, slug: tenant.slug, dbName: tenant.dbName },
              async () => {
                for (const { Model, name } of models) {
                  const filterPromise = new Promise((resolve) => {
                    const originalFind = Model.find;
                    
                    Model.find = function(filter, ...args) {
                      const query = originalFind.call(this, filter, ...args);
                      
                      const originalExec = query.exec;
                      query.exec = async function() {
                        const finalFilter = this.getFilter();
                        resolve({ model: name, filter: finalFilter });
                        Model.find = originalFind;
                        return originalExec.call(this);
                      };
                      
                      return query;
                    };
                  });

                  const query = Model.find({});
                  await query.exec();
                  
                  const result = await filterPromise;
                  capturedFilters.push(result);
                }
              }
            );

            // Property: All models should have tenantId filter injected with same tenant ID
            return capturedFilters.every(({ filter }) => 
              filter.tenantId && filter.tenantId.toString() === tenantId
            );
          } catch (error) {
            if (error.code === 11000) {
              return true;
            }
            throw error;
          }
        }
      ),
      { numRuns: 100, endOnFailure: false }
    );
  }, 90000);
});
