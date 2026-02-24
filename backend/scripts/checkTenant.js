require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

async function checkTenant() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get tenant slug from command line argument
    const tenantSlug = process.argv[2];
    
    if (!tenantSlug) {
      console.log('Usage: node checkTenant.js <tenant-slug>');
      console.log('Example: node checkTenant.js sulkopi');
      process.exit(1);
    }

    // Check if tenant exists
    const tenant = await Tenant.findOne({ slug: tenantSlug });

    if (tenant) {
      console.log('\n✅ Tenant found:');
      console.log('ID:', tenant._id);
      console.log('Slug:', tenant.slug);
      console.log('Name:', tenant.name);
      console.log('Business Name:', tenant.businessName);
      console.log('Is Active:', tenant.isActive);
      console.log('Status:', tenant.status);
      console.log('Created:', tenant.createdAt);
    } else {
      console.log(`\n❌ Tenant "${tenantSlug}" not found in database`);
      console.log('\nTo create this tenant, run:');
      console.log(`node backend/scripts/seedTenant.js ${tenantSlug}`);
    }

    // List all tenants
    const allTenants = await Tenant.find().select('slug name isActive status');
    console.log('\n📋 All tenants in database:');
    allTenants.forEach(t => {
      console.log(`  - ${t.slug} (${t.name}) - Active: ${t.isActive}, Status: ${t.status}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTenant();
