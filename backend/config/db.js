const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { alertDatabaseConnectionFailure } = require('../utils/alerting');

/**
 * Unified Nexus Architecture - Single Database Connection
 * 
 * This module manages the exclusive connection to the superkafe_v2 database.
 * All tenant data is stored in this single database with tenant isolation
 * handled at the application layer via tenantId field.
 * 
 * Legacy multi-database connection logic has been removed.
 */

// Connection retry configuration
const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

// Connection metrics
const metrics = {
  connectionAttempts: 0,
  connectionFailures: 0,
  lastConnectionTime: null,
  totalQueries: 0,
  queriesByTenant: new Map(), // Track queries per tenant
  slowQueries: [],
  connectionPoolStats: {
    active: 0,
    idle: 0,
    total: 0
  }
};

/**
 * Sleep utility for retry logic
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get connection pool configuration from environment variables
 * @returns {Object} Connection pool configuration
 */
const getPoolConfig = () => {
  return {
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '10', 10),
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || '2', 10),
    socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT_MS || '45000', 10),
    serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS || '5000', 10),
    heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT_FREQUENCY_MS || '10000', 10),
    maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME_MS || '60000', 10), // Close idle connections after 60s
    waitQueueTimeoutMS: parseInt(process.env.DB_WAIT_QUEUE_TIMEOUT_MS || '10000', 10) // Wait queue timeout
  };
};

/**
 * Connect to the unified superkafe_v2 database with retry logic
 * @returns {Promise<mongoose.Connection>} MongoDB connection
 * @throws {Error} If connection fails after all retries
 */
const connectMainDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/superkafe_v2';
  const poolConfig = getPoolConfig();
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    metrics.connectionAttempts++;
    
    try {
      const conn = await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        ...poolConfig
      });
      
      metrics.lastConnectionTime = new Date();
      
      logger.logDatabaseEvent('connected', {
        host: conn.connection.host,
        database: conn.connection.name,
        poolConfig: poolConfig,
        attempt,
        totalAttempts: metrics.connectionAttempts
      });
      
      // Setup connection event listeners for monitoring
      setupConnectionListeners(conn.connection);
      
      // Setup query monitoring
      setupQueryMonitoring();
      
      return conn;
    } catch (error) {
      metrics.connectionFailures++;
      
      logger.logDatabaseEvent('connection_failed', {
        attempt,
        maxRetries: MAX_RETRIES,
        error: error.message,
        totalFailures: metrics.connectionFailures
      });
      
      if (attempt === MAX_RETRIES) {
        logger.logDatabaseEvent('connection_fatal', {
          totalAttempts: metrics.connectionAttempts,
          totalFailures: metrics.connectionFailures,
          error: error.message
        });
        
        // Send alert for critical database connection failure
        await alertDatabaseConnectionFailure({
          attempts: metrics.connectionAttempts,
          failures: metrics.connectionFailures,
          error: error.message,
          uri: uri.replace(/\/\/.*@/, '//***@') // Mask credentials
        });
        
        process.exit(1);
      }
      
      // Exponential backoff
      const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
      logger.info('DATABASE', `Retrying in ${delay}ms...`, { attempt, delay });
      await sleep(delay);
    }
  }
};

/**
 * Setup connection event listeners for monitoring and error handling
 * @param {mongoose.Connection} connection - Mongoose connection instance
 */
const setupConnectionListeners = (connection) => {
  connection.on('connected', () => {
    logger.logDatabaseEvent('connected');
  });

  connection.on('error', async (err) => {
    logger.logDatabaseEvent('error', { error: err.message });
    
    // Alert on database errors
    await alertDatabaseConnectionFailure({
      event: 'connection_error',
      error: err.message
    });
  });

  connection.on('disconnected', () => {
    logger.logDatabaseEvent('disconnected');
  });

  connection.on('reconnected', () => {
    logger.logDatabaseEvent('reconnected');
  });

  connection.on('close', () => {
    logger.logDatabaseEvent('close');
  });
};

