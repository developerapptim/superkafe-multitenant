const Tenant = require('../models/Tenant');
const Employee = require('../models/Employee');
const { validateSlug } = require('../utils/slugValidator');
const { runWithTenantContext } = require('../utils/tenantContext');

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
    const { name, slug, email, password, adminName, authProvider, googleId, googlePicture } = req.body;

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

    // Validasi email wajib (untuk semua jenis registrasi)
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email wajib diisi'
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

    // Validasi password HANYA untuk registrasi manual (bukan Google)
    const isGoogleAuth = authProvider === 'google';

    if (!isGoogleAuth) {
      // Registrasi manual: password wajib
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password wajib diisi'
        });
      }

      // Validasi password minimal 6 karakter
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password minimal 6 karakter'
        });
      }
    } else {
      // Registrasi Google: validasi googleId
      if (!googleId) {
        return res.status(400).json({
          success: false,
          message: 'Google ID wajib untuk registrasi dengan Google'
        });
      }
    }

    // Validasi slug terhadap reserved keywords dan format
    const slugValidation = validateSlug(slug);
    if (!slugValidation.valid) {
      console.warn('[TENANT] Registrasi gagal: slug tidak valid', {
        slug,
        error: slugValidation.error,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        message: slugValidation.error
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

    // In unified architecture, all tenants use the same database
    const dbName = 'superkafe_v2';

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
      // Use tenant context for seeding operations
      await runWithTenantContext(
        { id: newTenant._id.toString(), slug: newTenant.slug, name: newTenant.name, dbName: dbName },
        async () => {
          // Seeding data awal: Buat koleksi settings dengan data default
          const SettingModel = require('../models/Setting');

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

          // Generate OTP untuk email verification (hanya untuk registrasi manual)
          let otpCode, otpExpiry;

          if (!isGoogleAuth) {
            const { generateOTP, sendOTPEmail } = require('../services/emailService');
            otpCode = generateOTP();
            otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 menit
          }

          // Seeding User Admin dengan data dari registrasi
          const { seedAdminUser } = require('../utils/seedAdminUser');
          const adminData = {
            email: email,
            password: isGoogleAuth ? null : password, // Password null untuk Google auth
            name: adminName || 'Administrator',
            username: email.split('@')[0], // Username dari email
            isVerified: isGoogleAuth ? true : false, // Google auth langsung verified
            authProvider: isGoogleAuth ? 'google' : 'local',
            googleId: isGoogleAuth ? googleId : undefined,
            image: isGoogleAuth ? googlePicture : undefined
          };

          const adminResult = await seedAdminUser(null, name, adminData);

          // Update admin dengan OTP code (hanya untuk registrasi manual)
          if (!isGoogleAuth) {
            await Employee.findOneAndUpdate(
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
              const { sendOTPEmail } = require('../services/emailService');
              await sendOTPEmail(email, otpCode, name);
              console.log('[TENANT] OTP email sent successfully');
            } catch (emailError) {
              console.error('[TENANT] Failed to send OTP email:', emailError.message);
              // Don't fail registration if email fails, user can request resend
            }
          } else {
            console.log('[TENANT] Admin user created with Google auth (no OTP needed)', {
              email: email,
              googleId: googleId
            });
          }

          console.log('[TENANT] Database tenant berhasil diinisialisasi dengan data awal', {
            dbName,
            settingsCount: defaultSettings.length,
            adminCreated: !adminResult.existed,
            duration: `${Date.now() - startTime}ms`
          });
        }
      );

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
    const responseData = {
      success: true,
      message: isGoogleAuth
        ? 'Tenant berhasil didaftarkan dengan Google. Selamat datang!'
        : 'Tenant berhasil didaftarkan. Silakan cek email Anda untuk kode verifikasi.',
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
        requiresVerification: !isGoogleAuth // Google auth tidak perlu verifikasi
      }
    };

    // Jika Google auth, generate JWT token dan include user data
    if (isGoogleAuth) {
      const jwt = require('jsonwebtoken');
      const adminUser = await runWithTenantContext(
        { id: newTenant._id.toString(), slug: newTenant.slug, name: newTenant.name, dbName: dbName },
        async () => {
          return await Employee.findOne({ email: email }).lean();
        }
      );

      const token = jwt.sign(
        {
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
          tenant: slug.toLowerCase(),
          tenantSlug: slug.toLowerCase(), // CRITICAL: Add tenantSlug for frontend header
          tenantDbName: dbName
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      responseData.token = token;
      responseData.user = {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        name: adminUser.name,
        image: adminUser.image,
        role: adminUser.role,
        role_access: adminUser.role_access,
        isVerified: adminUser.isVerified,
        authProvider: adminUser.authProvider
      };
    }

    res.status(201).json(responseData);

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

    let expiresAt = tenant.trialExpiresAt;
    let daysRemaining = 0;
    let isActive = false;

    if (tenant.status === 'paid') {
      expiresAt = tenant.subscriptionExpiresAt || tenant.trialExpiresAt;
      const msDiff = expiresAt - now;
      daysRemaining = msDiff > 0 ? Math.ceil(msDiff / (1000 * 60 * 60 * 24)) : 0;
      isActive = msDiff > 0;
    } else {
      // trial or other
      const msDiff = tenant.trialExpiresAt - now;
      daysRemaining = msDiff > 0 ? Math.ceil(msDiff / (1000 * 60 * 60 * 24)) : 0;
      isActive = msDiff > 0;
    }

    res.json({
      success: true,
      data: {
        status: tenant.status,
        expiresAt: expiresAt,
        trialExpiresAt: tenant.trialExpiresAt,
        subscriptionExpiresAt: tenant.subscriptionExpiresAt,
        daysRemaining: daysRemaining,
        isActive: isActive,
        canAccessFeatures: isActive,
        planName: tenant.subscriptionPlan || 'Starter (Default)'
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
