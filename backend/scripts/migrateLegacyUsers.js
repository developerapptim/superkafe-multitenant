/**
 * Migration Script: Legacy Users to Multitenant
 * 
 * Script ini akan:
 * 1. Mencari semua Employee yang tidak memiliki tenantId atau role
 * 2. Membuat tenant default untuk mereka
 * 3. Assign role 'admin' secara default
 * 
 * Usage: node scripts/migrateLegacyUsers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Tenant = require('../models/Tenant');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/warkop';

// Helper: Generate slug dari nama
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 50); // Limit length
}

// Helper: Ensure unique slug
async function ensureUniqueSlug(baseSlug) {
  let slug = baseSlug;
  let counter = 1;
  
  while (await Tenant.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

async function migrateLegacyUsers() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all employees without tenantId or role
    const legacyUsers = await Employee.find({
      $or: [
        { tenantId: { $exists: false } },
        { tenantId: null },
        { role: { $exists: false } },
        { role: null },
        { role: '' }
      ]
    });

    console.log(`\n📊 Found ${legacyUsers.length} legacy users to migrate\n`);

    if (legacyUsers.length === 0) {
      console.log('✅ No legacy users found. All users are up to date!');
      process.exit(0);
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const user of legacyUsers) {
      try {
        console.log(`\n👤 Processing: ${user.name} (${user.email || user.username})`);

        // Generate slug from user name
        const baseSlug = generateSlug(user.name || user.username || 'tenant');
        const uniqueSlug = await ensureUniqueSlug(baseSlug);
        const dbName = `warkop_${uniqueSlug}`;

        // Check if tenant already exists for this user
        let tenant = await Tenant.findOne({ 
          $or: [
            { slug: uniqueSlug },
            { dbName: dbName }
          ]
        });

        if (!tenant) {
          // Create new tenant
          tenant = new Tenant({
            name: user.name || user.username || 'Default Tenant',
            slug: uniqueSlug,
            dbName: dbName,
            status: 'trial',
            isActive: true
          });

          await tenant.save();
          console.log(`  ✅ Created tenant: ${tenant.name} (slug: ${tenant.slug})`);
        } else {
          console.log(`  ℹ️  Using existing tenant: ${tenant.name} (slug: ${tenant.slug})`);
        }

        // Update user with tenantId and role
        const updates = {};
        
        if (!user.tenantId) {
          updates.tenantId = tenant._id;
        }
        
        if (!user.role || user.role === '') {
          updates.role = 'admin';
        }

        if (Object.keys(updates).length > 0) {
          await Employee.updateOne({ _id: user._id }, { $set: updates });
          console.log(`  ✅ Updated user: tenantId=${!!updates.tenantId}, role=${updates.role || user.role}`);
          migratedCount++;
        } else {
          console.log(`  ℹ️  User already has required fields`);
        }

      } catch (error) {
        console.error(`  ❌ Error processing ${user.name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`  ✅ Successfully migrated: ${migratedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📝 Total processed: ${legacyUsers.length}`);
    console.log('='.repeat(60) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateLegacyUsers();
