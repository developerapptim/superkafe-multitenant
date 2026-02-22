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
  } catch (error) {
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
  return context || fallbackContext;
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
