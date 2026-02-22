const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/db');
const jwt = require('jsonwebtoken');
const { validateSlug } = require('../utils/slugValidator');

/**
 * Setup Controller
 * 
 * Handle tenant setup wizard (atomic operation)
 */

/**
 * POST /api/setup/tenant
 * Setup tenant baru (atomic operation)
 * 
 * Dipanggil setelah user selesai isi form di /setup-cafe
 */
const setupTenant = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { cafeName, slug, adminName } = req.body;
    const userId = req.user.userId; // Dari JWT middleware

    // Validasi input
    if (!cafeName || !slug) {
      return res.status(400).json({
        success: false,
        message: 'Nama kafe dan slug wajib diisi'
      });
    }

    // Validasi slug dengan slug validator (reserved keywords + format)
    const slugValidation = validateSlug(slug);
    if (!slugValidation.valid) {
      return res.status(400).json({
        success: false,
        message: slugValidation.error
      });
    }

    // Cari user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    // Cek apakah user sudah punya tenant
    if (user.hasCompletedSetup && user.tenantId) {
      return res.status(409).json({
        success: false,
        message: 'User sudah memiliki tenant',
        tenantSlug: user.tenantSlug
      });
    }

    // Cek apakah slug sudah digunakan
    const existingTenant = await Tenant.findOne({ slug: slug.toLowerCase() });
    if (existingTenant) {
      return res.status(409).json({
        success: false,
        message: 'Slug sudah digunakan, silakan pilih slug lain'
      });
    }

    // Susun dbName
    const dbName = `superkafe_${slug.toLowerCase().replace(/-/g, '_')}`;

    // Set trial expiry: 10 hari
    const trialExpiresAt = new Date();
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 10);

    // ATOMIC OPERATION: Buat tenant
    const newTenant = await Tenant.create({
      name: cafeName.trim(),
      slug: slug.toLowerCase(),
      dbName,
      isActive: true,
      status: 'trial',
      trialExpiresAt: trialExpiresAt
    });

    console.log('[SETUP] Tenant baru berhasil dibuat', {
      id: newTenant._id,
      name: newTenant.name,
      slug: newTenant.slug,
      dbName: newTenant.dbName
    });

    // Inisialisasi database tenant
    let tenantDB;
    
    try {
      tenantDB = await getTenantDB(dbName);
      
      // Seeding settings
      const SettingModel = tenantDB.model('Setting', require('../models/Setting').schema);
      
      const defaultSettings = [
        { key: 'store_name', value: cafeName, description: 'Nama toko/warkop', tenantId: newTenant._id },
        { key: 'store_address', value: '', description: 'Alamat toko', tenantId: newTenant._id },
        { key: 'store_phone', value: '', description: 'Nomor telepon toko', tenantId: newTenant._id },
        { key: 'currency', value: 'IDR', description: 'Mata uang yang digunakan', tenantId: newTenant._id },
        { key: 'timezone', value: 'Asia/Jakarta', description: 'Zona waktu', tenantId: newTenant._id },
        { key: 'tax_rate', value: 0, description: 'Persentase pajak', tenantId: newTenant._id },
        { key: 'service_charge', value: 0, description: 'Biaya layanan', tenantId: newTenant._id },
        { key: 'loyalty_settings', value: { enabled: false, pointsPerRupiah: 0.01, minPointsForReward: 100 }, description: 'Konfigurasi program loyalitas', tenantId: newTenant._id },
        { key: 'notification_sound', value: '/sounds/notif.mp3', description: 'File suara notifikasi', tenantId: newTenant._id },
        { key: 'units', value: ['pcs', 'kg', 'liter', 'porsi'], description: 'Unit satuan yang tersedia', tenantId: newTenant._id },
        { key: 'initialized', value: true, description: 'Status inisialisasi database', tenantId: newTenant._id },
        { key: 'initialized_at', value: new Date().toISOString(), description: 'Waktu inisialisasi database', tenantId: newTenant._id }
      ];

      await SettingModel.insertMany(defaultSettings);

      console.log('[SETUP] Settings berhasil di-seed');

      // Buat admin user di tenant database
      const { seedAdminUser } = require('../utils/seedAdminUser');
      const adminData = {
        email: user.email,
        password: user.password, // Sudah hashed atau null (Google)
        name: adminName || user.name,
        username: user.email.split('@')[0],
        isVerified: user.isVerified,
        authProvider: user.authProvider,
        googleId: user.googleId,
        image: user.image
      };

      await seedAdminUser(tenantDB, cafeName, adminData, newTenant._id);

      console.log('[SETUP] Admin user berhasil dibuat di tenant database');

      // Seed kategori dan menu default
      const { seedDefaultMenu } = require('../utils/seedDefaultMenu');
      const seedResult = await seedDefaultMenu(tenantDB, newTenant._id);
      
      if (seedResult.success) {
        console.log('[SETUP] Menu default berhasil di-seed:', {
          categories: seedResult.categoriesCount,
          menuItems: seedResult.menuItemsCount
        });
      }

    } catch (dbError) {
      // Rollback: Hapus tenant jika gagal inisialisasi database
      console.error('[SETUP ERROR] Gagal inisialisasi database, rollback', {
        error: dbError.message,
        tenantId: newTenant._id
      });

      await Tenant.findByIdAndDelete(newTenant._id);

      return res.status(500).json({
        success: false,
        message: 'Gagal menginisialisasi database tenant'
      });
    }

    // Update user: tandai setup selesai
    user.hasCompletedSetup = true;
    user.tenantId = newTenant._id;
    user.tenantSlug = newTenant.slug;
    await user.save();

    console.log('[SETUP] User berhasil di-update', {
      userId: user._id,
      tenantSlug: newTenant.slug,
      duration: `${Date.now() - startTime}ms`
    });

    // Generate JWT token baru (include tenant info)
    const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);
    const adminUser = await EmployeeModel.findOne({ email: user.email }).lean();

    const token = jwt.sign(
      {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        tenant: newTenant.slug,
        tenantId: newTenant._id.toString(),
        tenantDbName: dbName,
        userId: user._id
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Response sukses
    res.status(201).json({
      success: true,
      message: 'Setup tenant berhasil! Selamat datang di SuperKafe!',
      token: token,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        name: adminUser.name,
        image: adminUser.image,
        role: adminUser.role,
        role_access: adminUser.role_access,
        isVerified: adminUser.isVerified,
        authProvider: adminUser.authProvider
      },
      tenant: {
        id: newTenant._id,
        name: newTenant.name,
        slug: newTenant.slug,
        status: newTenant.status,
        trialExpiresAt: newTenant.trialExpiresAt,
        trialDaysRemaining: 10
      }
    });

  } catch (error) {
    console.error('[SETUP ERROR] Gagal setup tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat setup tenant'
    });
  }
};

/**
 * GET /api/setup/check-slug/:slug
 * Cek ketersediaan slug
 */
const checkSlug = async (req, res) => {
  try {
    const { slug } = req.params;

    // Validasi slug dengan slug validator (reserved keywords + format)
    const slugValidation = validateSlug(slug);
    if (!slugValidation.valid) {
      return res.json({
        success: true,
        available: false,
        message: slugValidation.error
      });
    }

    // Cek di database
    const existingTenant = await Tenant.findOne({ slug: slug.toLowerCase() });

    res.json({
      success: true,
      available: !existingTenant,
      message: existingTenant ? 'Slug sudah digunakan' : 'Slug tersedia'
    });

  } catch (error) {
    console.error('[SETUP ERROR] Gagal cek slug:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat cek slug'
    });
  }
};

module.exports = {
  setupTenant,
  checkSlug
};
