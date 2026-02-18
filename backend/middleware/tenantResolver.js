const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/db');

/**
 * Middleware untuk resolve tenant berdasarkan header 'x-tenant-id'
 * Middleware ini akan:
 * 1. Mengambil tenant-id dari request header
 * 2. Mencari data tenant di database utama
 * 3. Menginisialisasi koneksi ke database tenant
 * 4. Menyimpan informasi tenant dan koneksi di req object
 */
const tenantResolver = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    // Ambil tenant-id dari header
    const tenantId = req.headers['x-tenant-id'];

    // Validasi: tenant-id wajib ada
    if (!tenantId) {
      console.warn('[TENANT] Request tanpa x-tenant-id header', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(400).json({
        success: false,
        message: 'Header x-tenant-id wajib disertakan'
      });
    }

    // Cari data tenant di database utama berdasarkan slug
    const tenant = await Tenant.findOne({ 
      slug: tenantId.toLowerCase(),
      isActive: true 
    }).lean();

    // Validasi: tenant harus ditemukan dan aktif
    if (!tenant) {
      console.warn('[TENANT] Tenant tidak ditemukan atau tidak aktif', {
        tenantId,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan atau tidak aktif'
      });
    }

    // Dapatkan koneksi database untuk tenant ini (dengan connection pooling)
    const tenantDB = await getTenantDB(tenant.dbName);

    // Simpan informasi tenant dan koneksi di request object
    req.tenant = {
      id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      dbName: tenant.dbName
    };
    req.tenantDB = tenantDB;

    const duration = Date.now() - startTime;
    console.log('[TENANT] Resolved successfully', {
      tenant: tenant.slug,
      dbName: tenant.dbName,
      duration: `${duration}ms`,
      path: req.path
    });

    next();
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log error dengan konteks lengkap untuk debugging
    console.error('[TENANT ERROR] Failed to resolve tenant', {
      error: error.message,
      stack: error.stack,
      tenantId: req.headers['x-tenant-id'],
      path: req.path,
      method: req.method,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    // Kirim response error yang aman (tidak bocorkan stack trace)
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memproses tenant'
    });
  }
};

module.exports = tenantResolver;
