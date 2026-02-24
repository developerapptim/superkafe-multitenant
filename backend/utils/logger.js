/**
 * Structured Logging Utility
 * 
 * Provides structured logging with correlation IDs for better traceability
 * and monitoring of tenant operations.
 * 
 * Log Levels:
 * - debug: Detailed information for debugging
 * - info: General informational messages
 * - warn: Warning messages for potentially harmful situations
 * - error: Error messages for failures
 * - security: Security-related events (cross-tenant access, validation failures)
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  security: 4
};

const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

/**
 * Generate a correlation ID for request tracing
 * @returns {string} Correlation ID
 */
function generateCorrelationId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format log message with structured data
 * @param {string} level - Log level
 * @param {string} category - Log category (e.g., 'TENANT', 'DB', 'SECURITY')
 * @param {string} message - Log message
 * @param {Object} data - Additional structured data
 * @returns {string} Formatted log message
 */
function formatLog(level, category, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    category,
    message,
    ...data
  };
  
  return JSON.stringify(logEntry);
}

/**
 * Log a debug message
 * @param {string} category - Log category
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
function debug(category, message, data = {}) {
  if (CURRENT_LOG_LEVEL <= LOG_LEVELS.debug) {
    console.log(formatLog('debug', category, message, data));
  }
}

/**
 * Log an info message
 * @param {string} category - Log category
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
function info(category, message, data = {}) {
  if (CURRENT_LOG_LEVEL <= LOG_LEVELS.info) {
    console.log(formatLog('info', category, message, data));
  }
}

/**
 * Log a warning message
 * @param {string} category - Log category
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
function warn(category, message, data = {}) {
  if (CURRENT_LOG_LEVEL <= LOG_LEVELS.warn) {
    console.warn(formatLog('warn', category, message, data));
  }
}

/**
 * Log an error message
 * @param {string} category - Log category
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
function error(category, message, data = {}) {
  if (CURRENT_LOG_LEVEL <= LOG_LEVELS.error) {
    console.error(formatLog('error', category, message, data));
  }
}

/**
 * Log a security event
 * @param {string} message - Security event message
 * @param {Object} data - Security event data
 */
function security(message, data = {}) {
  if (CURRENT_LOG_LEVEL <= LOG_LEVELS.security) {
    console.error(formatLog('security', 'SECURITY', message, {
      severity: 'HIGH',
      ...data
    }));
  }
}

/**
 * Log tenant context initialization
 * @param {Object} tenant - Tenant information
 * @param {string} correlationId - Request correlation ID
 */
function logTenantContextInit(tenant, correlationId) {
  info('TENANT_CONTEXT', 'Tenant context initialized', {
    correlationId,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    event: 'CONTEXT_INIT'
  });
}

/**
 * Log tenant validation failure
 * @param {string} reason - Failure reason
 * @param {Object} details - Failure details
 * @param {string} correlationId - Request correlation ID
 */
function logTenantValidationFailure(reason, details, correlationId) {
  warn('TENANT_VALIDATION', `Tenant validation failed: ${reason}`, {
    correlationId,
    reason,
    event: 'VALIDATION_FAILURE',
    ...details
  });
}

/**
 * Log cross-tenant access attempt
 * @param {Object} details - Access attempt details
 * @param {string} correlationId - Request correlation ID
 */
function logCrossTenantAccess(details, correlationId) {
  security('Cross-tenant access attempt detected', {
    correlationId,
    event: 'CROSS_TENANT_ACCESS',
    ...details
  });
}

/**
 * Log database connection event
 * @param {string} event - Connection event type
 * @param {Object} details - Event details
 */
function logDatabaseEvent(event, details = {}) {
  const level = event === 'error' || event === 'disconnected' ? 'error' : 'info';
  const logFn = level === 'error' ? error : info;
  
  logFn('DATABASE', `Database ${event}`, {
    event: `DB_${event.toUpperCase()}`,
    ...details
  });
}

module.exports = {
  generateCorrelationId,
  debug,
  info,
  warn,
  error,
  security,
  logTenantContextInit,
  logTenantValidationFailure,
  logCrossTenantAccess,
  logDatabaseEvent
};
