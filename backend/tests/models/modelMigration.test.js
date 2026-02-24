const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');

/**
 * Unit Test: Model Migration Validation
 * 
 * Validates Requirement 4.5: THE System SHALL validate that all existing models 
 * have been migrated to use Tenant_Scoping_Plugin
 * 
 * This test verifies:
 * 1. All tenant-scoped models have the tenantScopingPlugin applied
 * 2. All tenant-scoped models have a tenantId index
 * 3. Global models (User, Tenant) do NOT have tenant scoping
 * 
 * Based on MODEL_TENANT_SCOPING_AUDIT.md findings
 */
describe('Model Migration Validation', () => {
  let mongoServer;

  // List of models requiring tenant scoping (from audit)
  const TENANT_SCOPED_MODELS = [
    'MenuItem',
    'Employee',
    'Order',
    'Category',
    'Table',
    'CashTransaction',
    'Customer',
    'Reservation',
    'Expense',
    'Ingredient',
    'Recipe',
    'Shift',
    'StockHistory',
    'Attendance',
    'Debt',
    'Feedback',
    'Gramasi',
    'OperationalExpense',
    'ServiceRequest',
    'Setting',
    'Settings',
    'Voucher',
    'ActivityLog',
    'AuditLog',
    'Banner'
  ];

  // List of global models that should NOT have tenant scoping
  const GLOBAL_MODELS = ['User', 'Tenant'];

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  /**
   * Helper function to load a model by name
   * Handles both singular and plural file naming conventions
   */
  function loadModel(modelName) {
    // Return cached model if already loaded
    if (mongoose.models[modelName]) {
      return mongoose.models[modelName];
    }

    // Try singular filename first
    const singularPath = path.join(__dirname, '../../models', `${modelName}.js`);
    if (fs.existsSync(singularPath)) {
      require(singularPath);
      return mongoose.models[modelName];
    }

    // Try plural filename
    const pluralPath = path.join(__dirname, '../../models', `${modelName}s.js`);
    if (fs.existsSync(pluralPath)) {
      require(pluralPath);
      return mongoose.models[modelName];
    }

    return null;
  }

  /**
   * Helper function to check if a model has the tenant scoping plugin applied
   * The plugin adds pre-hooks for 'find' and 'validate' operations
   */
  function hasTenantScopingPlugin(model) {
    const hooks = model.schema.s.hooks;
    
    // Check for pre-hooks that the plugin adds
    const hasPreFind = hooks._pres.has('find');
    const hasPreValidate = hooks._pres.has('validate');
    
    return hasPreFind && hasPreValidate;
  }

  /**
   * Helper function to check if a model has a tenantId index
   * Checks both basic and compound indexes
   */
  function hasTenantIdIndex(model) {
    const indexes = model.schema.indexes();
    return indexes.some(index => {
      const indexFields = index[0];
      return indexFields.hasOwnProperty('tenantId');
    });
  }

  describe('Tenant-Scoped Models', () => {
    it('should verify all tenant-scoped models have tenantScopingPlugin applied', () => {
      const missingPlugin = [];

      TENANT_SCOPED_MODELS.forEach(modelName => {
        const model = loadModel(modelName);
        
        if (!model) {
          throw new Error(`Model ${modelName} could not be loaded from backend/models/`);
        }

        if (!hasTenantScopingPlugin(model)) {
          missingPlugin.push(modelName);
        }
      });

      expect(missingPlugin).toEqual([]);
      
      if (missingPlugin.length > 0) {
        throw new Error(
          `The following models are missing tenantScopingPlugin: ${missingPlugin.join(', ')}\n` +
          `Add the plugin to each model:\n` +
          `const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');\n` +
          `ModelSchema.plugin(tenantScopingPlugin);`
        );
      }
    });

    it('should verify all tenant-scoped models have tenantId index', () => {
      const missingIndex = [];

      TENANT_SCOPED_MODELS.forEach(modelName => {
        const model = loadModel(modelName);
        
        if (!model) {
          throw new Error(`Model ${modelName} could not be loaded from backend/models/`);
        }

        if (!hasTenantIdIndex(model)) {
          missingIndex.push(modelName);
        }
      });

      expect(missingIndex).toEqual([]);
      
      if (missingIndex.length > 0) {
        throw new Error(
          `The following models are missing tenantId index: ${missingIndex.join(', ')}\n` +
          `The tenantScopingPlugin should automatically add this index.`
        );
      }
    });

    it('should verify all tenant-scoped models have required tenantId field', () => {
      const missingTenantId = [];
      const notRequired = [];

      TENANT_SCOPED_MODELS.forEach(modelName => {
        const model = loadModel(modelName);
        
        if (!model) {
          throw new Error(`Model ${modelName} could not be loaded from backend/models/`);
        }

        const tenantIdPath = model.schema.path('tenantId');
        
        if (!tenantIdPath) {
          missingTenantId.push(modelName);
        } else if (!tenantIdPath.isRequired) {
          notRequired.push(modelName);
        }
      });

      expect(missingTenantId).toEqual([]);
      expect(notRequired).toEqual([]);
      
      if (missingTenantId.length > 0) {
        throw new Error(
          `The following models are missing tenantId field: ${missingTenantId.join(', ')}\n` +
          `The tenantScopingPlugin should automatically add this field.`
        );
      }
      
      if (notRequired.length > 0) {
        throw new Error(
          `The following models have tenantId field but it's not required: ${notRequired.join(', ')}\n` +
          `The tenantScopingPlugin should make this field required.`
        );
      }
    });
  });

  describe('Global Models', () => {
    it('should verify global models do NOT have tenantScopingPlugin applied', () => {
      const incorrectlyScoped = [];

      GLOBAL_MODELS.forEach(modelName => {
        const model = loadModel(modelName);
        
        if (!model) {
          throw new Error(`Model ${modelName} could not be loaded from backend/models/`);
        }

        if (hasTenantScopingPlugin(model)) {
          incorrectlyScoped.push(modelName);
        }
      });

      expect(incorrectlyScoped).toEqual([]);
      
      if (incorrectlyScoped.length > 0) {
        throw new Error(
          `The following global models incorrectly have tenantScopingPlugin: ${incorrectlyScoped.join(', ')}\n` +
          `These models should NOT have tenant scoping:\n` +
          `- User: Pre-tenant registration users (global identity)\n` +
          `- Tenant: Tenant registry itself (must be globally accessible)`
        );
      }
    });

    it('should verify User model has tenantId field for reference but is not scoped', () => {
      const User = loadModel('User');
      
      if (!User) {
        throw new Error('User model could not be loaded from backend/models/');
      }

      // User should have tenantId field for reference
      const tenantIdPath = User.schema.path('tenantId');
      expect(tenantIdPath).toBeDefined();

      // But should NOT have the plugin applied
      expect(hasTenantScopingPlugin(User)).toBe(false);
    });

    it('should verify Tenant model does not have tenantId field', () => {
      const Tenant = loadModel('Tenant');
      
      if (!Tenant) {
        throw new Error('Tenant model could not be loaded from backend/models/');
      }

      // Tenant should NOT have tenantId field (it IS the tenant)
      const tenantIdPath = Tenant.schema.path('tenantId');
      expect(tenantIdPath).toBeUndefined();

      // And should NOT have the plugin applied
      expect(hasTenantScopingPlugin(Tenant)).toBe(false);
    });
  });

  describe('Migration Completeness', () => {
    it('should verify the total count of models matches audit expectations', () => {
      const totalTenantScoped = TENANT_SCOPED_MODELS.length;
      const totalGlobal = GLOBAL_MODELS.length;
      const totalModels = totalTenantScoped + totalGlobal;

      // Based on MODEL_TENANT_SCOPING_AUDIT.md:
      // - 25 tenant-scoped models (24 original + 3 fixed in task 5.2, but 2 duplicates)
      // - 2 global models
      // Total: 27 models
      expect(totalTenantScoped).toBe(25);
      expect(totalGlobal).toBe(2);
      expect(totalModels).toBe(27);
    });

    it('should verify all models in the audit are accounted for', () => {
      const allModels = [...TENANT_SCOPED_MODELS, ...GLOBAL_MODELS];
      const loadedModels = [];
      const failedToLoad = [];

      allModels.forEach(modelName => {
        const model = loadModel(modelName);
        if (model) {
          loadedModels.push(modelName);
        } else {
          failedToLoad.push(modelName);
        }
      });

      expect(failedToLoad).toEqual([]);
      expect(loadedModels.length).toBe(27);
      
      if (failedToLoad.length > 0) {
        throw new Error(
          `The following models from the audit could not be loaded: ${failedToLoad.join(', ')}\n` +
          `Check that these model files exist in backend/models/`
        );
      }
    });
  });

  describe('Index Configuration', () => {
    it('should verify models with compound indexes have proper configuration', () => {
      // Models that should have compound indexes (from COMPOUND_INDEXES_SUMMARY.md)
      const modelsWithTimeIndex = [
        'ActivityLog',
        'AuditLog',
        'Banner',
        'CashTransaction',
        'Category',
        'Customer',
        'Expense',
        'Feedback',
        'Ingredient',
        'OperationalExpense',
        'Recipe',
        'Setting',
        'Settings',
        'StockHistory',
        'Voucher',
        'Order',
        'Shift',
        'Table',
        'Reservation',
        'Employee',
        'Debt',
        'Attendance',
        'ServiceRequest'
      ];

      const missingCompoundIndex = [];

      modelsWithTimeIndex.forEach(modelName => {
        const model = loadModel(modelName);
        
        if (!model) return;

        const indexes = model.schema.indexes();
        
        // Check if there's at least one compound index with tenantId
        const hasCompoundIndex = indexes.some(index => {
          const indexFields = index[0];
          const fieldNames = Object.keys(indexFields);
          
          // Compound index has more than one field and includes tenantId
          return fieldNames.length > 1 && indexFields.hasOwnProperty('tenantId');
        });

        if (!hasCompoundIndex) {
          missingCompoundIndex.push(modelName);
        }
      });

      expect(missingCompoundIndex).toEqual([]);
      
      if (missingCompoundIndex.length > 0) {
        throw new Error(
          `The following models are missing compound indexes with tenantId: ${missingCompoundIndex.join(', ')}\n` +
          `Add compound indexes like:\n` +
          `ModelSchema.index({ tenantId: 1, createdAt: -1 });\n` +
          `ModelSchema.index({ tenantId: 1, status: 1 });`
        );
      }
    });
  });
});
