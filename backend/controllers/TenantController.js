const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/db');

/**
 * Controller untuk manajemen tenant (cabang warkop)
 * Mengikuti AI_RULES.md: Error handling, logging, dan defensive programming
 */

/**
 * POST /api/tenants/register
 * Mendaftarkan tenant baru dan menginisialisasi database-nya
 */
exports.registerTenant = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { name, slug } = req.body;

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

    // Simpan data tenant ke database utama
    const newTenant = await Tenant.create({
      name: name.trim(),
      slug: slug.toLowerCase(),
      dbName,
      isActive: true
    });

    console.log('[TENANT] Tenant baru berhasil dibuat', {
      id: newTenant._id,
      name: newTenant.name,
      slug: newTenant.slug,
      dbName: newTenant.dbName,
      duration: `${Date.now() - startTime}ms`
    });

    // Inisialisasi database tenant dan seeding data awal
    try {
      const tenantDB = await getTenantDB(dbName);
      
      // Seeding data awal: Buat koleksi settings dengan data default
      // Menggunakan schema Setting yang ada (key-value pairs)
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

      console.log('[TENANT] Database tenant berhasil diinisialisasi dengan data awal', {
        dbName,
        settingsCount: defaultSettings.length,
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
      message: 'Tenant berhasil didaftarkan',
      data: {
        id: newTenant._id,
        name: newTenant.name,
        slug: newTenant.slug,
        dbName: newTenant.dbName,
        isActive: newTenant.isActive,
        createdAt: newTenant.createdAt
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
exports.getAllTenants = async (req, res) => {
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
exports.getTenantBySlug = async (req, res) => {
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
exports.toggleTenantStatus = async (req, res) => {
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
