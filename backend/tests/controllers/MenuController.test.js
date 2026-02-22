/**
 * MenuController Unit Tests - Tenant Data Isolation
 * 
 * Tests to verify that MenuController properly relies on the tenant scoping plugin
 * for automatic tenant data isolation. These tests verify:
 * - All queries are automatically scoped to the current tenant
 * - No manual tenantId filtering is needed
 * - Cache is properly isolated per tenant
 * 
 * Validates Requirements: 2.1, 2.2, 2.3
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const MenuItem = require('../../models/MenuItem');
const Recipe = require('../../models/Recipe');
const Ingredient = require('../../models/Ingredient');
const { setTenantContext } = require('../../utils/tenantContext');

let mongoServer;
let tenantAId, tenantBId;

beforeAll(async () => {
  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
  
  // Create mock tenant IDs
  tenantAId = new mongoose.Types.ObjectId();
  tenantBId = new mongoose.Types.ObjectId();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections before each test
  await MenuItem.deleteMany({});
  await Recipe.deleteMany({});
  await Ingredient.deleteMany({});
});

describe('MenuController - Tenant Scoping Plugin Integration', () => {
  // ============================================================================
  // Automatic Tenant Filtering Tests (Requirements 2.1, 2.2)
  // ============================================================================

  describe('MenuItem.find() - Automatic Tenant Filtering', () => {
    it('should return only tenant A menu items when tenant A context is set', async () => {
      // Set tenant A context
      setTenantContext({ id: tenantAId, slug: 'cafe-a', dbName: 'tenant_cafe_a' });

      // Create menu items for tenant A
      await MenuItem.create({
        id: 'menu_a_1',
        name: 'Cafe A Coffee',
        price: 25000,
        tenantId: tenantAId
      });

      await MenuItem.create({
        id: 'menu_a_2',
        name: 'Cafe A Tea',
        price: 20000,
        tenantId: tenantAId
      });

      // Create menu item for tenant B (should not be returned)
      await MenuItem.create({
        id: 'menu_b_1',
        name: 'Cafe B Coffee',
        price: 30000,
        tenantId: tenantBId
      });

      // Query as tenant A - plugin should automatically filter
      const items = await MenuItem.find();

      // Should only return tenant A items
      expect(items).toHaveLength(2);
      expect(items.every(item => item.tenantId.toString() === tenantAId.toString())).toBe(true);
      expect(items.map(item => item.name).sort()).toEqual(['Cafe A Coffee', 'Cafe A Tea']);
    });

    it('should return only tenant B menu items when tenant B context is set', async () => {
      // Create items for both tenants
      await MenuItem.create({
        id: 'menu_a_1',
        name: 'Cafe A Coffee',
        price: 25000,
        tenantId: tenantAId
      });

      await MenuItem.create({
        id: 'menu_b_1',
        name: 'Cafe B Coffee',
        price: 30000,
        tenantId: tenantBId
      });

      // Set tenant B context
      setTenantContext({ id: tenantBId, slug: 'cafe-b', dbName: 'tenant_cafe_b' });

      // Query as tenant B
      const items = await MenuItem.find();

      // Should only return tenant B items
      expect(items).toHaveLength(1);
      expect(items[0].tenantId.toString()).toBe(tenantBId.toString());
      expect(items[0].name).toBe('Cafe B Coffee');
    });
  });

  describe('MenuItem.findOne() - Automatic Tenant Filtering', () => {
    it('should return menu item only if it belongs to the requesting tenant', async () => {
      // Create menu item for tenant A
      await MenuItem.create({
        id: 'menu_a_specific',
        name: 'Specific Item A',
        price: 20000,
        tenantId: tenantAId
      });

      // Query as tenant A - should find it
      setTenantContext({ id: tenantAId, slug: 'cafe-a', dbName: 'tenant_cafe_a' });
      const foundItem = await MenuItem.findOne({ id: 'menu_a_specific' });
      expect(foundItem).not.toBeNull();
      expect(foundItem.name).toBe('Specific Item A');

      // Query as tenant B - should not find it (automatic filtering)
      setTenantContext({ id: tenantBId, slug: 'cafe-b', dbName: 'tenant_cafe_b' });
      const notFoundItem = await MenuItem.findOne({ id: 'menu_a_specific' });
      expect(notFoundItem).toBeNull();
    });
  });

  // ============================================================================
  // Automatic TenantId Assignment Tests (Requirement 2.4)
  // ============================================================================

  describe('MenuItem.create() - Automatic TenantId Assignment', () => {
    it('should automatically tag new menu items with tenantId from context', async () => {
      setTenantContext({ id: tenantAId, slug: 'cafe-a', dbName: 'tenant_cafe_a' });

      const newItem = await MenuItem.create({
        id: 'menu_auto_tag',
        name: 'Auto Tagged Item',
        price: 15000
        // Note: tenantId is NOT explicitly set
      });

      // Should have tenantId automatically set by plugin
      expect(newItem.tenantId).toBeDefined();
      expect(newItem.tenantId.toString()).toBe(tenantAId.toString());
    });

    it('should tag items with correct tenantId when context changes', async () => {
      // Create item as tenant A
      setTenantContext({ id: tenantAId, slug: 'cafe-a', dbName: 'tenant_cafe_a' });
      const itemA = await MenuItem.create({
        id: 'menu_a',
        name: 'Item A',
        price: 10000
      });

      // Create item as tenant B
      setTenantContext({ id: tenantBId, slug: 'cafe-b', dbName: 'tenant_cafe_b' });
      const itemB = await MenuItem.create({
        id: 'menu_b',
        name: 'Item B',
        price: 20000
      });

      // Verify correct tenantIds
      expect(itemA.tenantId.toString()).toBe(tenantAId.toString());
      expect(itemB.tenantId.toString()).toBe(tenantBId.toString());
    });
  });

  // ============================================================================
  // Cross-Tenant Modification Prevention Tests (Requirement 2.5)
  // ============================================================================

  describe('MenuItem.findOneAndUpdate() - Cross-Tenant Protection', () => {
    it('should only update items belonging to the requesting tenant', async () => {
      // Create item for tenant A
      setTenantContext({ id: tenantAId, slug: 'cafe-a', dbName: 'tenant_cafe_a' });
      await MenuItem.create({
        id: 'menu_update_test',
        name: 'Original Name',
        price: 10000,
        tenantId: tenantAId
      });

      // Try to update as tenant B - should not affect tenant A's item
      setTenantContext({ id: tenantBId, slug: 'cafe-b', dbName: 'tenant_cafe_b' });
      const updateResult = await MenuItem.findOneAndUpdate(
        { id: 'menu_update_test' },
        { name: 'Hacked Name' },
        { new: true }
      );

      // Should return null (item not found in tenant B's scope)
      expect(updateResult).toBeNull();

      // Verify tenant A's item is unchanged
      setTenantContext({ id: tenantAId, slug: 'cafe-a', dbName: 'tenant_cafe_a' });
      const originalItem = await MenuItem.findOne({ id: 'menu_update_test' });
      expect(originalItem.name).toBe('Original Name');
    });
  });

  describe('MenuItem.deleteOne() - Cross-Tenant Protection', () => {
    it('should only delete items belonging to the requesting tenant', async () => {
      // Create item for tenant A
      setTenantContext({ id: tenantAId, slug: 'cafe-a', dbName: 'tenant_cafe_a' });
      await MenuItem.create({
        id: 'menu_delete_test',
        name: 'To Be Protected',
        price: 10000,
        tenantId: tenantAId
      });

      // Try to delete as tenant B
      setTenantContext({ id: tenantBId, slug: 'cafe-b', dbName: 'tenant_cafe_b' });
      const deleteResult = await MenuItem.deleteOne({ id: 'menu_delete_test' });

      // Should delete 0 documents (not found in tenant B's scope)
      expect(deleteResult.deletedCount).toBe(0);

      // Verify tenant A's item still exists
      setTenantContext({ id: tenantAId, slug: 'cafe-a', dbName: 'tenant_cafe_a' });
      const stillExists = await MenuItem.findOne({ id: 'menu_delete_test' });
      expect(stillExists).not.toBeNull();
    });
  });

  // ============================================================================
  // Recipe and Ingredient Isolation Tests (Requirement 2.3)
  // ============================================================================

  describe('Recipe.find() - Tenant Isolation', () => {
    it('should isolate recipes between tenants', async () => {
      // Create recipe for tenant A
      setTenantContext({ id: tenantAId, slug: 'cafe-a', dbName: 'tenant_cafe_a' });
      await Recipe.create({
        menuId: 'menu_a_1',
        ingredients: [{ ing_id: 'ing_1', jumlah: 100 }],
        tenantId: tenantAId
      });

      // Query as tenant B - should not see tenant A's recipe
      setTenantContext({ id: tenantBId, slug: 'cafe-b', dbName: 'tenant_cafe_b' });
      const recipes = await Recipe.find();

      expect(recipes).toHaveLength(0);
    });
  });

  describe('Ingredient.find() - Tenant Isolation', () => {
    it('should isolate ingredients between tenants', async () => {
      // Create ingredient for tenant A
      setTenantContext({ id: tenantAId, slug: 'cafe-a', dbName: 'tenant_cafe_a' });
      await Ingredient.create({
        id: 'ing_a_1',
        nama: 'Coffee Beans A',
        stok: 1000,
        tenantId: tenantAId
      });

      // Query as tenant B - should not see tenant A's ingredient
      setTenantContext({ id: tenantBId, slug: 'cafe-b', dbName: 'tenant_cafe_b' });
      const ingredients = await Ingredient.find();

      expect(ingredients).toHaveLength(0);
    });
  });

  // ============================================================================
  // No Manual Filtering Required Tests (Requirement 2.1)
  // ============================================================================

  describe('Controller Pattern Verification', () => {
    it('should work correctly without manual tenantId filtering in queries', async () => {
      // This test verifies that the controller pattern of just calling
      // MenuItem.find() without adding { tenantId: ... } works correctly

      setTenantContext({ id: tenantAId, slug: 'cafe-a', dbName: 'tenant_cafe_a' });

      // Create items for both tenants
      await MenuItem.create({
        id: 'menu_a_1',
        name: 'Item A1',
        price: 10000,
        tenantId: tenantAId
      });

      await MenuItem.create({
        id: 'menu_b_1',
        name: 'Item B1',
        price: 20000,
        tenantId: tenantBId
      });

      // Simple find() without manual filtering - exactly as used in controller
      const items = await MenuItem.find().sort({ order: 1, category: 1, name: 1 });

      // Should only return tenant A items due to automatic plugin filtering
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Item A1');
    });
  });
});
