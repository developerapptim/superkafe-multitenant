const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const Tenant = require('../models/Tenant');
const { checkApiKey } = require('../middleware/auth');

// Helper: Generate slug dari nama
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
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

/**
 * POST /api/migration/legacy-users
 * Migrate legacy users yang tidak memiliki tenantId atau role
 * 
 * SECURITY: Requires API key
 */
router.post('/legacy-users', checkApiKey, async (req, res) => {
  try {
    console.log('🔄 Starting legacy user migration...');

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

    console.log(`📊 Found ${legacyUsers.length} legacy users to migrate`);

    if (legacyUsers.length === 0) {
      return res.json({
        success: true,
        message: 'No legacy users found. All users are up to date!',
        migrated: 0,
        errors: 0
      });
    }

    let migratedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const user of legacyUsers) {
      try {
        console.log(`👤 Processing: ${user.name} (${user.email || user.username})`);

        // Generate slug from user name
        const baseSlug = generateSlug(user.name || user.username || 'tenant');
        const uniqueSlug = await ensureUniqueSlug(baseSlug);
        const dbName = `warkop_${uniqueSlug}`;

        // Check if tenant already exists
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
          
          results.push({
            userId: user._id,
            name: user.name,
            email: user.email || user.username,
            tenantSlug: tenant.slug,
            role: updates.role || user.role,
            status: 'success'
          });
        }

      } catch (error) {
        console.error(`  ❌ Error processing ${user.name}:`, error.message);
        errorCount++;
        
        results.push({
          userId: user._id,
          name: user.name,
          email: user.email || user.username,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log('✅ Migration completed');

    res.json({
      success: true,
      message: 'Legacy user migration completed',
      migrated: migratedCount,
      errors: errorCount,
      total: legacyUsers.length,
      results: results
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      message: error.message
    });
  }
});

/**
 * GET /api/migration/check-legacy-users
 * Check berapa banyak legacy users yang perlu di-migrate
 */
router.get('/check-legacy-users', checkApiKey, async (req, res) => {
  try {
    const legacyUsers = await Employee.find({
      $or: [
        { tenantId: { $exists: false } },
        { tenantId: null },
        { role: { $exists: false } },
        { role: null },
        { role: '' }
      ]
    }).select('name email username role tenantId');

    res.json({
      success: true,
      count: legacyUsers.length,
      users: legacyUsers.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email || u.username,
        hasRole: !!u.role,
        hasTenantId: !!u.tenantId
      }))
    });

  } catch (error) {
    console.error('Error checking legacy users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check legacy users',
      message: error.message
    });
  }
});

module.exports = router;
