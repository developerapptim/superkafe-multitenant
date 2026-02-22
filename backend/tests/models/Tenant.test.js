/**
 * Tenant Model Unit Tests
 * 
 * Tests for Tenant model schema validation and indexes to ensure:
 * - Case-insensitive slug uniqueness is enforced
 * - Duplicate slugs with different casing are rejected
 * 
 * Validates Requirements: 1.6
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Tenant = require('../../models/Tenant');

let mongoServer;

beforeAll(async () => {
  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clean up database after each test
  await Tenant.deleteMany({});
});

describe('Tenant Model - Slug Case-Insensitive Uniqueness', () => {
  // ============================================================================
  // Case-Insensitive Uniqueness Tests (Requirement 1.6)
  // ============================================================================

  test('should create tenant with lowercase slug successfully', async () => {
    const tenant = new Tenant({
      name: 'Cafe Kopi',
      slug: 'cafe-kopi',
      dbName: 'tenant_cafe_kopi'
    });

    const savedTenant = await tenant.save();
    
    expect(savedTenant.slug).toBe('cafe-kopi');
    expect(savedTenant.name).toBe('Cafe Kopi');
  });

  test('should reject duplicate slug with same casing', async () => {
    // Create first tenant
    const tenant1 = new Tenant({
      name: 'Cafe Kopi',
      slug: 'cafe-kopi',
      dbName: 'tenant_cafe_kopi'
    });
    await tenant1.save();

    // Try to create second tenant with same slug
    const tenant2 = new Tenant({
      name: 'Another Cafe',
      slug: 'cafe-kopi',
      dbName: 'tenant_another_cafe'
    });

    await expect(tenant2.save()).rejects.toThrow();
  });

  test('should reject duplicate slug with different casing (Cafe-Kopi vs cafe-kopi)', async () => {
    // Create first tenant with lowercase slug
    const tenant1 = new Tenant({
      name: 'Cafe Kopi',
      slug: 'cafe-kopi',
      dbName: 'tenant_cafe_kopi'
    });
    await tenant1.save();

    // Try to create second tenant with mixed case slug
    // Note: The schema has lowercase: true, so it will be converted to lowercase
    // But the collation index should still catch this at the database level
    const tenant2 = new Tenant({
      name: 'Another Cafe',
      slug: 'Cafe-Kopi',
      dbName: 'tenant_another_cafe'
    });

    await expect(tenant2.save()).rejects.toThrow();
  });

  test('should reject duplicate slug with uppercase letters (CAFE-KOPI vs cafe-kopi)', async () => {
    // Create first tenant
    const tenant1 = new Tenant({
      name: 'Cafe Kopi',
      slug: 'cafe-kopi',
      dbName: 'tenant_cafe_kopi'
    });
    await tenant1.save();

    // Try to create second tenant with uppercase slug
    const tenant2 = new Tenant({
      name: 'Another Cafe',
      slug: 'CAFE-KOPI',
      dbName: 'tenant_another_cafe'
    });

    await expect(tenant2.save()).rejects.toThrow();
  });

  test('should reject duplicate slug with mixed casing (CaFe-KoPi vs cafe-kopi)', async () => {
    // Create first tenant
    const tenant1 = new Tenant({
      name: 'Cafe Kopi',
      slug: 'cafe-kopi',
      dbName: 'tenant_cafe_kopi'
    });
    await tenant1.save();

    // Try to create second tenant with random mixed case
    const tenant2 = new Tenant({
      name: 'Another Cafe',
      slug: 'CaFe-KoPi',
      dbName: 'tenant_another_cafe'
    });

    await expect(tenant2.save()).rejects.toThrow();
  });

  test('should allow different slugs regardless of casing', async () => {
    // Create first tenant
    const tenant1 = new Tenant({
      name: 'Cafe Kopi',
      slug: 'cafe-kopi',
      dbName: 'tenant_cafe_kopi'
    });
    await tenant1.save();

    // Create second tenant with completely different slug
    const tenant2 = new Tenant({
      name: 'Warung Makan',
      slug: 'warung-makan',
      dbName: 'tenant_warung_makan'
    });
    const savedTenant2 = await tenant2.save();

    expect(savedTenant2.slug).toBe('warung-makan');
  });

  test('should convert slug to lowercase before saving', async () => {
    const tenant = new Tenant({
      name: 'Cafe Mocha',
      slug: 'Cafe-Mocha',
      dbName: 'tenant_cafe_mocha'
    });

    const savedTenant = await tenant.save();
    
    // Schema has lowercase: true, so it should be converted
    expect(savedTenant.slug).toBe('cafe-mocha');
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  test('should handle slug with numbers and hyphens', async () => {
    const tenant = new Tenant({
      name: 'Cafe 123',
      slug: 'cafe-123',
      dbName: 'tenant_cafe_123'
    });

    const savedTenant = await tenant.save();
    expect(savedTenant.slug).toBe('cafe-123');
  });

  test('should reject slug with invalid characters', async () => {
    const tenant = new Tenant({
      name: 'Cafe Test',
      slug: 'cafe@test',
      dbName: 'tenant_cafe_test'
    });

    await expect(tenant.save()).rejects.toThrow();
  });

  test('should trim whitespace from slug', async () => {
    const tenant = new Tenant({
      name: 'Cafe Test',
      slug: '  cafe-test  ',
      dbName: 'tenant_cafe_test'
    });

    const savedTenant = await tenant.save();
    expect(savedTenant.slug).toBe('cafe-test');
  });
});
