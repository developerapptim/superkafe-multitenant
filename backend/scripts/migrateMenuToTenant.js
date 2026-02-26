const mongoose = require('mongoose');
require('dotenv').config();

const { getTenantDB } = require('../config/db');
const Tenant = require('../models/Tenant');

/**
 * Script untuk migrasi data menu dari database lama ke tenant baru
 * Usage: node backend/scripts/migrateMenuToTenant.js <tenant-slug> [source-db-name]
 */

const migrateMenuToTenant = async () => {
  try {
    const targetSlug = process.argv[2];
    const sourceDbName = process.argv[3] || 'superkafe_v2';

    if (!targetSlug) {
      console.error('[MIGRATE] Error: Slug tenant wajib disertakan');
      console.log('Usage: node backend/scripts/migrateMenuToTenant.js <tenant-slug> [source-db-name]');
      process.exit(1);
    }

    console.log('[MIGRATE] Memulai proses migrasi menu...');
    console.log(`[MIGRATE] Target Tenant: ${targetSlug}`);
    console.log(`[MIGRATE] Source Database: ${sourceDbName}`);

    // Koneksi ke database utama
    const mainDbURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/superkafe_v2';
    await mongoose.connect(mainDbURI);
    console.log('[MIGRATE] ✓ Koneksi database berhasil');

    // Cari tenant
    const tenant = await Tenant.findOne({ slug: targetSlug.toLowerCase() });
    if (!tenant) {
      console.error(`[MIGRATE] Error: Tenant '${targetSlug}' tidak ditemukan`);
      process.exit(1);
    }

    console.log('[MIGRATE] ✓ Tenant ditemukan:', tenant.name);

    // Koneksi ke database sumber dan tujuan
    const sourceConnection = mongoose.connection.useDb(sourceDbName);
    const tenantDB = await getTenantDB(tenant.dbName);

    // Load models
    const SourceCategory = sourceConnection.model('Category', require('../models/Category').schema);
    const SourceMenuItem = sourceConnection.model('MenuItem', require('../models/MenuItem').schema);
    const TargetCategory = tenantDB.model('Category', require('../models/Category').schema);
    const TargetMenuItem = tenantDB.model('MenuItem', require('../models/MenuItem').schema);

    // Migrasi Kategori
    console.log('\n[MIGRATE] Migrasi kategori...');
    const sourceCategories = await SourceCategory.find({}).lean();
    console.log(`[MIGRATE] Ditemukan ${sourceCategories.length} kategori`);

    let categoriesMigrated = 0;
    for (const category of sourceCategories) {
      const exists = await TargetCategory.findOne({ id: category.id });
      if (!exists) {
        await TargetCategory.create({
          ...category,
          _id: undefined,
          tenantId: tenant._id
        });
        categoriesMigrated++;
      }
    }
    console.log(`[MIGRATE] ✓ ${categoriesMigrated} kategori dimigrasikan`);

    // Migrasi Menu
    console.log('\n[MIGRATE] Migrasi menu...');
    const sourceMenuItems = await SourceMenuItem.find({}).lean();
    console.log(`[MIGRATE] Ditemukan ${sourceMenuItems.length} menu`);

    let menuMigrated = 0;
    for (const menuItem of sourceMenuItems) {
      const exists = await TargetMenuItem.findOne({ id: menuItem.id });
      if (!exists) {
        await TargetMenuItem.create({
          ...menuItem,
          _id: undefined,
          tenantId: tenant._id
        });
        menuMigrated++;
      }
    }
    console.log(`[MIGRATE] ✓ ${menuMigrated} menu dimigrasikan`);

    console.log('\n[MIGRATE] ✓ Migrasi selesai!');
    console.log(`Total: ${categoriesMigrated} kategori, ${menuMigrated} menu`);

  } catch (error) {
    console.error('[MIGRATE ERROR]', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

migrateMenuToTenant();
