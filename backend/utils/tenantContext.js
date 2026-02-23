const { AsyncLocalStorage } = require('async_hooks');

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
 * @param {string} tenant.dbName - Tenant database name
 */
function setTenantContext(tenant) {
  try {
    tenantContext.enterWith(tenant);
    // Also set fallback for reliability
    fallbackContext = tenant;
    
    console.log('[TENANT CONTEXT] Context set successfully', {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[TENANT CONTEXT] Failed to set context with AsyncLocalStorage', {
      error: error.message,
      tenant: tenant.slug
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
  
  // DEBUG: Log when context is retrieved
  if (!result) {
    console.warn('[TENANT CONTEXT] No context available when getTenantContext() called', {
      hasAsyncContext: !!context,
      hasFallback: !!fallbackContext,
      timestamp: new Date().toISOString(),
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
  return tenantContext.run(tenant, fn);
}

module.exports = {
  setTenantContext,
  getTenantContext,
  runWithTenantContext
};
