const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/db');

/**
 * Controller untuk manajemen tenant (cabang warkop)
 * Mengikuti AI_RULES.md: Error handling, logging, dan defensive programming
 */

/**
 * POST /api/tenants/register
 * Mendaftarkan tenant baru dan menginisialisasi database-nya
 * Dengan email verification
 */
const registerTenant = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { name, slug, email, password, adminName } = req.body;

    // Validasi input
    if (!name || !slug) {
      console.warn('[TENANT] Registrasi gagal: name atau slug kosong', {
        body: req.body,
        ip: req.ip
      });
      
      return res.status(400).json({
        success: false,
        message: 'Nama dan slug wajib diisi'
      });
    }

    // Validasi email dan password (required untuk dynamic registration)
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password wajib diisi'
      });
    }

    // Validasi format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid'
      });
    }

    // Validasi password minimal 6 karakter
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 6 karakter'
      });
    }

    // Validasi format slug (hanya huruf kecil, angka, dan dash)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      return res.status(400).json({
        success: false,
        message: 'Slug hanya boleh mengandung huruf kecil, angka, dan tanda hubung (-)'
      });
    }

    // Cek apakah slug sudah digunakan
    const existingTenant = await Tenant.findOne({ slug: slug.toLowerCase() }).lean();
    if (existingTenant) {
      console.warn('[TENANT] Registrasi gagal: slug sudah digunakan', {
        slug,
        existingTenant: existingTenant._id
      });
      
      return res.status(409).json({
        success: false,
        message: 'Slug sudah digunakan, silakan pilih slug lain'
      });
    }

    // Susun dbName otomatis: superkafe_[slug_dengan_underscore]
    const dbName = `superkafe_${slug.toLowerCase().replace(/-/g, '_')}`;

    // Set trial expiry: 10 hari dari sekarang
    const trialExpiresAt = new Date();
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 10);

    // Simpan data tenant ke database utama
    const newTenant = await Tenant.create({
      name: name.trim(),
      slug: slug.toLowerCase(),
      dbName,
      isActive: true,
      status: 'trial',
      trialExpiresAt: trialExpiresAt
    });

    console.log('[TENANT] Tenant baru berhasil dibuat dengan trial 10 hari', {
      id: newTenant._id,
      name: newTenant.name,
      slug: newTenant.slug,
      dbName: newTenant.dbName,
      status: newTenant.status,
      trialExpiresAt: newTenant.trialExpiresAt,
      duration: `${Date.now() - startTime}ms`
    });

    // Inisialisasi database tenant dan seeding data awal
    try {
      const tenantDB = await getTenantDB(dbName);
      
      // Seeding data awal: Buat koleksi settings dengan data default
      const SettingModel = tenantDB.model('Setting', require('../models/Setting').schema);
      
      // Data settings awal untuk tenant baru
      const defaultSettings = [
        {
          key: 'store_name',
          value: name,
          description: 'Nama toko/warkop'
        },
        {
          key: 'store_address',
          value: '',
          description: 'Alamat toko'
        },
        {
          key: 'store_phone',
          value: '',
          description: 'Nomor telepon toko'
        },
        {
          key: 'currency',
          value: 'IDR',
          description: 'Mata uang yang digunakan'
        },
        {
          key: 'timezone',
          value: 'Asia/Jakarta',
          description: 'Zona waktu'
        },
        {
          key: 'tax_rate',
          value: 0,
          description: 'Persentase pajak'
        },
        {
          key: 'service_charge',
          value: 0,
          description: 'Biaya layanan'
        },
        {
          key: 'loyalty_settings',
          value: {
            enabled: false,
            pointsPerRupiah: 0.01,
            minPointsForReward: 100
          },
          description: 'Konfigurasi program loyalitas'
        },
        {
          key: 'notification_sound',
          value: '/sounds/notif.mp3',
          description: 'File suara notifikasi'
        },
        {
          key: 'units',
          value: ['pcs', 'kg', 'liter', 'porsi'],
          description: 'Unit satuan yang tersedia'
        },
        {
          key: 'initialized',
          value: true,
          description: 'Status inisialisasi database'
        },
        {
          key: 'initialized_at',
          value: new Date().toISOString(),
          description: 'Waktu inisialisasi database'
        }
      ];

      // Insert semua settings sekaligus
      await SettingModel.insertMany(defaultSettings);

      console.log('[TENANT] Settings berhasil di-seed', {
        dbName,
        settingsCount: defaultSettings.length
      });

      // Generate OTP untuk email verification
      const { generateOTP, sendOTPEmail } = require('../services/emailService');
      const otpCode = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

      // Seeding User Admin dengan data dari registrasi
      const { seedAdminUser } = require('../utils/seedAdminUser');
      const adminResult = await seedAdminUser(tenantDB, name, {
        email: email,
        password: password,
        name: adminName || 'Administrator',
        username: email.split('@')[0], // Username dari email
        isVerified: false // Belum terverifikasi
      });

      // Update admin dengan OTP code
      const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);
      await EmployeeModel.findOneAndUpdate(
        { email: email },
        {
          otpCode: otpCode,
          otpExpiry: otpExpiry
        }
      );

      console.log('[TENANT] Admin user created with OTP', {
        email: email,
        otpExpiry: otpExpiry
      });

      // Kirim OTP ke email
      try {
        await sendOTPEmail(email, otpCode, name);
        console.log('[TENANT] OTP email sent successfully');
      } catch (emailError) {
        console.error('[TENANT] Failed to send OTP email:', emailError.message);
        // Don't fail registration if email fails, user can request resend
      }

      console.log('[TENANT] Database tenant berhasil diinisialisasi dengan data awal', {
        dbName,
        settingsCount: defaultSettings.length,
        adminCreated: !adminResult.existed,
        duration: `${Date.now() - startTime}ms`
      });

    } catch (dbError) {
      // Jika gagal inisialisasi database, rollback tenant yang sudah dibuat
      console.error('[TENANT ERROR] Gagal inisialisasi database tenant, melakukan rollback', {
        error: dbError.message,
        stack: dbError.stack,
        dbName,
        tenantId: newTenant._id
      });

      // ROLLBACK: Hapus tenant dari database utama
      try {
        await Tenant.findByIdAndDelete(newTenant._id);
        console.log('[TENANT] Rollback berhasil: tenant dihapus dari database utama', {
          tenantId: newTenant._id,
          slug: newTenant.slug
        });
      } catch (rollbackError) {
        console.error('[TENANT ERROR] Gagal melakukan rollback', {
          error: rollbackError.message,
          tenantId: newTenant._id
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Gagal menginisialisasi database tenant. Registrasi dibatalkan.'
      });
    }

    // Response sukses
    res.status(201).json({
      success: true,
      message: 'Tenant berhasil didaftarkan. Silakan cek email Anda untuk kode verifikasi.',
      data: {
        id: newTenant._id,
        name: newTenant.name,
        slug: newTenant.slug,
        dbName: newTenant.dbName,
        email: email,
        isActive: newTenant.isActive,
        status: newTenant.status,
        trialExpiresAt: newTenant.trialExpiresAt,
        trialDaysRemaining: 10,
        createdAt: newTenant.createdAt,
        requiresVerification: true
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log error dengan konteks lengkap
    console.error('[TENANT ERROR] Gagal mendaftarkan tenant', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    // Response error yang aman (tidak bocorkan stack trace)
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mendaftarkan tenant'
    });
  }
};

/**
 * GET /api/tenants
 * Mendapatkan daftar semua tenant
 */
const getAllTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find().lean();

    res.json({
      success: true,
      data: tenants
    });

  } catch (error) {
    console.error('[TENANT ERROR] Gagal mengambil daftar tenant', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar tenant'
    });
  }
};

