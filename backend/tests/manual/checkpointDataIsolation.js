/**
 * Manual Test Script: Backend Data Isolation Validation
 * 
 * This script validates that tenant data isolation is working correctly
 * by creating two tenants, adding data to each, and verifying no cross-tenant leakage.
 * 
 * Run with: node tests/manual/checkpointDataIsolation.js
 */

const mongoose = require('mongoose');
const { setTenantContext } = require('../../utils/tenantContext');

// Connect to main database
async function connectToMainDB() {
  const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/superkafe_main';
  await mongoose.connect(mongoURI);
  console.log('✓ Connected to main database');
}

// Create test tenant
async function createTestTenant(slug, name) {
  const Tenant = require('../../models/Tenant');
  
  // Clean up existing test tenant
  await Tenant.deleteOne({ slug });
  
  const tenant = await Tenant.create({
    name,
    slug,
    dbName: `superkafe_${slug}`,
    isActive: true,
    subscription: {
      plan: 'trial',
      status: 'active',
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    }
  });
  
  console.log(`✓ Created tenant: ${slug} (${tenant._id})`);
  return tenant;
}

// Connect to tenant database
async function connectToTenantDB(tenant) {
  const tenantDB = mongoose.connection.useDb(tenant.dbName);
  console.log(`✓ Connected to tenant database: ${tenant.dbName}`);
  return tenantDB;
}

// Add test data to tenant
async function addTestData(tenantDB, tenant, dataPrefix) {
  // Set tenant context for the plugin
  setTenantContext({
    id: tenant._id,
    slug: tenant.slug,
    dbName: tenant.dbName
  });
  
  const MenuItem = tenantDB.model('MenuItem', require('../../models/MenuItem').schema);
  
  const items = await MenuItem.create([
    {
      name: `${dataPrefix} Item 1`,
      category: 'Makanan',
      price: 10000,
      tenantId: tenant._id
    },
    {
      name: `${dataPrefix} Item 2`,
      category: 'Minuman',
      price: 5000,
      tenantId: tenant._id
    }
  ]);
  
  console.log(`✓ Added ${items.length} menu items to ${tenant.slug}`);
  return items;
}

// Query data from tenant
async function queryTenantData(tenantDB, tenant) {
  // Set tenant context for the plugin
  setTenantContext({
    id: tenant._id,
    slug: tenant.slug,
    dbName: tenant.dbName
  });
  
  const MenuItem = tenantDB.model('MenuItem', require('../../models/MenuItem').schema);
  
  const items = await MenuItem.find({});
  console.log(`✓ Found ${items.length} items in ${tenant.slug}`);
  return items;
}

// Main test function
async function runTest() {
  console.log('\n=== Backend Data Isolation Validation ===\n');
  
  try {
    // Step 1: Connect to main database
    await connectToMainDB();
    
    // Step 2: Create two test tenants
    console.log('\n--- Creating Test Tenants ---');
    const tenantA = await createTestTenant('test-cafe-a', 'Test Cafe A');
    const tenantB = await createTestTenant('test-cafe-b', 'Test Cafe B');
    
    // Step 3: Connect to tenant databases
    console.log('\n--- Connecting to Tenant Databases ---');
    const tenantADB = await connectToTenantDB(tenantA);
    const tenantBDB = await connectToTenantDB(tenantB);
    
    // Step 4: Add data to Tenant A
    console.log('\n--- Adding Data to Tenant A ---');
    const tenantAItems = await addTestData(tenantADB, tenantA, 'Cafe A');
    
    // Step 5: Add data to Tenant B
    console.log('\n--- Adding Data to Tenant B ---');
    const tenantBItems = await addTestData(tenantBDB, tenantB, 'Cafe B');
    
    // Step 6: Query data from Tenant A
    console.log('\n--- Querying Data from Tenant A ---');
    const queriedAItems = await queryTenantData(tenantADB, tenantA);
    
    // Step 7: Query data from Tenant B
    console.log('\n--- Querying Data from Tenant B ---');
    const queriedBItems = await queryTenantData(tenantBDB, tenantB);
    
    // Step 8: Validate isolation
    console.log('\n--- Validating Data Isolation ---');
    
    // Check that Tenant A only sees its own data
    const tenantAHasOnlyOwnData = queriedAItems.every(item => 
      item.name.startsWith('Cafe A') && 
      item.tenantId.toString() === tenantA._id.toString()
    );
    
    // Check that Tenant B only sees its own data
    const tenantBHasOnlyOwnData = queriedBItems.every(item => 
      item.name.startsWith('Cafe B') && 
      item.tenantId.toString() === tenantB._id.toString()
    );
    
    // Check counts
    const tenantACountCorrect = queriedAItems.length === 2;
    const tenantBCountCorrect = queriedBItems.length === 2;
    
    // Report results
    console.log('\nValidation Results:');
    console.log(`  Tenant A has only own data: ${tenantAHasOnlyOwnData ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Tenant B has only own data: ${tenantBHasOnlyOwnData ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Tenant A count correct (2): ${tenantACountCorrect ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Tenant B count correct (2): ${tenantBCountCorrect ? '✓ PASS' : '✗ FAIL'}`);
    
    const allTestsPassed = tenantAHasOnlyOwnData && tenantBHasOnlyOwnData && 
                           tenantACountCorrect && tenantBCountCorrect;
    
    if (allTestsPassed) {
      console.log('\n✓✓✓ ALL TESTS PASSED - Data isolation is working correctly! ✓✓✓\n');
    } else {
      console.log('\n✗✗✗ SOME TESTS FAILED - Data leakage detected! ✗✗✗\n');
      process.exit(1);
    }
    
    // Cleanup
    console.log('--- Cleaning Up ---');
    await tenantADB.dropDatabase();
    await tenantBDB.dropDatabase();
    const Tenant = require('../../models/Tenant');
    await Tenant.deleteMany({ slug: { $in: ['test-cafe-a', 'test-cafe-b'] } });
    console.log('✓ Cleanup complete');
    
  } catch (error) {
    console.error('\n✗ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
  }
}

// Run the test
runTest();
