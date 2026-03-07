const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '14d',
      zippedArchive: true
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      zippedArchive: true
    })
  ]
});

// Always log to console as well for Docker logs / pm2 logs
logger.add(new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  )
}));

// Add missing custom functions
logger.generateCorrelationId = () => require('crypto').randomBytes(8).toString('hex');

logger.logTenantValidationFailure = (type, context, correlationId) => {
  logger.error('TENANT_VALIDATION_FAILURE', { type, ...context, correlationId });
};

logger.logCrossTenantAccess = (context, correlationId) => {
  logger.error('CROSS_TENANT_ACCESS_ATTEMPT', { ...context, correlationId });
};

logger.logTenantContextInit = (tenant, correlationId) => {
  logger.info('TENANT_CONTEXT_INIT', { tenantId: tenant.id, slug: tenant.slug, correlationId });
};

module.exports = logger;
