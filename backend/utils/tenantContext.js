const { AsyncLocalStorage } = require('async_hooks');
const logger = require('./logger');

/**
 * Tenant Context Storage using AsyncLocalStorage
 * 
 * This utility provides a way to store and retrieve tenant context
 * throughout the async execution chain without passing it explicitly
 * through every function call.
 * 
 * Used by:
 * - tenantResolver middleware to set context
 * - tenantScopingPlugin to retrieve context for automatic filtering
 */
const tenantContext = new AsyncLocalStorage();

// Fallback for test environments where AsyncLocalStorage might not work properly
let fallbackContext = null;

/**
 * Set the tenant context for the current async execution
 * @param {Object} tenant - Tenant information
 * @param {string} tenant.id - Tenant ID (ObjectId as string)
 * @param {string} tenant.slug - Tenant slug
 * @param {string} tenant.name - Tenant name
 * @param {string} tenant.dbName - Tenant database name (always 'superkafe_v2' in unified architecture)
 */
function setTenantContext(tenant) {
  if (!tenant || !tenant.id || !tenant.slug) {
    logger.error('TENANT_CONTEXT', 'Invalid tenant data provided to setTenantContext', {
      hasId: !!tenant?.id,
      hasSlug: !!tenant?.slug,
      event: 'CONTEXT_INIT_FAILED'
    });
    throw new Error('Invalid tenant data: id and slug are required');
  }

  try {
    tenantContext.enterWith(tenant);
    // Also set fallback for reliability
    fallbackContext = tenant;
    
    // Log tenant context initialization with structured logging
    logger.logTenantContextInit(tenant, tenant.correlationId);
  } catch (error) {
    logger.error('TENANT_CONTEXT', 'Failed to set context with AsyncLocalStorage', {
      error: error.message,
      tenantSlug: tenant.slug,
      event: 'CONTEXT_INIT_ERROR'
    });
    // Fallback for environments where AsyncLocalStorage doesn't work
    fallbackContext = tenant;
  }
}

/**
 * Get the current tenant context
 * @returns {Object|undefined} Tenant context or undefined if not set
 */
function getTenantContext() {
  const context = tenantContext.getStore();
  const result = context || fallbackContext;
  
  // Enhanced logging when context is retrieved
  if (result) {
    // Only log in debug mode to avoid excessive logging
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('TENANT_CONTEXT', 'Context retrieved', {
        tenantId: result.id,
        tenantSlug: result.slug,
        source: context ? 'AsyncLocalStorage' : 'fallback',
        event: 'CONTEXT_RETRIEVED'
      });
    }
  } else {
    logger.warn('TENANT_CONTEXT', 'No context available when getTenantContext() called', {
      hasAsyncContext: !!context,
      hasFallback: !!fallbackContext,
      event: 'CONTEXT_MISSING',
      stack: new Error().stack.split('\n').slice(1, 4).join('\n')
    });
  }
  
  return result;
}

/**
 * Run a function with a specific tenant context
 * @param {Object} tenant - Tenant information
 * @param {Function} fn - Function to run with the tenant context
 * @returns {*} Result of the function
 */
function runWithTenantContext(tenant, fn) {
  if (!tenant || !tenant.id || !tenant.slug) {
    logger.error('TENANT_CONTEXT', 'Invalid tenant data provided to runWithTenantContext', {
      hasId: !!tenant?.id,
      hasSlug: !!tenant?.slug,
      event: 'RUN_WITH_CONTEXT_FAILED'
    });
    throw new Error('Invalid tenant data: id and slug are required');
  }

  logger.debug('TENANT_CONTEXT', 'Running function with tenant context', {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    event: 'RUN_WITH_CONTEXT'
  });

  return tenantContext.run(tenant, fn);
}

module.exports = {
  setTenantContext,
  getTenantContext,
  runWithTenantContext
};
