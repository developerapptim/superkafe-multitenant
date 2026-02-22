/**
 * Script to DELETE tenants that are using reserved keywords as slugs
 * 
 * WARNING: This script will permanently delete tenants and all associated data!
 * Use with caution and only after backing up the database.
 * 
 * Usage:
 *   node backend/scripts/deleteReservedSlugTenants.js
 *   
 * Or to delete a specific slug:
 *   node backend/scripts/deleteReservedSlugTenants.js setup-cafe
 */

const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config();

// Import models
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Employee = require('../models/Employee');

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

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function deleteReservedSlugTenants(specificSlug = null) {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27018/superkafe', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    // Determine which slugs to check
    const slugsToCheck = specificSlug ? [specificSlug] : RESERVED_KEYWORDS;

    // Find conflicting tenants
    const conflictingTenants = await Tenant.find({
      slug: { $in: slugsToCheck }
    });

    if (conflictingTenants.length === 0) {
      console.log('✅ No tenants found with reserved keyword slugs');
      console.log('   Nothing to delete!\n');
      return;
    }

    // Display conflicting tenants
    console.log(`⚠️  Found ${conflictingTenants.length} tenant(s) with reserved keyword slugs:\n`);
    
    conflictingTenants.forEach((tenant, index) => {
      console.log(`${index + 1}. Tenant: ${tenant.cafeName}`);
      console.log(`   Slug: ${tenant.slug} ❌`);
      console.log(`   ID: ${tenant._id}`);
      console.log(`   Created: ${tenant.createdAt}`);
      console.log('');
    });

    // Ask for confirmation
    console.log('⚠️  WARNING: This will permanently delete these tenants and all associated data!');
    console.log('   - Tenant records');
    console.log('   - User associations (tenantSlug will be cleared)');
    console.log('   - Employee records');
    console.log('   - All tenant-specific data\n');

    const answer = await askQuestion('Are you sure you want to proceed? (yes/no): ');

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Operation cancelled by user');
      return;
    }

    // Delete tenants and associated data
    console.log('\n🗑️  Deleting tenants...\n');

    for (const tenant of conflictingTenants) {
      console.log(`Deleting tenant: ${tenant.cafeName} (${tenant.slug})...`);

      // 1. Clear tenantSlug from users
      const usersUpdated = await User.updateMany(
        { tenantSlug: tenant.slug },
        { $unset: { tenantSlug: '' } }
      );
      console.log(`   ✅ Cleared tenantSlug from ${usersUpdated.modifiedCount} user(s)`);

      // 2. Delete employees
      const employeesDeleted = await Employee.deleteMany({ tenantSlug: tenant.slug });
      console.log(`   ✅ Deleted ${employeesDeleted.deletedCount} employee(s)`);

      // 3. Delete tenant
      await Tenant.deleteOne({ _id: tenant._id });
      console.log(`   ✅ Deleted tenant record`);

      console.log('');
    }

    console.log('✅ All conflicting tenants have been deleted successfully!\n');

    // Verify deletion
    const remainingConflicts = await Tenant.find({
      slug: { $in: slugsToCheck }
    });

    if (remainingConflicts.length === 0) {
      console.log('✅ Verification: No more tenants with reserved keyword slugs');
    } else {
      console.log(`⚠️  Warning: ${remainingConflicts.length} tenant(s) still found with reserved slugs`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    rl.close();
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Get specific slug from command line argument
const specificSlug = process.argv[2];

if (specificSlug) {
  console.log(`🎯 Targeting specific slug: ${specificSlug}\n`);
}

// Run the deletion
deleteReservedSlugTenants(specificSlug);