/**
 * Setup query monitoring for performance tracking
 */
const setupQueryMonitoring = () => {
  // Monitor slow queries (queries taking more than 100ms)
  const SLOW_QUERY_THRESHOLD = 100;
  
  mongoose.set('debug', (collectionName, method, query, doc, options) => {
    const startTime = Date.now();
    
    // Track query completion
    process.nextTick(() => {
      const duration = Date.now() - startTime;
      metrics.totalQueries++;
      
      // Track slow queries
      if (duration > SLOW_QUERY_THRESHOLD) {
        const slowQuery = {
          collection: collectionName,
          method,
          query,
          duration,
          timestamp: new Date()
        };
        
        metrics.slowQueries.push(slowQuery);
        
        // Keep only last 100 slow queries
        if (metrics.slowQueries.length > 100) {
          metrics.slowQueries.shift();
        }
        
        logger.warn('DATABASE', 'Slow query detected', {
          collection: collectionName,
          method,
          duration: `${duration}ms`,
          threshold: `${SLOW_QUERY_THRESHOLD}ms`,
          event: 'SLOW_QUERY'
        });
      }
    });
  });
};

/**
 * Track query for a specific tenant
 * @param {string} tenantId - Tenant ID
 * @param {number} duration - Query duration in ms
 */
const trackTenantQuery = (tenantId, duration) => {
  if (!metrics.queriesByTenant.has(tenantId)) {
    metrics.queriesByTenant.set(tenantId, {
      count: 0,
      totalDuration: 0,
      avgDuration: 0
    });
  }
  
  const tenantMetrics = metrics.queriesByTenant.get(tenantId);
  tenantMetrics.count++;
  tenantMetrics.totalDuration += duration;
  tenantMetrics.avgDuration = tenantMetrics.totalDuration / tenantMetrics.count;
};

/**
 * Update connection pool statistics
 */
const updatePoolStats = () => {
  const connection = mongoose.connection;
  
  if (connection && connection.readyState === 1) {
    // Get pool stats from MongoDB driver
    const client = connection.getClient();
    if (client && client.topology) {
      const servers = Array.from(client.topology.s.servers.values());
      
      if (servers.length > 0) {
        const server = servers[0];
        const pool = server.s.pool;
        
        if (pool) {
          metrics.connectionPoolStats = {
            active: pool.totalConnectionCount - pool.availableConnectionCount,
            idle: pool.availableConnectionCount,
            total: pool.totalConnectionCount,
            maxPoolSize: pool.options.maxPoolSize,
            minPoolSize: pool.options.minPoolSize
          };
        }
      }
    }
  }
};

/**
 * Get the active database connection
 * @returns {mongoose.Connection} Active connection instance
 * @throws {Error} If no connection is established
 */
const getConnection = () => {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    throw new Error('Database connection not established. Call connectMainDB() first.');
  }
  return mongoose.connection;
};

/**
 * Close database connection gracefully
 * @returns {Promise<void>}
 */
const closeConnection = async () => {
  try {
    await mongoose.connection.close();
    console.log('[DB] Database connection closed gracefully');
  } catch (error) {
    console.error('[DB ERROR] Failed to close database connection:', error.message);
    throw error;
  }
};

/**
 * Check if database connection is healthy
 * @returns {boolean} True if connection is active
 */
const isConnected = () => {
  return mongoose.connection && mongoose.connection.readyState === 1;
};

/**
 * Get connection status information
 * @returns {Object} Connection status details
 */
const getConnectionStatus = () => {
  const connection = mongoose.connection;
  
  return {
    isConnected: connection.readyState === 1,
    readyState: connection.readyState,
    readyStateText: getReadyStateText(connection.readyState),
    host: connection.host,
    port: connection.port,
    name: connection.name
  };
};

/**
 * Get database health check information
 * @returns {Promise<Object>} Health check details
 */
