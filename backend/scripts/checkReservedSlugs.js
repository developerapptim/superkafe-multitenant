/**
 * Script to check if any tenants are using reserved keywords as slugs
 * This helps identify data integrity issues that could cause routing conflicts
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Tenant = require('../models/Tenant');

// Reserved keywords from slugValidator
const RESERVED_KEYWORDS = [
  'setup-cafe',
  'admin',
  'dashboard',
  'auth',
  'api',
  'login',
  'register',
  'logout'
];

async function checkReservedSlugs() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27018/superkafe', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Check for tenants with reserved slugs
    console.log('🔍 Checking for tenants with reserved keyword slugs...\n');
    
    const conflictingTenants = await Tenant.find({
      slug: { $in: RESERVED_KEYWORDS }
    });

    if (conflictingTenants.length === 0) {
      console.log('✅ No tenants found with reserved keyword slugs');
      console.log('   Database is clean!\n');
    } else {
      console.log(`⚠️  Found ${conflictingTenants.length} tenant(s) with reserved keyword slugs:\n`);
      
      conflictingTenants.forEach((tenant, index) => {
        console.log(`${index + 1}. Tenant: ${tenant.cafeName}`);
        console.log(`   Slug: ${tenant.slug} ❌`);
        console.log(`   ID: ${tenant._id}`);
        console.log(`   Created: ${tenant.createdAt}`);
        console.log('');
      });

      console.log('⚠️  RECOMMENDATION:');
      console.log('   These tenants should be renamed to avoid routing conflicts.');
      console.log('   Use the following command to delete a conflicting tenant:');
      console.log('   node backend/scripts/cleanupFailedTenant.js <tenant_id>\n');
    }

    // List all tenant slugs for reference
    const allTenants = await Tenant.find({}, 'slug cafeName createdAt').sort({ createdAt: -1 });
    console.log(`📋 All tenants in database (${allTenants.length} total):\n`);
    
    allTenants.forEach((tenant, index) => {
      const isReserved = RESERVED_KEYWORDS.includes(tenant.slug);
      const status = isReserved ? '❌ RESERVED' : '✅';
      console.log(`${index + 1}. ${status} ${tenant.slug} - ${tenant.cafeName}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the check
checkReservedSlugs();
