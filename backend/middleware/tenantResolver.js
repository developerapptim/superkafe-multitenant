const Tenant = require('../models/Tenant');
const { setTenantContext } = require('../utils/tenantContext');
const logger = require('../utils/logger');
const { alertCrossTenantAccess } = require('../utils/alerting');

/**
 * Unified Nexus Architecture - Tenant Resolver Middleware
 * 
 * This middleware validates tenant identity and establishes tenant context for each request.
 * It queries only the superkafe_v2 database and implements efficient caching.
 * 
 * Responsibilities:
 * - Extract tenant slug from x-tenant-slug HTTP header
 * - Validate tenant exists and is active in database
 * - Prevent cross-tenant access attempts
 * - Store tenant context in AsyncLocalStorage
 * - Cache tenant information to minimize database queries (5-minute TTL)
 * - Log security events (invalid tenants, cross-tenant attempts)
 */

// Tenant cache with 5-minute TTL
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get tenant from cache or database
 * @param {string} tenantSlug - Tenant slug identifier
 * @returns {Promise<Object|null>} Tenant object or null if not found
 */
const getTenantWithCache = async (tenantSlug) => {
  const cacheKey = tenantSlug.toLowerCase();
  const now = Date.now();
  
  // Check cache first
  const cached = tenantCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.tenant;
  }
  
  // Query database if not in cache or expired
  const tenant = await Tenant.findOne({ 
    slug: cacheKey,
    isActive: true 
  }).lean();
  
  // Store in cache if found
  if (tenant) {
    tenantCache.set(cacheKey, {
      tenant,
      timestamp: now
    });
  }
  
  return tenant;
};

/**
 * Invalidate tenant cache entry
 * @param {string} tenantSlug - Tenant slug to invalidate
 */
const invalidateTenantCache = (tenantSlug) => {
  tenantCache.delete(tenantSlug.toLowerCase());
};

/**
 * Clear all tenant cache entries
 */
const clearTenantCache = () => {
  tenantCache.clear();
};

/**
 * Tenant resolver middleware
 * Validates tenant identity and establishes context for each request
 */
const tenantResolver = async (req, res, next) => {
  const startTime = Date.now();
  const correlationId = logger.generateCorrelationId();
  
  try {
    // Extract tenant slug from header (support both x-tenant-slug and x-tenant-id for backward compatibility)
    // Express automatically converts headers to lowercase
    const tenantSlug = req.headers['x-tenant-slug'] || req.headers['x-tenant-id'];

    // Validation: tenant identifier is required
    if (!tenantSlug) {
      logger.logTenantValidationFailure('TENANT_HEADER_MISSING', {
        correlationId,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, correlationId);
      
      return res.status(400).json({
        success: false,
        message: 'Header x-tenant-slug atau x-tenant-id wajib disertakan',
        code: 'TENANT_HEADER_MISSING'
      });
    }

    // Get tenant from cache or database
    const tenant = await getTenantWithCache(tenantSlug);

    // Validation: tenant must exist and be active
    if (!tenant) {
      logger.logTenantValidationFailure('TENANT_NOT_FOUND', {
        correlationId,
        tenantSlug,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id || 'unauthenticated'
      }, correlationId);
      
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan atau tidak aktif',
        code: 'TENANT_NOT_FOUND'
      });
    }

    // Additional validation: check if tenant is truly active (not just isActive flag)
    // This handles cases where tenant might be expired or suspended
    if (!tenant.isActive) {
      logger.logTenantValidationFailure('TENANT_INACTIVE', {
        correlationId,
        tenantSlug: tenant.slug,
        tenantStatus: tenant.status,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id || 'unauthenticated'
      }, correlationId);
      
      return res.status(403).json({
        success: false,
        message: 'Tenant tidak ditemukan atau tidak aktif',
        code: 'TENANT_INACTIVE'
      });
    }

    // Security check: Prevent cross-tenant access attempts
    // If user is authenticated and has a tenant, it must match the requested tenant
    if (req.user && req.user.tenant && req.user.tenant !== tenant.slug) {
      logger.logCrossTenantAccess({
        correlationId,
        userId: req.user.id,
        userEmail: req.user.email,
        userTenant: req.user.tenant,
        requestedTenant: tenant.slug,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }, correlationId);
      
      // Send alert for cross-tenant access attempt
      await alertCrossTenantAccess({
        correlationId,
        userId: req.user.id,
        userEmail: req.user.email,
        userTenant: req.user.tenant,
        requestedTenant: tenant.slug,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to tenant data',
        code: 'CROSS_TENANT_ACCESS'
      });
    }

    // Store tenant information in request object
    // Note: dbName is always 'superkafe_v2' in unified architecture
    req.tenant = {
      id: tenant._id.toString(),
      name: tenant.name,
      slug: tenant.slug,
      dbName: 'superkafe_v2', // Always use unified database
      correlationId // Add correlation ID for tracing
    };

    // Set tenant context in AsyncLocalStorage for automatic query scoping
    setTenantContext(req.tenant);

    const duration = Date.now() - startTime;
    logger.info('TENANT_RESOLVER', 'Tenant resolved successfully', {
      correlationId,
      tenantSlug: tenant.slug,
      dbName: 'superkafe_v2',
      duration: `${duration}ms`,
      cached: tenantCache.has(tenant.slug.toLowerCase()),
      path: req.path,
      userId: req.user?.id || 'unauthenticated',
      event: 'TENANT_RESOLVED'
    });

    next();
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log error with full context for debugging
    logger.error('TENANT_RESOLVER', 'Failed to resolve tenant', {
      correlationId,
      code: 'TENANT_RESOLUTION_ERROR',
      error: {
        message: error.message,
        name: error.name,
        code: error.code
      },
      stack: error.stack,
      tenantSlug: req.headers['x-tenant-slug'] || req.headers['x-tenant-id'],
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id || 'unauthenticated',
      duration: `${duration}ms`,
      event: 'TENANT_RESOLUTION_ERROR'
    });

    // Send safe error response (don't leak stack trace)
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat memproses tenant',
      code: 'TENANT_RESOLUTION_ERROR'
    });
  }
};

// Export as default for backward compatibility
module.exports = tenantResolver;
// Also export named functions
module.exports.tenantResolver = tenantResolver;
module.exports.invalidateTenantCache = invalidateTenantCache;
module.exports.clearTenantCache = clearTenantCache;
