const mongoose = require('mongoose');
require('dotenv').config();

// Import model Tenant
const Tenant = require('../models/Tenant');

/**
 * Script untuk seed data tenant ke database utama superkafe_v2
 * Usage: node backend/scripts/seedTenant.js
 */
const seedTenant = async () => {
  try {
    console.log('[SEED] Memulai proses seed tenant...');
    
    // Koneksi ke database utama
    const dbURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/superkafe_v2';
    console.log(`[SEED] Connecting to: ${dbURI}`);
    
    await mongoose.connect(dbURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('[SEED] Koneksi database berhasil');

    // Data tenant yang akan di-seed
    const tenantData = {
      name: 'Warkop Pusat',
      slug: 'warkop-pusat',
      dbName: 'superkafe_warkop_pusat',
      isActive: true
    };

    // Cek apakah tenant dengan slug yang sama sudah ada
    const existingTenant = await Tenant.findOne({ slug: tenantData.slug });

    if (existingTenant) {
      console.log(`[SEED] Tenant dengan slug '${tenantData.slug}' sudah ada`);
      console.log('[SEED] Data tenant yang ada:', {
        id: existingTenant._id,
        name: existingTenant.name,
        slug: existingTenant.slug,
        dbName: existingTenant.dbName,
        isActive: existingTenant.isActive
      });
      
      // Update jika ada perubahan
      const updated = await Tenant.findByIdAndUpdate(
        existingTenant._id,
        tenantData,
        { new: true }
      );
      
      console.log('[SEED] Tenant berhasil diupdate:', {
        id: updated._id,
        name: updated.name,
        slug: updated.slug,
        dbName: updated.dbName,
        isActive: updated.isActive
      });
    } else {
      // Buat tenant baru
      const newTenant = await Tenant.create(tenantData);
      
      console.log('[SEED] Tenant baru berhasil dibuat:', {
        id: newTenant._id,
        name: newTenant.name,
        slug: newTenant.slug,
        dbName: newTenant.dbName,
        isActive: newTenant.isActive
      });
    }

    console.log('\n[SEED] ✓ Proses seed tenant selesai!');
    console.log('\n[INFO] Cara testing dengan curl:');
    console.log(`curl -H "x-tenant-id: ${tenantData.slug}" http://localhost:5000/api/test/tenant-info`);
    console.log('\n[INFO] Atau dengan Postman:');
    console.log('- Method: GET');
    console.log('- URL: http://localhost:5000/api/test/tenant-info');
    console.log(`- Header: x-tenant-id = ${tenantData.slug}`);

  } catch (error) {
    console.error('[SEED ERROR] Gagal melakukan seed tenant:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  } finally {
    // Tutup koneksi database
    await mongoose.connection.close();
    console.log('\n[SEED] Koneksi database ditutup');
    process.exit(0);
  }
};

// Jalankan script
seedTenant();
