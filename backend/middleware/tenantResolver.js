const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/db');
const { setTenantContext } = require('../utils/tenantContext');

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
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // DEBUG: Log all headers to verify what's being received
    console.log('[TENANT DEBUG] Incoming headers:', {
      requestId,
      headers: req.headers,
      path: req.path,
      method: req.method
    });

    // Ambil tenant identifier dari header (support both slug and id)
    // Express automatically converts headers to lowercase
    const tenantSlug = req.headers['x-tenant-slug'] || req.headers['x-tenant-id'];

    // Validasi: tenant identifier wajib ada
    if (!tenantSlug) {
      console.warn('[TENANT] Request tanpa x-tenant-slug atau x-tenant-id header', {
        requestId,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        allHeaders: Object.keys(req.headers),
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        success: false,
        message: 'Header x-tenant-slug atau x-tenant-id wajib disertakan'
      });
    }

    // Cari data tenant di database utama berdasarkan slug
    const tenant = await Tenant.findOne({ 
      slug: tenantSlug.toLowerCase(),
      isActive: true 
    }).lean();

    // Validasi: tenant harus ditemukan dan aktif
    if (!tenant) {
      console.warn('[TENANT] Tenant tidak ditemukan atau tidak aktif', {
        requestId,
        tenantSlug,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id || 'unauthenticated',
        timestamp: new Date().toISOString()
      });
      
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan atau tidak aktif'
      });
    }

    // Security check: Log if authenticated user's tenant doesn't match requested tenant
    if (req.user && req.user.tenant && req.user.tenant !== tenant.slug) {
      console.error('[SECURITY] Cross-tenant access attempt detected', {
        requestId,
        severity: 'HIGH',
        userId: req.user.id,
        userEmail: req.user.email,
        userTenant: req.user.tenant,
        requestedTenant: tenant.slug,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });
      
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to tenant data'
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

    // Set tenant context for AsyncLocalStorage (used by Mongoose plugin)
    setTenantContext(req.tenant);

    // DEBUG: Verify context was set correctly
    const { getTenantContext } = require('../utils/tenantContext');
    const verifyContext = getTenantContext();
    console.log('[TENANT DEBUG] Context verification:', {
      requestId,
      contextSet: !!verifyContext,
      contextId: verifyContext?.id,
      contextSlug: verifyContext?.slug,
      expectedId: tenant._id.toString(),
      expectedSlug: tenant.slug
    });

    const duration = Date.now() - startTime;
    console.log('[TENANT] Resolved successfully', {
      requestId,
      tenant: tenant.slug,
      dbName: tenant.dbName,
      duration: `${duration}ms`,
      path: req.path,
      userId: req.user?.id || 'unauthenticated'
    });

    next();
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log error dengan konteks lengkap untuk debugging
    console.error('[TENANT ERROR] Failed to resolve tenant', {
      requestId,
      severity: 'ERROR',
      error: {
        message: error.message,
        name: error.name,
        code: error.code
      },
      stack: error.stack,
      tenantId: req.headers['x-tenant-id'],
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id || 'unauthenticated',
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
