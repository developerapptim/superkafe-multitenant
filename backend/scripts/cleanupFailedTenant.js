const mongoose = require('mongoose');
require('dotenv').config();

const Tenant = require('../models/Tenant');

/**
 * Script untuk membersihkan tenant yang gagal inisialisasi
 * Usage: node backend/scripts/cleanupFailedTenant.js <slug>
 * Contoh: node backend/scripts/cleanupFailedTenant.js warkop-jakarta
 */
const cleanupFailedTenant = async () => {
  try {
    // Ambil slug dari command line argument
    const slug = process.argv[2];

    if (!slug) {
      console.error('[CLEANUP] Error: Slug tenant wajib disertakan');
      console.log('Usage: node backend/scripts/cleanupFailedTenant.js <slug>');
      console.log('Contoh: node backend/scripts/cleanupFailedTenant.js warkop-jakarta');
      process.exit(1);
    }

    console.log('[CLEANUP] Memulai proses cleanup tenant...');
    
    // Koneksi ke database utama
    const dbURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/superkafe_v2';
    console.log(`[CLEANUP] Connecting to: ${dbURI}`);
    
    await mongoose.connect(dbURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('[CLEANUP] Koneksi database berhasil');

    // Cari tenant berdasarkan slug
    const tenant = await Tenant.findOne({ slug: slug.toLowerCase() });

    if (!tenant) {
      console.log(`[CLEANUP] Tenant dengan slug '${slug}' tidak ditemukan`);
      process.exit(0);
    }

    console.log('[CLEANUP] Tenant ditemukan:', {
      id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      dbName: tenant.dbName,
      isActive: tenant.isActive
    });

    // Konfirmasi penghapusan
    console.log('\n[CLEANUP] Menghapus tenant dari database utama...');
    
    await Tenant.findByIdAndDelete(tenant._id);

    console.log('[CLEANUP] ✓ Tenant berhasil dihapus dari database utama');
    console.log('\n[INFO] Catatan:');
    console.log(`- Database tenant '${tenant.dbName}' masih ada di MongoDB`);
    console.log('- Jika ingin menghapus database tenant juga, gunakan MongoDB shell:');
    console.log(`  use ${tenant.dbName}`);
    console.log('  db.dropDatabase()');

  } catch (error) {
    console.error('[CLEANUP ERROR] Gagal melakukan cleanup:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n[CLEANUP] Koneksi database ditutup');
    process.exit(0);
  }
};

// Jalankan script
cleanupFailedTenant();
