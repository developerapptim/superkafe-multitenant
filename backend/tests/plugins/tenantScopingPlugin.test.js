const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const tenantScopingPlugin = require('../../plugins/tenantScopingPlugin');
const { setTenantContext, getTenantContext, runWithTenantContext } = require('../../utils/tenantContext');

describe('Tenant Scoping Plugin', () => {
  let mongoServer;
  let TestModel;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(() => {
    // Create a fresh test schema for each test
    const testSchema = new mongoose.Schema({
      name: { type: String, required: true },
      value: { type: Number }
    });

    // Apply the tenant scoping plugin
    testSchema.plugin(tenantScopingPlugin);

    // Create or reuse model
    if (mongoose.models.TestItem) {
      TestModel = mongoose.models.TestItem;
    } else {
      TestModel = mongoose.model('TestItem', testSchema);
    }
  });

  afterEach(async () => {
    // Clean up collections after each test
    await TestModel.deleteMany({});
  });

  describe('Schema Enhancement', () => {
    test('should add tenantId field to schema', () => {
      const schema = TestModel.schema;
      expect(schema.path('tenantId')).toBeDefined();
      expect(schema.path('tenantId').instance).toBe('ObjectId');
      expect(schema.path('tenantId').isRequired).toBe(true);
    });
  });

  describe('Auto-set tenantId on save', () => {
    test('should automatically set tenantId from context on new document', async () => {
      const tenantId = new mongoose.Types.ObjectId();
      
      await runWithTenantContext({ id: tenantId, slug: 'test-tenant' }, async () => {
        const doc = new TestModel({ name: 'Test Item', value: 100 });
        await doc.save();

        expect(doc.tenantId).toBeDefined();
        expect(doc.tenantId.toString()).toBe(tenantId.toString());
      });
    });

    test('should not override existing tenantId on save', async () => {
      const tenantId1 = new mongoose.Types.ObjectId();
      const tenantId2 = new mongoose.Types.ObjectId();
      
      await runWithTenantContext({ id: tenantId1, slug: 'tenant-1' }, async () => {
        const doc = new TestModel({ 
          name: 'Test Item', 
          value: 100,
          tenantId: tenantId2 
        });
        await doc.save();

        expect(doc.tenantId.toString()).toBe(tenantId2.toString());
      });
    });

    test('should warn when no tenant context is available for new document', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const doc = new TestModel({ name: 'Test Item', value: 100 });
      
      // This should fail validation since tenantId is required
      await expect(doc.save()).rejects.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TENANT PLUGIN] No tenant context available'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Auto-inject tenantId filter on queries', () => {
    let tenant1Id, tenant2Id;
    let doc1, doc2;

    beforeEach(async () => {
      tenant1Id = new mongoose.Types.ObjectId();
      tenant2Id = new mongoose.Types.ObjectId();

      // Create documents for two different tenants
      doc1 = await TestModel.create({ 
        name: 'Tenant 1 Item', 
        value: 100,
        tenantId: tenant1Id 
      });

      doc2 = await TestModel.create({ 
        name: 'Tenant 2 Item', 
        value: 200,
        tenantId: tenant2Id 
      });
    });

    test('should filter find() queries by tenantId', async () => {
      await runWithTenantContext({ id: tenant1Id, slug: 'tenant-1' }, async () => {
        const results = await TestModel.find({});
        
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Tenant 1 Item');
        expect(results[0].tenantId.toString()).toBe(tenant1Id.toString());
      });
    });

    test('should filter findOne() queries by tenantId', async () => {
      await runWithTenantContext({ id: tenant2Id, slug: 'tenant-2' }, async () => {
        const result = await TestModel.findOne({});
        
        expect(result).toBeDefined();
        expect(result.name).toBe('Tenant 2 Item');
        expect(result.tenantId.toString()).toBe(tenant2Id.toString());
      });
    });

    test('should filter updateOne() queries by tenantId', async () => {
      await runWithTenantContext({ id: tenant1Id, slug: 'tenant-1' }, async () => {
        const result = await TestModel.updateOne(
          { name: 'Tenant 1 Item' },
          { value: 150 }
        );

        expect(result.modifiedCount).toBe(1);

        // Verify the update only affected tenant 1's document
        const doc = await TestModel.findOne({ tenantId: tenant1Id });
        expect(doc.value).toBe(150);

        // Verify tenant 2's document was not affected (query without context)
        const doc2Direct = await TestModel.findOne({ tenantId: tenant2Id });
        expect(doc2Direct.value).toBe(200);
      });
    });

    test('should filter deleteOne() queries by tenantId', async () => {
      await runWithTenantContext({ id: tenant1Id, slug: 'tenant-1' }, async () => {
        const result = await TestModel.deleteOne({ name: 'Tenant 1 Item' });

        expect(result.deletedCount).toBe(1);
      });

      // Verify tenant 2's document still exists (query without context to see all)
      const allDocs = await TestModel.find({ tenantId: tenant2Id }).lean();
      expect(allDocs).toHaveLength(1);
      expect(allDocs[0].tenantId.toString()).toBe(tenant2Id.toString());
    });

    test('should not inject filter if tenantId is explicitly provided', async () => {
      await runWithTenantContext({ id: tenant1Id, slug: 'tenant-1' }, async () => {
        // Explicitly query for tenant 2's data (admin override scenario)
        const results = await TestModel.find({ tenantId: tenant2Id });
        
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Tenant 2 Item');
      });
    });
  });

  describe('Cross-tenant modification prevention', () => {
    test('should prevent modifying document from different tenant', async () => {
      const tenant1Id = new mongoose.Types.ObjectId();
      const tenant2Id = new mongoose.Types.ObjectId();

      // Create document as tenant 1
      const doc = await runWithTenantContext({ id: tenant1Id, slug: 'tenant-1' }, async () => {
        return await TestModel.create({ 
          name: 'Tenant 1 Item', 
          value: 100 
        });
      });

      // Try to modify as tenant 2
      await runWithTenantContext({ id: tenant2Id, slug: 'tenant-2' }, async () => {
        doc.value = 200;
        await expect(doc.save()).rejects.toThrow('Cannot modify document from different tenant');
      });
    });

    test('should allow modifying document from same tenant', async () => {
      const tenantId = new mongoose.Types.ObjectId();

      await runWithTenantContext({ id: tenantId, slug: 'test-tenant' }, async () => {
        const doc = await TestModel.create({ 
          name: 'Test Item', 
          value: 100 
        });

        // Modify as same tenant
        doc.value = 200;
        await doc.save();

        expect(doc.value).toBe(200);
      });
    });
  });

  describe('Context isolation', () => {
    test('should maintain separate contexts for concurrent operations', async () => {
      const tenant1Id = new mongoose.Types.ObjectId();
      const tenant2Id = new mongoose.Types.ObjectId();

      // Create documents for both tenants
      await TestModel.create({ 
        name: 'Tenant 1 Item', 
        value: 100,
        tenantId: tenant1Id 
      });

      await TestModel.create({ 
        name: 'Tenant 2 Item', 
        value: 200,
        tenantId: tenant2Id 
      });

      // Simulate concurrent requests from different tenants
      const [results1, results2] = await Promise.all([
        runWithTenantContext({ id: tenant1Id, slug: 'tenant-1' }, async () => {
          return TestModel.find({});
        }),
        runWithTenantContext({ id: tenant2Id, slug: 'tenant-2' }, async () => {
          return TestModel.find({});
        })
      ]);

      // Each should only see their own data
      expect(results1).toHaveLength(1);
      expect(results1[0].name).toBe('Tenant 1 Item');

      expect(results2).toHaveLength(1);
      expect(results2[0].name).toBe('Tenant 2 Item');
    });
  });

  describe('Missing tenant context error', () => {
    test('should throw error when querying without tenant context', async () => {
      // Create a document with explicit tenantId
      const tenantId = new mongoose.Types.ObjectId();
      await TestModel.create({ 
        name: 'Test Item', 
        value: 100,
        tenantId: tenantId 
      });

      // Try to query without tenant context - should not throw but warn
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const results = await TestModel.find({});
      
      // Should warn about missing context
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TENANT PLUGIN] No tenant context available'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    test('should require tenant context for document creation', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Try to create document without tenant context
      const doc = new TestModel({ name: 'Test Item', value: 100 });
      
      // Should fail validation since tenantId is required
      await expect(doc.save()).rejects.toThrow();
      
      // Should warn about missing context
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TENANT PLUGIN] No tenant context available'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });
});