const getHealthCheck = async () => {
  const startTime = Date.now();
  
  try {
    // Update pool stats
    updatePoolStats();
    
    // Ping database to check connectivity
    await mongoose.connection.db.admin().ping();
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      database: {
        connected: true,
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        responseTime: `${responseTime}ms`
      },
      connectionPool: metrics.connectionPoolStats,
      metrics: {
        totalQueries: metrics.totalQueries,
        slowQueries: metrics.slowQueries.length,
        connectionAttempts: metrics.connectionAttempts,
        connectionFailures: metrics.connectionFailures,
        lastConnectionTime: metrics.lastConnectionTime
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      database: {
        connected: false,
        error: error.message
      },
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Get database metrics
 * @returns {Object} Database metrics
 */
const getMetrics = () => {
  updatePoolStats();
  
  return {
    connection: {
      attempts: metrics.connectionAttempts,
      failures: metrics.connectionFailures,
      lastConnectionTime: metrics.lastConnectionTime
    },
    queries: {
      total: metrics.totalQueries,
      slow: metrics.slowQueries.length,
      slowQueriesDetails: metrics.slowQueries.slice(-10) // Last 10 slow queries
    },
    connectionPool: metrics.connectionPoolStats,
    tenants: {
      count: metrics.queriesByTenant.size,
      topTenants: getTopTenantsByQueries(5)
    }
  };
};

/**
 * Get top tenants by query count
 * @param {number} limit - Number of top tenants to return
 * @returns {Array} Top tenants
 */
const getTopTenantsByQueries = (limit = 5) => {
  const tenants = Array.from(metrics.queriesByTenant.entries())
    .map(([tenantId, stats]) => ({
      tenantId,
      queryCount: stats.count,
      avgDuration: Math.round(stats.avgDuration * 100) / 100
    }))
    .sort((a, b) => b.queryCount - a.queryCount)
    .slice(0, limit);
  
  return tenants;
};

/**
 * Convert readyState number to text
 * @param {number} state - Connection ready state
 * @returns {string} Human-readable state
 */
const getReadyStateText = (state) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[state] || 'unknown';
};

/**
 * Get connection pool utilization and recommendations
 * @returns {Object} Pool utilization analysis
 */
const getPoolUtilization = () => {
  updatePoolStats();
  
  const stats = metrics.connectionPoolStats;
  const utilization = stats.total > 0 ? (stats.active / stats.maxPoolSize) * 100 : 0;
  
  let status = 'healthy';
  let recommendations = [];
  
  // Analyze pool utilization
  if (utilization > 90) {
    status = 'critical';
    recommendations.push('Pool utilization is very high (>90%). Consider increasing maxPoolSize.');
  } else if (utilization > 70) {
    status = 'warning';
    recommendations.push('Pool utilization is high (>70%). Monitor for potential bottlenecks.');
  }
  
  // Check if pool is underutilized
  if (utilization < 20 && stats.total > stats.minPoolSize) {
    recommendations.push('Pool utilization is low (<20%). Consider reducing maxPoolSize to save resources.');
  }
  
  // Check idle connections
  const idlePercentage = stats.total > 0 ? (stats.idle / stats.total) * 100 : 0;
  if (idlePercentage > 80) {
    recommendations.push('Many idle connections (>80%). Consider reducing maxPoolSize or decreasing maxIdleTimeMS.');
  }
  
  return {
    status,
    utilization: Math.round(utilization * 100) / 100,
    active: stats.active,
    idle: stats.idle,
    total: stats.total,
    maxPoolSize: stats.maxPoolSize,
    minPoolSize: stats.minPoolSize,
    idlePercentage: Math.round(idlePercentage * 100) / 100,
    recommendations,
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  connectMainDB,
  getConnection,
  closeConnection,
  isConnected,
  getConnectionStatus,
  getHealthCheck,
  getMetrics,
  trackTenantQuery,
  getPoolUtilization
};
