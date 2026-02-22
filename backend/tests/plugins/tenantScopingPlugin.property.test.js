const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fc = require('fast-check');
const tenantScopingPlugin = require('../../plugins/tenantScopingPlugin');
const { runWithTenantContext } = require('../../utils/tenantContext');

/**
 * Property-Based Tests for Tenant Scoping Plugin
 * 
 * Feature: tenant-data-isolation
 * 
 * These tests verify universal properties that should hold across all inputs:
 * - Property 10: Automatic TenantId Filter Injection
 * - Property 12: New Records Auto-Tagged with TenantId
 * 
 * Validates: Requirements 2.2, 2.4
 */

// Helper: Generate valid MongoDB ObjectId hex string (24 hex characters)
const objectIdArbitrary = () => 
  fc.integer({ min: 0, max: 15 }).chain(() =>
    fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 24, maxLength: 24 })
      .map(arr => arr.map(n => n.toString(16)).join(''))
  );

describe('Tenant Scoping Plugin - Property Tests', () => {
  let mongoServer;
  let TestModel;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test schema with plugin
    const testSchema = new mongoose.Schema({
      name: { type: String, required: true },
      value: { type: Number },
      category: { type: String }
    });

    testSchema.plugin(tenantScopingPlugin);

    TestModel = mongoose.model('PropertyTestItem', testSchema);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await TestModel.deleteMany({});
  });

  /**
   * Property 10: Automatic TenantId Filter Injection
   * 
   * For any query executed on a tenant-scoped Mongoose model, 
   * the query filter should automatically include the tenantId 
   * from the request context.
   * 
   * **Validates: Requirements 2.2**
   */
  describe('Property 10: Automatic TenantId Filter Injection', () => {
    test('should inject tenantId filter for any find query with random data', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random tenant IDs and document data
          fc.array(fc.record({
            tenantId: objectIdArbitrary(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer({ min: 0, max: 10000 }),
            category: fc.constantFrom('food', 'drink', 'snack', 'dessert')
          }), { minLength: 2, maxLength: 10 }),
          fc.nat({ max: 100 }), // Random index to select which tenant to query
          async (documents, queryIndex) => {
            // Skip if no documents
            if (documents.length === 0) return true;

            // Create documents for multiple tenants
            const createdDocs = await Promise.all(
              documents.map(doc => 
                TestModel.create({
                  ...doc,
                  tenantId: new mongoose.Types.ObjectId(doc.tenantId)
                })
              )
            );

            // Select a tenant to query
            const selectedTenant = createdDocs[queryIndex % documents.length];
            const selectedTenantId = selectedTenant.tenantId;

            // Query within tenant context
            const results = await runWithTenantContext(
              { id: selectedTenantId, slug: 'test-tenant' },
              async () => TestModel.find({})
            );

            // Property: All returned documents must belong to the selected tenant
            const allBelongToTenant = results.every(
              doc => doc.tenantId.toString() === selectedTenantId.toString()
            );

            // Property: No documents from other tenants should be returned
            const expectedCount = createdDocs.filter(
              doc => doc.tenantId.toString() === selectedTenantId.toString()
            ).length;

            return allBelongToTenant && results.length === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should inject tenantId filter for findOne queries across random conditions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({
            tenantId: objectIdArbitrary(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer({ min: 0, max: 1000 })
          }), { minLength: 3, maxLength: 15 }),
          fc.nat({ max: 100 }),
          async (documents, queryIndex) => {
            if (documents.length === 0) return true;

            // Create documents
            const createdDocs = await Promise.all(
              documents.map(doc => 
                TestModel.create({
                  ...doc,
                  tenantId: new mongoose.Types.ObjectId(doc.tenantId)
                })
              )
            );

            const selectedTenant = createdDocs[queryIndex % documents.length];
            const selectedTenantId = selectedTenant.tenantId;

            // Query with findOne
            const result = await runWithTenantContext(
              { id: selectedTenantId, slug: 'test-tenant' },
              async () => TestModel.findOne({})
            );

            // Property: If a result is found, it must belong to the selected tenant
            if (result) {
              return result.tenantId.toString() === selectedTenantId.toString();
            }

            // If no result, verify no documents exist for this tenant
            const docsForTenant = createdDocs.filter(
              doc => doc.tenantId.toString() === selectedTenantId.toString()
            );
            return docsForTenant.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should inject tenantId filter for update queries with random updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({
            tenantId: objectIdArbitrary(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer({ min: 0, max: 1000 })
          }), { minLength: 2, maxLength: 8 }),
          fc.integer({ min: 1, max: 5000 }), // New value to update
          fc.nat({ max: 100 }),
          async (documents, newValue, queryIndex) => {
            if (documents.length === 0) return true;

            // Create documents
            const createdDocs = await Promise.all(
              documents.map(doc => 
                TestModel.create({
                  ...doc,
                  tenantId: new mongoose.Types.ObjectId(doc.tenantId)
                })
              )
            );

            const selectedTenant = createdDocs[queryIndex % documents.length];
            const selectedTenantId = selectedTenant.tenantId;

            // Update within tenant context
            await runWithTenantContext(
              { id: selectedTenantId, slug: 'test-tenant' },
              async () => TestModel.updateMany({}, { value: newValue })
            );

            // Property: Only documents belonging to selected tenant should be updated
            const allDocs = await TestModel.find({}).lean();
            
            for (const doc of allDocs) {
              if (doc.tenantId.toString() === selectedTenantId.toString()) {
                // Documents from selected tenant should have new value
                if (doc.value !== newValue) return false;
              } else {
                // Documents from other tenants should retain original value
                const originalDoc = documents.find(
                  d => new mongoose.Types.ObjectId(d.tenantId).toString() === doc.tenantId.toString()
                );
                if (originalDoc && doc.value !== originalDoc.value) return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should inject tenantId filter for delete queries with random deletions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({
            tenantId: objectIdArbitrary(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer({ min: 0, max: 1000 })
          }), { minLength: 2, maxLength: 8 }),
          fc.nat({ max: 100 }),
          async (documents, queryIndex) => {
            if (documents.length === 0) return true;

            // Create documents
            const createdDocs = await Promise.all(
              documents.map(doc => 
                TestModel.create({
                  ...doc,
                  tenantId: new mongoose.Types.ObjectId(doc.tenantId)
                })
              )
            );

            const selectedTenant = createdDocs[queryIndex % documents.length];
            const selectedTenantId = selectedTenant.tenantId;

            const initialCount = createdDocs.length;
            const tenantDocsCount = createdDocs.filter(
              doc => doc.tenantId.toString() === selectedTenantId.toString()
            ).length;

            // Delete within tenant context
            await runWithTenantContext(
              { id: selectedTenantId, slug: 'test-tenant' },
              async () => TestModel.deleteMany({})
            );

            // Property: Only documents from selected tenant should be deleted
            const remainingDocs = await TestModel.find({}).lean();
            const expectedRemaining = initialCount - tenantDocsCount;

            // All remaining docs should NOT belong to selected tenant
            const noneFromSelectedTenant = remainingDocs.every(
              doc => doc.tenantId.toString() !== selectedTenantId.toString()
            );

            return remainingDocs.length === expectedRemaining && noneFromSelectedTenant;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should inject tenantId filter for count queries with random data sets', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({
            tenantId: objectIdArbitrary(),
            name: fc.string({ minLength: 1, maxLength: 50 })
          }), { minLength: 1, maxLength: 20 }),
          fc.nat({ max: 100 }),
          async (documents, queryIndex) => {
            if (documents.length === 0) return true;

            // Create documents
            const createdDocs = await Promise.all(
              documents.map(doc => 
                TestModel.create({
                  ...doc,
                  tenantId: new mongoose.Types.ObjectId(doc.tenantId)
                })
              )
            );

            const selectedTenant = createdDocs[queryIndex % documents.length];
            const selectedTenantId = selectedTenant.tenantId;

            // Count within tenant context
            const count = await runWithTenantContext(
              { id: selectedTenantId, slug: 'test-tenant' },
              async () => TestModel.countDocuments({})
            );

            // Property: Count should match number of documents for selected tenant
            const expectedCount = createdDocs.filter(
              doc => doc.tenantId.toString() === selectedTenantId.toString()
            ).length;

            return count === expectedCount;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: New Records Auto-Tagged with TenantId
   * 
   * For any new record created through a backend controller, 
   * the record should automatically have its tenantId field 
   * set to the requesting tenant's ID.
   * 
   * **Validates: Requirements 2.4**
   */
  describe('Property 12: New Records Auto-Tagged with TenantId', () => {
    test('should auto-tag new documents with tenantId from context for any input', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArbitrary(), // Random tenant ID
          fc.string({ minLength: 1, maxLength: 100 }), // Random name
          fc.integer({ min: -1000, max: 10000 }), // Random value
          fc.constantFrom('food', 'drink', 'snack', 'dessert', 'other'), // Random category
          async (tenantIdHex, name, value, category) => {
            const tenantId = new mongoose.Types.ObjectId(tenantIdHex);

            // Create document within tenant context
            const doc = await runWithTenantContext(
              { id: tenantId, slug: 'test-tenant' },
              async () => {
                const newDoc = new TestModel({ name, value, category });
                await newDoc.save();
                return newDoc;
              }
            );

            // Property: Document must have tenantId set to context tenant
            return doc.tenantId && doc.tenantId.toString() === tenantId.toString();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should auto-tag documents created with Model.create() for any tenant', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArbitrary(),
          fc.array(fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            value: fc.integer({ min: 0, max: 1000 }),
            category: fc.constantFrom('food', 'drink', 'snack')
          }), { minLength: 1, maxLength: 5 }),
          async (tenantIdHex, documents) => {
            const tenantId = new mongoose.Types.ObjectId(tenantIdHex);

            // Create multiple documents at once
            const createdDocs = await runWithTenantContext(
              { id: tenantId, slug: 'test-tenant' },
              async () => TestModel.create(documents)
            );

            // Property: All created documents must have correct tenantId
            return createdDocs.every(
              doc => doc.tenantId && doc.tenantId.toString() === tenantId.toString()
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should preserve explicit tenantId if provided during creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArbitrary(), // Context tenant
          objectIdArbitrary(), // Explicit tenant
          fc.string({ minLength: 1, maxLength: 50 }),
          async (contextTenantHex, explicitTenantHex, name) => {
            const contextTenantId = new mongoose.Types.ObjectId(contextTenantHex);
            const explicitTenantId = new mongoose.Types.ObjectId(explicitTenantHex);

            // Create document with explicit tenantId
            const doc = await runWithTenantContext(
              { id: contextTenantId, slug: 'context-tenant' },
              async () => {
                const newDoc = new TestModel({ 
                  name, 
                  value: 100,
                  tenantId: explicitTenantId 
                });
                await newDoc.save();
                return newDoc;
              }
            );

            // Property: Explicit tenantId should be preserved (not overridden)
            return doc.tenantId.toString() === explicitTenantId.toString();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should auto-tag documents across concurrent tenant contexts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({
            tenantId: objectIdArbitrary(),
            documents: fc.array(fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              value: fc.integer({ min: 0, max: 1000 })
            }), { minLength: 1, maxLength: 3 })
          }), { minLength: 2, maxLength: 5 }),
          async (tenantBatches) => {
            if (tenantBatches.length === 0) return true;

            // Create documents concurrently for multiple tenants
            const results = await Promise.all(
              tenantBatches.map(batch => {
                const tenantId = new mongoose.Types.ObjectId(batch.tenantId);
                return runWithTenantContext(
                  { id: tenantId, slug: `tenant-${batch.tenantId.substring(0, 8)}` },
                  async () => {
                    const docs = await TestModel.create(batch.documents);
                    return { tenantId, docs };
                  }
                );
              })
            );

            // Property: Each batch of documents should have correct tenantId
            for (const { tenantId, docs } of results) {
              const allCorrect = docs.every(
                doc => doc.tenantId.toString() === tenantId.toString()
              );
              if (!allCorrect) return false;
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should fail validation when no tenant context is available', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 0, max: 1000 }),
          async (name, value) => {
            // Try to create document without tenant context
            const doc = new TestModel({ name, value });
            
            // Property: Save should fail due to required tenantId field
            try {
              await doc.save();
              return false; // Should not succeed
            } catch (error) {
              // Should fail with validation error
              return error.name === 'ValidationError' && 
                     error.errors.tenantId !== undefined;
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Combined Property: Isolation Guarantee
   * 
   * Verifies that Properties 10 and 12 work together to ensure
   * complete tenant isolation across create and read operations.
   */
  describe('Combined: Create and Query Isolation', () => {
    test('should maintain isolation when creating and querying across multiple tenants', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({
            tenantId: objectIdArbitrary(),
            items: fc.array(fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              value: fc.integer({ min: 0, max: 1000 })
            }), { minLength: 1, maxLength: 5 })
          }), { minLength: 2, maxLength: 6 }),
          async (tenantData) => {
            if (tenantData.length === 0) return true;

            // Create documents for each tenant
            for (const tenant of tenantData) {
              const tenantId = new mongoose.Types.ObjectId(tenant.tenantId);
              await runWithTenantContext(
                { id: tenantId, slug: `tenant-${tenant.tenantId.substring(0, 8)}` },
                async () => TestModel.create(tenant.items)
              );
            }

            // Verify each tenant can only see their own data
            for (const tenant of tenantData) {
              const tenantId = new mongoose.Types.ObjectId(tenant.tenantId);
              const results = await runWithTenantContext(
                { id: tenantId, slug: `tenant-${tenant.tenantId.substring(0, 8)}` },
                async () => TestModel.find({})
              );

              // Property: Results should match exactly the items created for this tenant
              if (results.length !== tenant.items.length) return false;

              // All results must belong to this tenant
              const allBelongToTenant = results.every(
                doc => doc.tenantId.toString() === tenantId.toString()
              );
              if (!allBelongToTenant) return false;
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
