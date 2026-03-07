const logger = require('../utils/logger');
const { performance } = require('perf_hooks');

const slowQueryLogger = (req, res, next) => {
    const start = performance.now();

    res.on('finish', () => {
        const duration = performance.now() - start;
        if (duration > 2000) { // Log queries that take > 2000 ms
            logger.warn(`[SLOW REQUEST] ${req.method} ${req.originalUrl} took ${duration.toFixed(2)}ms`, {
                method: req.method,
                path: req.originalUrl,
                duration: duration.toFixed(2),
                ip: req.ip,
                tenant: req.tenant?.slug || 'unknown'
            });
        }
    });

    next();
};

module.exports = slowQueryLogger;
