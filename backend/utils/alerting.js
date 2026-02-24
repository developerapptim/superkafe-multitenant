/**
 * Alerting Utility
 * 
 * Provides alerting functionality for critical events in the system.
 * Alerts can be sent via multiple channels (console, email, webhook, etc.)
 * 
 * Critical Events:
 * - Database connection failures
 * - Cross-tenant access attempts
 * - High error rates
 * - Performance degradation
 */

const logger = require('./logger');

// Alert configuration
const ALERT_CONFIG = {
  enabled: process.env.ALERTS_ENABLED === 'true',
  channels: {
    console: true,
    email: process.env.ALERT_EMAIL_ENABLED === 'true',
    webhook: process.env.ALERT_WEBHOOK_ENABLED === 'true'
  },
  thresholds: {
    errorRate: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD) || 0.05, // 5% error rate
    responseTime: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD) || 1000, // 1 second
    connectionFailures: parseInt(process.env.ALERT_CONNECTION_FAILURES_THRESHOLD) || 3
  }
};

// Alert tracking
const alertState = {
  lastAlerts: new Map(), // Track last alert time per type to prevent spam
  alertCounts: new Map(), // Track alert counts per type
  errorCounts: {
    total: 0,
    byType: new Map()
  }
};

// Alert cooldown period (prevent duplicate alerts within this time)
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Send an alert
 * @param {string} type - Alert type
 * @param {string} severity - Alert severity (low, medium, high, critical)
 * @param {string} message - Alert message
 * @param {Object} details - Additional alert details
 */
async function sendAlert(type, severity, message, details = {}) {
  if (!ALERT_CONFIG.enabled) {
    return;
  }
  
  // Check cooldown to prevent alert spam
  const lastAlertTime = alertState.lastAlerts.get(type);
  const now = Date.now();
  
  if (lastAlertTime && (now - lastAlertTime) < ALERT_COOLDOWN_MS) {
    logger.debug('ALERTING', 'Alert suppressed due to cooldown', {
      type,
      lastAlertTime: new Date(lastAlertTime).toISOString(),
      cooldownRemaining: `${Math.round((ALERT_COOLDOWN_MS - (now - lastAlertTime)) / 1000)}s`
    });
    return;
  }
  
  // Update alert tracking
  alertState.lastAlerts.set(type, now);
  alertState.alertCounts.set(type, (alertState.alertCounts.get(type) || 0) + 1);
  
  const alert = {
    type,
    severity,
    message,
    details,
    timestamp: new Date().toISOString(),
    alertCount: alertState.alertCounts.get(type)
  };
  
  // Send to configured channels
  if (ALERT_CONFIG.channels.console) {
    await sendConsoleAlert(alert);
  }
  
  if (ALERT_CONFIG.channels.email) {
    await sendEmailAlert(alert);
  }
  
  if (ALERT_CONFIG.channels.webhook) {
    await sendWebhookAlert(alert);
  }
}

/**
 * Send alert to console
 * @param {Object} alert - Alert object
 */
async function sendConsoleAlert(alert) {
  const prefix = alert.severity === 'critical' ? '🚨' : 
                 alert.severity === 'high' ? '⚠️' : 
                 alert.severity === 'medium' ? '⚡' : 'ℹ️';
  
  logger.error('ALERT', `${prefix} ${alert.message}`, {
    type: alert.type,
    severity: alert.severity,
    alertCount: alert.alertCount,
    ...alert.details
  });
}

/**
 * Send alert via email
 * @param {Object} alert - Alert object
 */
async function sendEmailAlert(alert) {
  // TODO: Implement email alerting
  // This would integrate with an email service (SendGrid, AWS SES, etc.)
  logger.debug('ALERTING', 'Email alert would be sent', {
    type: alert.type,
    to: process.env.ALERT_EMAIL_TO
  });
}

/**
 * Send alert via webhook
 * @param {Object} alert - Alert object
 */
async function sendWebhookAlert(alert) {
  // TODO: Implement webhook alerting
  // This would send to Slack, Discord, PagerDuty, etc.
  logger.debug('ALERTING', 'Webhook alert would be sent', {
    type: alert.type,
    webhook: process.env.ALERT_WEBHOOK_URL
  });
}

/**
 * Alert on database connection failure
 * @param {Object} details - Failure details
 */
async function alertDatabaseConnectionFailure(details) {
  await sendAlert(
    'DATABASE_CONNECTION_FAILURE',
    'critical',
    'Database connection failure detected',
    {
      event: 'DB_CONNECTION_FAILURE',
      ...details
    }
  );
}

/**
 * Alert on cross-tenant access attempt
 * @param {Object} details - Access attempt details
 */
async function alertCrossTenantAccess(details) {
  await sendAlert(
    'CROSS_TENANT_ACCESS',
    'high',
    'Cross-tenant access attempt detected',
    {
      event: 'SECURITY_VIOLATION',
      ...details
    }
  );
}

/**
 * Alert on high error rate
 * @param {Object} details - Error rate details
 */
async function alertHighErrorRate(details) {
  await sendAlert(
    'HIGH_ERROR_RATE',
    'high',
    'High error rate detected',
    {
      event: 'HIGH_ERROR_RATE',
      threshold: ALERT_CONFIG.thresholds.errorRate,
      ...details
    }
  );
}

/**
 * Alert on performance degradation
 * @param {Object} details - Performance details
 */
async function alertPerformanceDegradation(details) {
  await sendAlert(
    'PERFORMANCE_DEGRADATION',
    'medium',
    'Performance degradation detected',
    {
      event: 'PERFORMANCE_ISSUE',
      threshold: ALERT_CONFIG.thresholds.responseTime,
      ...details
    }
  );
}

/**
 * Track error for error rate monitoring
 * @param {string} errorType - Type of error
 */
function trackError(errorType) {
  alertState.errorCounts.total++;
  alertState.errorCounts.byType.set(
    errorType,
    (alertState.errorCounts.byType.get(errorType) || 0) + 1
  );
}

/**
 * Check error rate and alert if threshold exceeded
 * @param {number} totalRequests - Total requests in period
 */
async function checkErrorRate(totalRequests) {
  if (totalRequests === 0) return;
  
  const errorRate = alertState.errorCounts.total / totalRequests;
  
  if (errorRate > ALERT_CONFIG.thresholds.errorRate) {
    await alertHighErrorRate({
      errorRate: (errorRate * 100).toFixed(2) + '%',
      totalErrors: alertState.errorCounts.total,
      totalRequests,
      errorsByType: Object.fromEntries(alertState.errorCounts.byType)
    });
  }
}

/**
 * Reset error tracking (call periodically, e.g., every hour)
 */
function resetErrorTracking() {
  alertState.errorCounts.total = 0;
  alertState.errorCounts.byType.clear();
}

/**
 * Get alert statistics
 * @returns {Object} Alert statistics
 */
function getAlertStats() {
  return {
    enabled: ALERT_CONFIG.enabled,
    channels: ALERT_CONFIG.channels,
    thresholds: ALERT_CONFIG.thresholds,
    alertCounts: Object.fromEntries(alertState.alertCounts),
    errorCounts: {
      total: alertState.errorCounts.total,
      byType: Object.fromEntries(alertState.errorCounts.byType)
    }
  };
}

module.exports = {
  sendAlert,
  alertDatabaseConnectionFailure,
  alertCrossTenantAccess,
  alertHighErrorRate,
  alertPerformanceDegradation,
  trackError,
  checkErrorRate,
  resetErrorTracking,
  getAlertStats
};
