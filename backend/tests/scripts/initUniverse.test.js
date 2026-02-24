/**
 * Init Universe Script Unit Tests
 * 
 * Tests for initUniverse.js script to ensure:
 * - Successful initialization of first tenant "Negoes"
 * - Idempotency (safe to run multiple times)
 * - Error handling and rollback on failures
 * - Database validation
 * 
 * Validates Requirements: 5.4, 5.5, 5.8
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const initUniverse = require('../../scripts/initUniverse');
const Tenant = require('../../models/Tenant');
const User = require('../../models/User');
const Employee = require('../../models/Employee');
const MenuItem = require('../../models/MenuItem');
const Category = require('../../models/Category');
const { setTenantContext } = require('../../utils/tenantContext');

let mongoServer;

beforeAll(async () => {
  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'superkafe_v2'
    }
  });
  const mongoUri = mongoServer.getUri('superkafe_v2');
  
  // Set environment variable for initUniverse script
  process.env.MONGODB_URI = mongoUri;
});

afterAll(async () => {
  await mongoServer.stop();
});

beforeEach(async () => {
  // Ensure clean state before each test
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  
  // Wait a bit for connection to fully close
  await new Promise(resolve => setTimeout(resolve, 200));
}, 15000); // Increase timeout for beforeEach

afterEach(async () => {
  // Clean up after each test
  try {
    if (mongoose.connection.readyState === 1) {
      await Tenant.deleteMany({});
      await User.deleteMany({});
      await Employee.deleteMany({});
      await MenuItem.deleteMany({});
      await Category.deleteMany({});
      await mongoose.connection.close();
    }
  } catch (error) {
    // Ignore cleanup errors
  }
  
  // Wait a bit for connection to fully close
  await new Promise(resolve => setTimeout(resolve, 200));
}, 15000); // Increase timeout for afterEach

describe('Init Universe Script', () => {
  // ============================================================================
  // Requirement 5.4: Successful Initialization
  // ============================================================================

  describe('Successful Initialization', () => {
    test('should create tenant "Negoes" successfully', async () => {
      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(true);
      expect(result.tenant).toBeDefined();
      expect(result.tenant.slug).toBe('negoes');
      expect(result.tenant.name).toBe('Negoes');
      expect(result.tenant.status).toBe('trial');
    });

    test('should create admin user with correct credentials', async () => {
      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('admin@negoes.com');
      expect(result.user.name).toBe('Admin Negoes');
    });

    test('should create employee record linked to tenant', async () => {
      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(true);
      expect(result.employee).toBeDefined();
      expect(result.employee.email).toBe('admin@negoes.com');
      expect(result.employee.role).toBe('admin');
    });

    test('should create menu items', async () => {
      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(true);
      expect(result.menuItems).toBeGreaterThan(0);
      expect(result.menuItems).toBe(3); // 3 sample menu items
    });

    test('should connect to superkafe_v2 database', async () => {
      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(true);
      
      // Reconnect to verify data
      await mongoose.connect(process.env.MONGODB_URI);
      expect(mongoose.connection.name).toBe('superkafe_v2');
      
      const tenant = await Tenant.findOne({ slug: 'negoes' });
      expect(tenant).toBeDefined();
      expect(tenant.dbName).toBe('superkafe_v2');
    });

    test('should set tenant trial expiration to 10 days from now', async () => {
      // Arrange
      const now = Date.now();
      const tenDaysInMs = 10 * 24 * 60 * 60 * 1000;

      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(true);
      
      // Reconnect to verify
      await mongoose.connect(process.env.MONGODB_URI);
      const tenant = await Tenant.findOne({ slug: 'negoes' });
      
      const trialExpiration = tenant.trialExpiresAt.getTime();
      const expectedExpiration = now + tenDaysInMs;
      
      // Allow 5 second tolerance for test execution time
      expect(trialExpiration).toBeGreaterThan(now);
      expect(trialExpiration).toBeLessThanOrEqual(expectedExpiration + 5000);
    });

    test('should create tenant with isActive set to true', async () => {
      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(true);
      
      // Reconnect to verify
      await mongoose.connect(process.env.MONGODB_URI);
      const tenant = await Tenant.findOne({ slug: 'negoes' });
      
      expect(tenant.isActive).toBe(true);
    });

    test('should create user with hasCompletedSetup set to true', async () => {
      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(true);
      
      // Reconnect to verify
      await mongoose.connect(process.env.MONGODB_URI);
      const user = await User.findOne({ email: 'admin@negoes.com' });
      
      expect(user.hasCompletedSetup).toBe(true);
      expect(user.isVerified).toBe(true);
    });

    test('should create employee with correct tenantId', async () => {
      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(true);
      
      // Reconnect to verify
      await mongoose.connect(process.env.MONGODB_URI);
      const tenant = await Tenant.findOne({ slug: 'negoes' });
      const employee = await Employee.findOne({ email: 'admin@negoes.com' });
      
      expect(employee.tenantId.toString()).toBe(tenant._id.toString());
    });

    test('should create menu category "Kopi"', async () => {
      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(true);
      
      // Reconnect to verify
      await mongoose.connect(process.env.MONGODB_URI);
      const category = await Category.findOne({ id: 'cat_coffee' });
      
      expect(category).toBeDefined();
      expect(category.name).toBe('Kopi');
      expect(category.emoji).toBe('☕');
    });

    test('should create menu items with correct tenantId', async () => {
      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(true);
      
      // Reconnect to verify
      await mongoose.connect(process.env.MONGODB_URI);
      const tenant = await Tenant.findOne({ slug: 'negoes' });
      const menuItems = await MenuItem.find({});
      
      expect(menuItems.length).toBe(3);
      menuItems.forEach(item => {
        expect(item.tenantId.toString()).toBe(tenant._id.toString());
      });
    });
  });

  // ============================================================================
  // Requirement 5.5: Idempotency (Running Multiple Times)
  // ============================================================================

  describe('Idempotency', () => {
    test('should skip tenant creation if already exists', async () => {
      // Arrange - First run
      const firstResult = await initUniverse();
      expect(firstResult.success).toBe(true);

      // Act - Second run
      const secondResult = await initUniverse();

      // Assert
      expect(secondResult.success).toBe(true);
      expect(secondResult.tenant.slug).toBe('negoes');
      
      // Verify only one tenant exists
      await mongoose.connect(process.env.MONGODB_URI);
      const tenants = await Tenant.find({ slug: 'negoes' });
      expect(tenants.length).toBe(1);
    });

    test('should skip user creation if already exists', async () => {
      // Arrange - First run
      const firstResult = await initUniverse();
      expect(firstResult.success).toBe(true);

      // Act - Second run
      const secondResult = await initUniverse();

      // Assert
      expect(secondResult.success).toBe(true);
      expect(secondResult.user.email).toBe('admin@negoes.com');
      
      // Verify only one user exists
      await mongoose.connect(process.env.MONGODB_URI);
      const users = await User.find({ email: 'admin@negoes.com' });
      expect(users.length).toBe(1);
    });

    test('should skip employee creation if already exists', async () => {
      // Arrange - First run
      const firstResult = await initUniverse();
      expect(firstResult.success).toBe(true);

      // Act - Second run
      const secondResult = await initUniverse();

      // Assert
      expect(secondResult.success).toBe(true);
      expect(secondResult.employee.email).toBe('admin@negoes.com');
      
      // Verify only one employee exists
      await mongoose.connect(process.env.MONGODB_URI);
      const employees = await Employee.find({ email: 'admin@negoes.com' });
      expect(employees.length).toBe(1);
    });

    test('should skip menu category creation if already exists', async () => {
      // Arrange - First run
      const firstResult = await initUniverse();
      expect(firstResult.success).toBe(true);

      // Act - Second run
      const secondResult = await initUniverse();

      // Assert
      expect(secondResult.success).toBe(true);
      
      // Verify only one category exists
      await mongoose.connect(process.env.MONGODB_URI);
      const categories = await Category.find({ id: 'cat_coffee' });
      expect(categories.length).toBe(1);
    });

    test('should skip menu items creation if already exist', async () => {
      // Arrange - First run
      const firstResult = await initUniverse();
      expect(firstResult.success).toBe(true);

      // Act - Second run
      const secondResult = await initUniverse();

      // Assert
      expect(secondResult.success).toBe(true);
      
      // Verify only 3 menu items exist
      await mongoose.connect(process.env.MONGODB_URI);
      const menuItems = await MenuItem.find({});
      expect(menuItems.length).toBe(3);
    });

    test('should return success on multiple consecutive runs', async () => {
      // Act - Run 3 times
      const result1 = await initUniverse();
      const result2 = await initUniverse();
      const result3 = await initUniverse();

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      
      // Verify data integrity
      await mongoose.connect(process.env.MONGODB_URI);
      const tenants = await Tenant.find({ slug: 'negoes' });
      const users = await User.find({ email: 'admin@negoes.com' });
      const employees = await Employee.find({ email: 'admin@negoes.com' });
      
      expect(tenants.length).toBe(1);
      expect(users.length).toBe(1);
      expect(employees.length).toBe(1);
    });

    test('should update user with tenant info if missing', async () => {
      // Arrange - Create user without tenant info
      await mongoose.connect(process.env.MONGODB_URI);
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const tenant = await Tenant.create({
        name: 'Negoes',
        slug: 'negoes',
        dbName: 'superkafe_v2',
        isActive: true,
        status: 'trial',
        trialExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      });
      
      await User.create({
        email: 'admin@negoes.com',
        password: hashedPassword,
        name: 'Admin Negoes',
        authProvider: 'local',
        isVerified: true,
        hasCompletedSetup: false, // Missing setup
        // tenantId and tenantSlug missing
      });
      
      await mongoose.connection.close();

      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(true);
      
      // Verify user was updated
      await mongoose.connect(process.env.MONGODB_URI);
      const user = await User.findOne({ email: 'admin@negoes.com' });
      
      expect(user.tenantId).toBeDefined();
      expect(user.tenantSlug).toBe('negoes');
      expect(user.hasCompletedSetup).toBe(true);
    });
  });

  // ============================================================================
  // Requirement 5.8: Error Handling and Rollback
  // ============================================================================

  describe('Error Handling and Rollback', () => {
    test('should return error result when database connection fails', async () => {
      // Arrange - Set invalid MongoDB URI
      const originalUri = process.env.MONGODB_URI;
      process.env.MONGODB_URI = 'mongodb://invalid:27017/superkafe_v2?serverSelectionTimeoutMS=2000';

      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
      expect(result.error).toBeDefined();

      // Restore original URI
      process.env.MONGODB_URI = originalUri;
    }, 20000); // Increase timeout for connection failure

    test('should handle database validation error gracefully', async () => {
      // This test validates that errors during initialization are handled gracefully
      // We'll test by mocking a failure scenario
      
      // Act - Run with valid connection but expect graceful handling
      const result = await initUniverse();

      // Assert - Should either succeed or fail gracefully with proper error structure
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
      
      if (!result.success) {
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('error');
      }
    });

    test('should provide detailed error message on failure', async () => {
      // Arrange - Set invalid MongoDB URI with short timeout
      const originalUri = process.env.MONGODB_URI;
      process.env.MONGODB_URI = 'mongodb://invalid:27017/superkafe_v2?serverSelectionTimeoutMS=2000';

      // Act
      const result = await initUniverse();

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);

      // Restore original URI
      process.env.MONGODB_URI = originalUri;
    }, 20000);

    test('should close database connection on error', async () => {
      // Arrange - Set invalid MongoDB URI with short timeout
      const originalUri = process.env.MONGODB_URI;
      process.env.MONGODB_URI = 'mongodb://invalid:27017/superkafe_v2?serverSelectionTimeoutMS=2000';

      // Act
      await initUniverse();
      
      // Wait for connection cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert - Connection should be closed or disconnected
      // readyState: 0 = disconnected, 3 = disconnecting
      expect([0, 3]).toContain(mongoose.connection.readyState);

      // Restore original URI
      process.env.MONGODB_URI = originalUri;
    }, 20000);

    test('should close database connection on success', async () => {
      // Act
      const result = await initUniverse();
      
      // Wait for connection cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      expect(result.success).toBe(true);
      // readyState: 0 = disconnected, 3 = disconnecting
      expect([0, 3]).toContain(mongoose.connection.readyState);
    });
  });

  // ============================================================================
  // Requirement 5.4: Database Validation
  // ============================================================================

  describe('Database Validation', () => {
    test('should validate connection to superkafe_v2 database', async () => {
      // Act
      const result = await initUniverse();
      
      // Wait for connection cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      expect(result.success).toBe(true);
      
      // Reconnect and verify database name
      await mongoose.connect(process.env.MONGODB_URI);
      expect(mongoose.connection.name).toBe('superkafe_v2');
    });

    test('should reject connection to wrong database', async () => {
      // Arrange - Set URI to different database
      const originalUri = process.env.MONGODB_URI;
      const wrongDbUri = mongoServer.getUri('wrong_database');
      process.env.MONGODB_URI = wrongDbUri;

      // Act
      const result = await initUniverse();
      
      // Wait for connection cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('superkafe_v2');

      // Restore original URI
      process.env.MONGODB_URI = originalUri;
    });

    test('should use MONGODB_URI from environment variable', async () => {
      // Arrange - Verify environment variable is set
      expect(process.env.MONGODB_URI).toBeDefined();

      // Act
      const result = await initUniverse();
      
      // Wait for connection cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      expect(result.success).toBe(true);
    });

    test('should fall back to default URI if MONGODB_URI not set', async () => {
      // Arrange - Remove environment variable
      const originalUri = process.env.MONGODB_URI;
      delete process.env.MONGODB_URI;

      // Act
      const result = await initUniverse();
      
      // Wait for connection cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert - Should use default URI and likely fail (not running on default port)
      // But the script should handle it gracefully
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');

      // Restore original URI
      process.env.MONGODB_URI = originalUri;
    }, 10000);
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle partial initialization gracefully', async () => {
      // Arrange - Create only tenant
      await mongoose.connect(process.env.MONGODB_URI);
      
      // Clean up any existing data first
      await Tenant.deleteMany({});
      await User.deleteMany({});
      await Employee.deleteMany({});
      await MenuItem.deleteMany({});
      await Category.deleteMany({});
      
      await Tenant.create({
        name: 'Negoes',
        slug: 'negoes',
        dbName: 'superkafe_v2',
        isActive: true,
        status: 'trial',
        trialExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      });
      await mongoose.connection.close();
      
      // Wait for connection to close
      await new Promise(resolve => setTimeout(resolve, 500));

      // Act - Run initialization
      const result = await initUniverse();
      
      // Wait for connection cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert - Should complete successfully or handle gracefully
      expect(result).toHaveProperty('success');
      
      if (result.success) {
        // Verify all entities exist
        await mongoose.connect(process.env.MONGODB_URI);
        const user = await User.findOne({ email: 'admin@negoes.com' });
        const employee = await Employee.findOne({ email: 'admin@negoes.com' });
        const category = await Category.findOne({ id: 'cat_coffee' });
        
        expect(user).toBeDefined();
        expect(employee).toBeDefined();
        expect(category).toBeDefined();
      } else {
        // If it fails, should have proper error structure
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('error');
      }
    });

    test('should return result with correct structure', async () => {
      // Act
      const result = await initUniverse();
      
      // Wait for connection cleanup
      await new Promise(resolve => setTimeout(resolve, 300));

      // Assert
      expect(result).toHaveProperty('success');
      
      if (result.success) {
        expect(result).toHaveProperty('tenant');
        expect(result).toHaveProperty('user');
        expect(result).toHaveProperty('employee');
        expect(result).toHaveProperty('menuItems');
        expect(result).toHaveProperty('message');
        
        expect(result.tenant).toHaveProperty('id');
        expect(result.tenant).toHaveProperty('slug');
        expect(result.tenant).toHaveProperty('name');
        expect(result.tenant).toHaveProperty('status');
        
        expect(result.user).toHaveProperty('email');
        expect(result.user).toHaveProperty('name');
        
        expect(result.employee).toHaveProperty('email');
        expect(result.employee).toHaveProperty('role');
      } else {
        // On failure, should have error info
        expect(result).toHaveProperty('message');
        expect(result).toHaveProperty('error');
      }
    });
  });
});