/**
 * GET /api/tenants/:slug
 * Mendapatkan detail tenant berdasarkan slug
 */
const getTenantBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const tenant = await Tenant.findOne({ slug: slug.toLowerCase() }).lean();

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: tenant
    });

  } catch (error) {
    console.error('[TENANT ERROR] Gagal mengambil detail tenant', {
      error: error.message,
      stack: error.stack,
      slug: req.params.slug
    });

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil detail tenant'
    });
  }
};

/**
 * PATCH /api/tenants/:id/toggle
 * Mengaktifkan/menonaktifkan tenant
 */
const toggleTenantStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await Tenant.findById(id);

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan'
      });
    }

    tenant.isActive = !tenant.isActive;
    await tenant.save();

    console.log('[TENANT] Status tenant diubah', {
      id: tenant._id,
      slug: tenant.slug,
      isActive: tenant.isActive
    });

    res.json({
      success: true,
      message: `Tenant berhasil ${tenant.isActive ? 'diaktifkan' : 'dinonaktifkan'}`,
      data: {
        id: tenant._id,
        slug: tenant.slug,
        isActive: tenant.isActive
      }
    });

  } catch (error) {
    console.error('[TENANT ERROR] Gagal mengubah status tenant', {
      error: error.message,
      stack: error.stack,
      id: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Gagal mengubah status tenant'
    });
  }
};


/**
 * GET /api/tenants/:slug/trial-status
 * Mendapatkan status trial tenant
 */
const getTrialStatus = async (req, res) => {
  try {
    const { slug } = req.params;

    const tenant = await Tenant.findOne({ slug: slug.toLowerCase() }).lean();

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan'
      });
    }

    const now = new Date();
    const daysRemaining = tenant.status === 'trial' 
      ? Math.ceil((tenant.trialExpiresAt - now) / (1000 * 60 * 60 * 24))
      : 0;

    const isActive = tenant.status === 'paid' || 
                     (tenant.status === 'trial' && now < tenant.trialExpiresAt);

    res.json({
      success: true,
      data: {
        status: tenant.status,
        trialExpiresAt: tenant.trialExpiresAt,
        daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
        isActive: isActive,
        canAccessFeatures: isActive
      }
    });

  } catch (error) {
    console.error('[TENANT ERROR] Gagal mengambil status trial', {
      error: error.message,
      stack: error.stack,
      slug: req.params.slug
    });

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil status trial'
    });
  }
};

module.exports = {
  registerTenant,
  getAllTenants,
  getTenantBySlug,
  toggleTenantStatus,
  getTrialStatus
};
