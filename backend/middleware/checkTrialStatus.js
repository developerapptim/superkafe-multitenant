const Tenant = require('../models/Tenant');

/**
 * Middleware untuk cek status trial tenant
 * Blokir akses ke fitur premium jika trial habis dan belum bayar
 */
const checkTrialStatus = async (req, res, next) => {
  try {
    // Ambil tenant slug dari header atau request
    const tenantSlug = req.headers['x-tenant-id'] || req.tenantSlug;

    if (!tenantSlug) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID tidak ditemukan'
      });
    }

    // Cari tenant
    const tenant = await Tenant.findOne({ slug: tenantSlug.toLowerCase() }).lean();

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant tidak ditemukan'
      });
    }

    // Cek status tenant
    const now = new Date();

    // Jika status paid, langsung allow
    if (tenant.status === 'paid') {
      req.tenant = tenant;
      return next();
    }

    // Jika status trial, cek expiry
    if (tenant.status === 'trial') {
      if (now < tenant.trialExpiresAt) {
        // Trial masih aktif
        req.tenant = tenant;
        
        // Hitung sisa hari
        const daysRemaining = Math.ceil((tenant.trialExpiresAt - now) / (1000 * 60 * 60 * 24));
        
        // Attach info ke request untuk logging
        req.trialInfo = {
          daysRemaining,
          expiresAt: tenant.trialExpiresAt
        };
        
        return next();
      } else {
        // Trial sudah habis
        console.warn('[TRIAL EXPIRED]', {
          tenant: tenantSlug,
          expiresAt: tenant.trialExpiresAt,
          now: now
        });

        return res.status(403).json({
          success: false,
          error: 'Masa trial habis. Silakan upgrade ke paket berbayar untuk melanjutkan.',
          trialExpired: true,
          expiresAt: tenant.trialExpiresAt
        });
      }
    }

    // Jika status expired atau suspended
    if (tenant.status === 'expired' || tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Akses ditangguhkan. Silakan hubungi administrator.',
        status: tenant.status
      });
    }

    // Default: block access
    return res.status(403).json({
      success: false,
      error: 'Akses tidak diizinkan'
    });

  } catch (error) {
    console.error('[CHECK TRIAL ERROR]', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat memeriksa status trial'
    });
  }
};

/**
 * Middleware ringan untuk cek trial status tanpa blokir
 * Hanya attach info trial ke request
 */
const attachTrialInfo = async (req, res, next) => {
  try {
    const tenantSlug = req.headers['x-tenant-id'] || req.tenantSlug;

    if (!tenantSlug) {
      return next();
    }

    const tenant = await Tenant.findOne({ slug: tenantSlug.toLowerCase() }).lean();

    if (!tenant) {
      return next();
    }

    const now = new Date();
    const daysRemaining = tenant.status === 'trial' 
      ? Math.ceil((tenant.trialExpiresAt - now) / (1000 * 60 * 60 * 24))
      : 0;

    req.trialInfo = {
      status: tenant.status,
      daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
      expiresAt: tenant.trialExpiresAt,
      isActive: tenant.status === 'paid' || (tenant.status === 'trial' && now < tenant.trialExpiresAt)
    };

    next();
  } catch (error) {
    console.error('[ATTACH TRIAL INFO ERROR]', error.message);
    next(); // Continue even if error
  }
};

module.exports = {
  checkTrialStatus,
  attachTrialInfo
};
