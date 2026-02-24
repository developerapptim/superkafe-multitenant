const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

async function listTenants() {
  try {
    // Connect to main database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin';
    await mongoose.connect(mongoUri);
    console.log('Connected to main database');

    // Find all tenants
    const tenants = await Tenant.find();

    if (tenants.length === 0) {
      console.log('\n❌ Tidak ada tenant yang ditemukan!');
      process.exit(1);
    }

    console.log(`\n📊 Daftar Tenant (${tenants.length} tenant):`);
    console.log('=====================================');
    
    tenants.forEach((tenant, index) => {
      console.log(`\n${index + 1}. ${tenant.name}`);
      console.log('   Slug:', tenant.slug);
      console.log('   DB Name:', tenant.dbName);
      console.log('   Is Active:', tenant.isActive);
      console.log('   Owner Email:', tenant.ownerEmail);
      console.log('   Created:', tenant.createdAt);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listTenants();
