const Tenant = require('../models/Tenant');

/**
 * Subscription Middleware
 * Checks tenant subscription status and enforces access control.
 * Supports: trial, active, grace (3-day window), expired, suspended
 */

const GRACE_PERIOD_DAYS = 3;

/**
 * Blocking middleware — denies access if subscription is expired/suspended.
 * Grace period: allows access but sets warning header.
 */
const checkTrialStatus = async (req, res, next) => {
  try {
    const tenantSlug = req.headers['x-tenant-id'] || req.headers['x-tenant-slug'] || req.tenantSlug;

    if (!tenantSlug) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID tidak ditemukan'
      });
    }

    const tenant = await Tenant.findOne({ slug: tenantSlug.toLowerCase() });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant tidak ditemukan'
      });
    }

    // Auto-transition status based on dates
    const statusChanged = tenant.refreshSubscriptionStatus();
    if (statusChanged) {
      await tenant.save();
    }

    const now = new Date();

    // ACTIVE or PAID (legacy compat) — full access
    if (tenant.status === 'active' || tenant.status === 'paid') {
      req.tenant = tenant;
      req.subscriptionInfo = buildSubscriptionInfo(tenant, now);
      return next();
    }

    // TRIAL — check expiry
    if (tenant.status === 'trial') {
      if (now < tenant.trialExpiresAt) {
        req.tenant = tenant;
        req.subscriptionInfo = buildSubscriptionInfo(tenant, now);
        return next();
      } else {
        return res.status(403).json({
          success: false,
          error: 'Masa trial habis. Silakan upgrade ke paket berbayar untuk melanjutkan.',
          trialExpired: true,
          subscriptionExpired: true,
          expiresAt: tenant.trialExpiresAt
        });
      }
    }

    // GRACE — allow access but warn
    if (tenant.status === 'grace') {
      req.tenant = tenant;
      req.subscriptionInfo = buildSubscriptionInfo(tenant, now);
      // Set warning header for frontend to detect
      res.set('X-Subscription-Warning', 'grace');
      res.set('X-Grace-Ends-At', tenant.gracePeriodEndsAt?.toISOString());
      return next();
    }

    // EXPIRED or SUSPENDED — block
    if (tenant.status === 'expired' || tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: tenant.status === 'expired'
          ? 'Langganan Anda telah berakhir. Silakan perpanjang untuk melanjutkan.'
          : 'Akses ditangguhkan. Silakan hubungi administrator.',
        subscriptionExpired: true,
        status: tenant.status,
        expiresAt: tenant.subscriptionExpiresAt || tenant.trialExpiresAt
      });
    }

    // Default: block
    return res.status(403).json({
      success: false,
      error: 'Akses tidak diizinkan'
    });

  } catch (error) {
    console.error('[SUBSCRIPTION CHECK ERROR]', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat memeriksa status langganan'
    });
  }
};

/**
 * Non-blocking middleware — attaches subscription info without denying access.
 * Used for routes that need subscription context but shouldn't be blocked.
 */
const attachTrialInfo = async (req, res, next) => {
  try {
    const tenantSlug = req.headers['x-tenant-id'] || req.headers['x-tenant-slug'] || req.tenantSlug;

    if (!tenantSlug) {
      return next();
    }

    const tenant = await Tenant.findOne({ slug: tenantSlug.toLowerCase() });

    if (!tenant) {
      return next();
    }

    // Auto-transition
    const statusChanged = tenant.refreshSubscriptionStatus();
    if (statusChanged) {
      await tenant.save();
    }

    const now = new Date();
    req.subscriptionInfo = buildSubscriptionInfo(tenant, now);

    // Legacy compat
    req.trialInfo = {
      status: tenant.status,
      daysRemaining: req.subscriptionInfo.daysRemaining,
      expiresAt: req.subscriptionInfo.expiresAt,
      isActive: req.subscriptionInfo.canAccessFeatures
    };

    next();
  } catch (error) {
    console.error('[ATTACH SUBSCRIPTION INFO ERROR]', error.message);
    next();
  }
};

/**
 * Build a standardized subscription info object
 */
function buildSubscriptionInfo(tenant, now) {
  let expiresAt, daysRemaining, canAccessFeatures;

  if (tenant.status === 'trial') {
    expiresAt = tenant.trialExpiresAt;
    const msDiff = expiresAt - now;
    daysRemaining = msDiff > 0 ? Math.ceil(msDiff / (1000 * 60 * 60 * 24)) : 0;
    canAccessFeatures = msDiff > 0;
  } else if (tenant.status === 'active' || tenant.status === 'paid') {
    expiresAt = tenant.subscriptionExpiresAt || tenant.trialExpiresAt;
    const msDiff = expiresAt - now;
    daysRemaining = msDiff > 0 ? Math.ceil(msDiff / (1000 * 60 * 60 * 24)) : 0;
    canAccessFeatures = true;
  } else if (tenant.status === 'grace') {
    expiresAt = tenant.subscriptionExpiresAt;
    daysRemaining = 0; // Subscription already expired
    canAccessFeatures = true; // But still have grace access
  } else {
    expiresAt = tenant.subscriptionExpiresAt || tenant.trialExpiresAt;
    daysRemaining = 0;
    canAccessFeatures = false;
  }

  return {
    status: tenant.status,
    plan: tenant.subscriptionPlan || null,
    expiresAt,
    daysRemaining,
    canAccessFeatures,
    isGracePeriod: tenant.status === 'grace',
    gracePeriodEndsAt: tenant.gracePeriodEndsAt || null,
    trialExpiresAt: tenant.trialExpiresAt,
    subscriptionExpiresAt: tenant.subscriptionExpiresAt
  };
}

module.exports = {
  checkTrialStatus,
  attachTrialInfo
};
