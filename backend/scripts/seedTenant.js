const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import model Tenant
const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/db');

/**
 * Script untuk seed data tenant ke database utama dan membuat user admin default
 * Usage: node backend/scripts/seedTenant.js <slug> [name]
 * Contoh: node backend/scripts/seedTenant.js zona-mapan "Zona Mapan Coffee"
 */
const seedTenant = async () => {
  try {
    // Ambil slug dari command line argument
    const slug = process.argv[2];
    const name = process.argv[3] || slug.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    if (!slug) {
      console.error('[SEED] Error: Slug tenant wajib disertakan');
      console.log('Usage: node backend/scripts/seedTenant.js <slug> [name]');
      console.log('Contoh: node backend/scripts/seedTenant.js zona-mapan "Zona Mapan Coffee"');
      process.exit(1);
    }

    console.log('[SEED] Memulai proses seed tenant...');
    console.log(`[SEED] Slug: ${slug}`);
    console.log(`[SEED] Name: ${name}`);
    
    // Koneksi ke database utama
    const dbURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/superkafe_v2';
    console.log(`[SEED] Connecting to: ${dbURI}`);
    
    await mongoose.connect(dbURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('[SEED] Koneksi database berhasil');

    // Susun dbName otomatis
    const dbName = `superkafe_${slug.toLowerCase().replace(/-/g, '_')}`;

    // Data tenant yang akan di-seed
    const tenantData = {
      name: name,
      slug: slug.toLowerCase(),
      dbName: dbName,
      isActive: true
    };

    // Cek apakah tenant dengan slug yang sama sudah ada
    let tenant = await Tenant.findOne({ slug: tenantData.slug });

    if (tenant) {
      console.log(`[SEED] Tenant dengan slug '${tenantData.slug}' sudah ada`);
      console.log('[SEED] Data tenant yang ada:', {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        dbName: tenant.dbName,
        isActive: tenant.isActive
      });
      
      // Update jika ada perubahan
      tenant = await Tenant.findByIdAndUpdate(
        tenant._id,
        tenantData,
        { new: true }
      );
      
      console.log('[SEED] Tenant berhasil diupdate');
    } else {
      // Buat tenant baru
      tenant = await Tenant.create(tenantData);
      
      console.log('[SEED] Tenant baru berhasil dibuat:', {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        dbName: tenant.dbName,
        isActive: tenant.isActive
      });
    }

    // ===== SEEDING USER ADMIN =====
    console.log('\n[SEED] Memulai seeding user admin...');
    
    try {
      // Koneksi ke database tenant
      const tenantDB = await getTenantDB(dbName);
      
      // Load Employee model untuk tenant database
      const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);
      
      // Cek apakah admin sudah ada
      const existingAdmin = await EmployeeModel.findOne({ username: 'admin' });
      
      if (existingAdmin) {
        console.log('[SEED] User admin sudah ada di database tenant');
        console.log('[SEED] Admin info:', {
          id: existingAdmin.id,
          username: existingAdmin.username,
          name: existingAdmin.name,
          role: existingAdmin.role
        });
      } else {
        // Hash password default
        const defaultPassword = 'admin123'; // Password default
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        // Generate unique ID untuk employee
        const employeeId = `EMP-${Date.now()}`;
        
        // Data admin default
        const adminData = {
          id: employeeId,
          username: 'admin',
          password: hashedPassword,
          name: 'Administrator',
          role: 'admin',
          role_access: ['POS', 'Kitchen', 'Meja', 'Keuangan', 'Laporan', 'Menu', 'Pegawai', 'Pengaturan'],
          phone: '',
          address: '',
          salary: 0,
          daily_rate: 0,
          status: 'active',
          is_logged_in: false,
          isActive: true
        };
        
        // Buat user admin
        const newAdmin = await EmployeeModel.create(adminData);
        
        console.log('[SEED] ✓ User admin berhasil dibuat!');
        console.log('[SEED] Admin credentials:', {
          id: newAdmin.id,
          username: newAdmin.username,
          password: defaultPassword, // Show plain password for first time setup
          name: newAdmin.name,
          role: newAdmin.role
        });
        
        console.log('\n[SEED] ⚠️  PENTING: Simpan kredensial ini!');
        console.log(`Username: admin`);
        console.log(`Password: ${defaultPassword}`);
        console.log('Segera ubah password setelah login pertama kali!');
      }
      
    } catch (dbError) {
      console.error('[SEED ERROR] Gagal seeding user admin:', {
        error: dbError.message,
        stack: dbError.stack
      });
      throw dbError;
    }

    console.log('\n[SEED] ✓ Proses seed tenant selesai!');
    console.log('\n[INFO] Cara testing dengan curl:');
    console.log(`curl -H "x-tenant-id: ${tenantData.slug}" http://localhost:5001/api/test/tenant-info`);
    console.log('\n[INFO] Cara login:');
    console.log('1. Buka http://localhost:5002/auth/login');
    console.log(`2. Tenant Slug: ${tenantData.slug}`);
    console.log('3. Username: admin');
    console.log('4. Password: admin123');

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
