const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');

describe('Property 8: Model Configuration Consistency', () => {
  let mongoServer;
  const GLOBAL_MODELS = ['User', 'Tenant'];
  const TENANT_SCOPED_MODELS = ['MenuItem', 'Employee', 'Order', 'Category', 'Table', 'CashTransaction', 'Customer', 'Reservation', 'Expense', 'Ingredient', 'Recipe', 'Shift', 'StockHistory', 'Attendance', 'Debt', 'Feedback', 'Gramasi', 'OperationalExpense', 'ServiceRequest', 'Setting', 'Settings', 'Voucher', 'ActivityLog', 'AuditLog', 'Banner'];

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  function loadModel(modelName) {
    if (mongoose.models[modelName]) return mongoose.models[modelName];
    const filepath = path.join(__dirname, '../../models', `${modelName}.js`);
    const filepathPlural = path.join(__dirname, '../../models', `${modelName}s.js`);
    if (fs.existsSync(filepath)) {
      require(filepath);
      return mongoose.models[modelName];
    } else if (fs.existsSync(filepathPlural)) {
      require(filepathPlural);
      return mongoose.models[modelName];
    }
    return null;
  }

  function hasTenantScopingPlugin(model) {
    const hooks = model.schema.s.hooks;
    return hooks._pres.has('find') && hooks._pres.has('validate');
  }

  function hasTenantIdIndex(model) {
    return model.schema.indexes().some(index => index[0].hasOwnProperty('tenantId'));
  }

  it('should verify global models do NOT have tenant scoping', () => {
    GLOBAL_MODELS.forEach(modelName => {
      const model = loadModel(modelName);
      if (model) expect(hasTenantScopingPlugin(model)).toBe(false);
    });
  });

  it('should verify all tenant-scoped models have correct configuration', () => {
    TENANT_SCOPED_MODELS.forEach(modelName => {
      const model = loadModel(modelName);
      if (!model) throw new Error(`Model ${modelName} could not be loaded`);
      const tenantIdPath = model.schema.path('tenantId');
      expect(tenantIdPath).toBeDefined();
      expect(tenantIdPath.isRequired).toBe(true);
      expect(hasTenantIdIndex(model)).toBe(true);
      expect(hasTenantScopingPlugin(model)).toBe(true);
    });
  });

  it('should verify configuration consistency across random model selections', async () => {
    await fc.assert(fc.asyncProperty(fc.constantFrom(...TENANT_SCOPED_MODELS), async (modelName) => {
      const model = loadModel(modelName);
      if (!model) return true;
      const tenantIdPath = model.schema.path('tenantId');
      expect(tenantIdPath).toBeDefined();
      expect(tenantIdPath.isRequired).toBe(true);
      expect(hasTenantIdIndex(model)).toBe(true);
      expect(hasTenantScopingPlugin(model)).toBe(true);
      return true;
    }), { numRuns: 100 });
  });
});
