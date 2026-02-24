const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

async function checkTenantStatus() {
  try {
    // Connect to main database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin';
    await mongoose.connect(mongoUri);
    console.log('Connected to main database');

    // Find tenant by slug
    const tenantSlug = 'negoes';
    const tenant = await Tenant.findOne({ slug: tenantSlug });

    if (!tenant) {
      console.error(`❌ Tenant dengan slug "${tenantSlug}" tidak ditemukan!`);
      process.exit(1);
    }

    console.log('\n📊 Status Tenant:');
    console.log('================');
    console.log('Slug:', tenant.slug);
    console.log('Name:', tenant.name);
    console.log('DB Name:', tenant.dbName);
    console.log('Is Active:', tenant.isActive);
    console.log('Created At:', tenant.createdAt);
    console.log('Updated At:', tenant.updatedAt);

    if (!tenant.isActive) {
      console.log('\n⚠️  Tenant tidak aktif! Mengaktifkan tenant...');
      tenant.isActive = true;
      await tenant.save();
      console.log('✅ Tenant berhasil diaktifkan!');
    } else {
      console.log('\n✅ Tenant sudah aktif!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTenantStatus();
