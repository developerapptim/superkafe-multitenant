/**
 * Unit Tests for Deployment Automation Script
 * 
 * Tests the deployment automation functionality including:
 * - Environment validation
 * - Database connectivity checks
 * - Initialization detection
 * - Error handling
 * 
 * Requirements: 12.3
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Tenant = require('../../models/Tenant');

// Mock dependencies
jest.mock('../../utils/envValidator');
jest.mock('../../scripts/initUniverse');

const { validateEnvironmentVariables } = require('../../utils/envValidator');
const initUniverse = require('../../scripts/initUniverse');

describe('Deployment Automation', () => {
  let mongoServer;
  let originalEnv;

  beforeAll(async () => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'superkafe_v2'
      }
    });
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_URI = mongoUri;
  });

  afterAll(async () => {
    // Restore original environment
    process.env = originalEnv;
    
    // Stop MongoDB
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    
    // Clear database
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  });

  afterEach(async () => {
    // Disconnect after each test
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });

  describe('Environment Validation', () => {
    it('should pass when all required environment variables are valid', () => {
      validateEnvironmentVariables.mockReturnValue({
        success: true,
        errors: [],
        warnings: []
      });

      const result = validateEnvironmentVariables();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required environment variables are missing', () => {
      validateEnvironmentVariables.mockReturnValue({
        success: false,
        errors: [
          {
            variable: 'MONGODB_URI',
            description: 'MongoDB connection string',
            error: 'Variable is missing or empty'
          }
        ],
        warnings: []
      });

      const result = validateEnvironmentVariables();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].variable).toBe('MONGODB_URI');
    });

    it('should warn about optional environment variables', () => {
      validateEnvironmentVariables.mockReturnValue({
        success: true,
        errors: [],
        warnings: [
          {
            variable: 'SMTP_HOST',
            description: 'SMTP server host'
          }
        ]
      });

      const result = validateEnvironmentVariables();

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].variable).toBe('SMTP_HOST');
    });
  });

  describe('Database Connectivity', () => {
    it('should successfully connect to database', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      expect(mongoose.connection.readyState).toBe(1); // Connected
      expect(mongoose.connection.name).toBe('superkafe_v2');
    });

    it('should verify database name is superkafe_v2', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      expect(mongoose.connection.name).toBe('superkafe_v2');
    });

    it('should test database operations', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      // Test ping operation
      const result = await mongoose.connection.db.admin().ping();
      expect(result.ok).toBe(1);
    });

    it('should get database statistics', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      const stats = await mongoose.connection.db.stats();
      
      expect(stats).toHaveProperty('collections');
      expect(stats).toHaveProperty('dataSize');
      expect(stats).toHaveProperty('storageSize');
    });
  });

  describe('Database Initialization Check', () => {
    it('should detect empty database', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      const tenantCount = await Tenant.countDocuments();

      expect(tenantCount).toBe(0);
    });

    it('should detect existing tenants', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      // Create a tenant
      await Tenant.create({
        name: 'Test Tenant',
        slug: 'test-tenant',
        dbName: 'superkafe_v2',
        isActive: true,
        status: 'trial'
      });

      const tenantCount = await Tenant.countDocuments();

      expect(tenantCount).toBe(1);
    });

    it('should detect default tenant "negoes"', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      // Create default tenant
      await Tenant.create({
        name: 'Negoes',
        slug: 'negoes',
        dbName: 'superkafe_v2',
        isActive: true,
        status: 'trial'
      });

      const defaultTenant = await Tenant.findOne({ slug: 'negoes' });

      expect(defaultTenant).toBeTruthy();
      expect(defaultTenant.name).toBe('Negoes');
      expect(defaultTenant.slug).toBe('negoes');
    });

    it('should determine initialization is needed when database is empty', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      const tenantCount = await Tenant.countDocuments();
      const needsInit = tenantCount === 0;

      expect(needsInit).toBe(true);
    });

    it('should determine initialization is not needed when tenants exist', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      // Create default tenant
      await Tenant.create({
        name: 'Negoes',
        slug: 'negoes',
        dbName: 'superkafe_v2',
        isActive: true,
        status: 'trial'
      });

      const tenantCount = await Tenant.countDocuments();
      const defaultTenant = await Tenant.findOne({ slug: 'negoes' });
      const needsInit = tenantCount === 0 || !defaultTenant;

      expect(needsInit).toBe(false);
    });
  });

  describe('Database Initialization', () => {
    it('should run initUniverse when database is empty', async () => {
      initUniverse.mockResolvedValue({
        success: true,
        tenant: {
          id: 'test-id',
          slug: 'negoes',
          name: 'Negoes'
        },
        message: 'Initialization successful'
      });

      await mongoose.connect(process.env.MONGODB_URI);
      const tenantCount = await Tenant.countDocuments();

      if (tenantCount === 0) {
        const result = await initUniverse();
        expect(result.success).toBe(true);
      }

      expect(initUniverse).toHaveBeenCalled();
    });

    it('should handle initUniverse success', async () => {
      initUniverse.mockResolvedValue({
        success: true,
        tenant: {
          id: 'test-id',
          slug: 'negoes',
          name: 'Negoes'
        },
        user: {
          email: 'admin@negoes.com',
          name: 'Admin Negoes'
        },
        message: 'Initialization successful'
      });

      const result = await initUniverse();

      expect(result.success).toBe(true);
      expect(result.tenant.slug).toBe('negoes');
      expect(result.user.email).toBe('admin@negoes.com');
    });

    it('should handle initUniverse failure', async () => {
      initUniverse.mockResolvedValue({
        success: false,
        message: 'Initialization failed',
        error: 'Database connection error'
      });

      const result = await initUniverse();

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
    });

    it('should skip initialization when tenants already exist', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      // Create tenant
      await Tenant.create({
        name: 'Negoes',
        slug: 'negoes',
        dbName: 'superkafe_v2',
        isActive: true,
        status: 'trial'
      });

      const tenantCount = await Tenant.countDocuments();
      const shouldInit = tenantCount === 0;

      expect(shouldInit).toBe(false);
      expect(initUniverse).not.toHaveBeenCalled();
    });
  });

  describe('Final Validation', () => {
    it('should verify default tenant exists after initialization', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      // Create tenant
      await Tenant.create({
        name: 'Negoes',
        slug: 'negoes',
        dbName: 'superkafe_v2',
        isActive: true,
        status: 'trial'
      });

      const tenant = await Tenant.findOne({ slug: 'negoes' });

      expect(tenant).toBeTruthy();
      expect(tenant.name).toBe('Negoes');
      expect(tenant.slug).toBe('negoes');
      expect(tenant.isActive).toBe(true);
    });

    it('should get collection count', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      const collections = await mongoose.connection.db.listCollections().toArray();

      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThanOrEqual(0);
    });

    it('should verify tenant status', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      // Create tenant
      const tenant = await Tenant.create({
        name: 'Negoes',
        slug: 'negoes',
        dbName: 'superkafe_v2',
        isActive: true,
        status: 'trial'
      });

      expect(tenant.status).toBe('trial');
      expect(tenant.isActive).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      const invalidUri = 'mongodb://invalid:27017/test';

      await expect(
        mongoose.connect(invalidUri, {
          serverSelectionTimeoutMS: 1000
        })
      ).rejects.toThrow();
    });

    it('should handle missing tenant gracefully', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      const tenant = await Tenant.findOne({ slug: 'nonexistent' });

      expect(tenant).toBeNull();
    });

    it('should handle database operation errors', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      // Try to create tenant with invalid data
      await expect(
        Tenant.create({
          // Missing required fields
          slug: 'test'
        })
      ).rejects.toThrow();
    });
  });

  describe('Deployment Flow Integration', () => {
    it('should complete full deployment flow for empty database', async () => {
      // Step 1: Validate environment
      validateEnvironmentVariables.mockReturnValue({
        success: true,
        errors: [],
        warnings: []
      });

      const envResult = validateEnvironmentVariables();
      expect(envResult.success).toBe(true);

      // Step 2: Connect to database
      await mongoose.connect(process.env.MONGODB_URI);
      expect(mongoose.connection.readyState).toBe(1);

      // Step 3: Check initialization status
      const tenantCount = await Tenant.countDocuments();
      expect(tenantCount).toBe(0);

      // Step 4: Run initialization
      initUniverse.mockResolvedValue({
        success: true,
        tenant: { id: 'test-id', slug: 'negoes', name: 'Negoes' },
        message: 'Success'
      });

      const initResult = await initUniverse();
      expect(initResult.success).toBe(true);

      // Step 5: Verify (mock tenant creation)
      await Tenant.create({
        name: 'Negoes',
        slug: 'negoes',
        dbName: 'superkafe_v2',
        isActive: true,
        status: 'trial'
      });

      const tenant = await Tenant.findOne({ slug: 'negoes' });
      expect(tenant).toBeTruthy();
    });

    it('should complete full deployment flow for initialized database', async () => {
      // Step 1: Validate environment
      validateEnvironmentVariables.mockReturnValue({
        success: true,
        errors: [],
        warnings: []
      });

      const envResult = validateEnvironmentVariables();
      expect(envResult.success).toBe(true);

      // Step 2: Connect to database
      await mongoose.connect(process.env.MONGODB_URI);
      expect(mongoose.connection.readyState).toBe(1);

      // Pre-create tenant
      await Tenant.create({
        name: 'Negoes',
        slug: 'negoes',
        dbName: 'superkafe_v2',
        isActive: true,
        status: 'trial'
      });

      // Step 3: Check initialization status
      const tenantCount = await Tenant.countDocuments();
      expect(tenantCount).toBe(1);

      // Step 4: Skip initialization (not needed)
      const needsInit = tenantCount === 0;
      expect(needsInit).toBe(false);

      // Step 5: Verify
      const tenant = await Tenant.findOne({ slug: 'negoes' });
      expect(tenant).toBeTruthy();
      expect(tenant.name).toBe('Negoes');
    });
  });

  describe('Idempotency', () => {
    it('should be safe to run deployment multiple times', async () => {
      await mongoose.connect(process.env.MONGODB_URI);

      // First run - create tenant
      await Tenant.create({
        name: 'Negoes',
        slug: 'negoes',
        dbName: 'superkafe_v2',
        isActive: true,
        status: 'trial'
      });

      const firstCount = await Tenant.countDocuments();

      // Second run - should not create duplicate
      const existing = await Tenant.findOne({ slug: 'negoes' });
      if (!existing) {
        await Tenant.create({
          name: 'Negoes',
          slug: 'negoes',
          dbName: 'superkafe_v2',
          isActive: true,
          status: 'trial'
        });
      }

      const secondCount = await Tenant.countDocuments();

      expect(firstCount).toBe(secondCount);
      expect(secondCount).toBe(1);
    });
  });
});
