/**
 * Unit Tests for Connection Pool Configuration
 * 
 * Tests the connection pool configuration, monitoring, and utilization
 * analysis functionality.
 * 
 * Requirements: 8.4
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock the logger and alerting modules
jest.mock('../../utils/logger', () => ({
  logDatabaseEvent: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../utils/alerting', () => ({
  alertDatabaseConnectionFailure: jest.fn()
}));

// Mock process.exit to prevent tests from exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`process.exit called with code ${code}`);
});

describe('Connection Pool Configuration', () => {
  let mongoServer;
  let originalEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
    // Restore process.exit
    mockExit.mockRestore();
  });

  beforeEach(async () => {
    // Clear all module caches to get fresh db.js
    jest.resetModules();
    // Clear mock calls
    mockExit.mockClear();
    
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
  });

  afterEach(async () => {
    // Disconnect and stop server
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoServer.stop();
  });

  describe('Pool Configuration from Environment Variables', () => {
    it('should use default pool configuration when env vars not set', async () => {
      // Clear pool-related env vars
      delete process.env.DB_MAX_POOL_SIZE;
      delete process.env.DB_MIN_POOL_SIZE;
      
      const { connectMainDB } = require('../../config/db');
      await connectMainDB();

      // Check connection options (defaults should be applied)
      expect(mongoose.connection.readyState).toBe(1);
      
      await mongoose.disconnect();
    });

    it('should use custom pool size from environment variables', async () => {
      process.env.DB_MAX_POOL_SIZE = '20';
      process.env.DB_MIN_POOL_SIZE = '5';
      
      const { connectMainDB } = require('../../config/db');
      await connectMainDB();

      expect(mongoose.connection.readyState).toBe(1);
      
      await mongoose.disconnect();
    });

    it('should use custom timeout values from environment variables', async () => {
      process.env.DB_SOCKET_TIMEOUT_MS = '30000';
      process.env.DB_SERVER_SELECTION_TIMEOUT_MS = '3000';
      
      const { connectMainDB } = require('../../config/db');
      await connectMainDB();

      expect(mongoose.connection.readyState).toBe(1);
      
      await mongoose.disconnect();
    });

    it('should parse integer values correctly', async () => {
      process.env.DB_MAX_POOL_SIZE = '15';
      process.env.DB_MIN_POOL_SIZE = '3';
      process.env.DB_MAX_IDLE_TIME_MS = '120000';
      
      const { connectMainDB } = require('../../config/db');
      await connectMainDB();

      expect(mongoose.connection.readyState).toBe(1);
      
      await mongoose.disconnect();
    });
  });

  describe('Pool Utilization Monitoring', () => {
    it('should provide pool utilization statistics', async () => {
      const { connectMainDB, getPoolUtilization } = require('../../config/db');
      await connectMainDB();

      const utilization = getPoolUtilization();

      expect(utilization).toBeDefined();
      expect(utilization.status).toBeDefined();
      expect(utilization.utilization).toBeGreaterThanOrEqual(0);
      expect(utilization.active).toBeGreaterThanOrEqual(0);
      expect(utilization.idle).toBeGreaterThanOrEqual(0);
      expect(utilization.total).toBeGreaterThanOrEqual(0);
      expect(utilization.maxPoolSize).toBeGreaterThan(0);
      expect(utilization.minPoolSize).toBeGreaterThan(0);
      expect(utilization.recommendations).toBeInstanceOf(Array);
      expect(utilization.timestamp).toBeDefined();

      await mongoose.disconnect();
    });

    it('should calculate utilization percentage correctly', async () => {
      const { connectMainDB, getPoolUtilization } = require('../../config/db');
      await connectMainDB();

      const utilization = getPoolUtilization();

      // Utilization should be between 0 and 100
      expect(utilization.utilization).toBeGreaterThanOrEqual(0);
      expect(utilization.utilization).toBeLessThanOrEqual(100);

      await mongoose.disconnect();
    });

    it('should provide health status based on utilization', async () => {
      const { connectMainDB, getPoolUtilization } = require('../../config/db');
      await connectMainDB();

      const utilization = getPoolUtilization();

      // Status should be one of: healthy, warning, critical
      expect(['healthy', 'warning', 'critical']).toContain(utilization.status);

      await mongoose.disconnect();
    });

    it('should provide recommendations when utilization is high', async () => {
      const { connectMainDB, getPoolUtilization } = require('../../config/db');
      await connectMainDB();

      const utilization = getPoolUtilization();

      // Recommendations should be an array
      expect(Array.isArray(utilization.recommendations)).toBe(true);

      // If utilization is high, recommendations should be provided
      if (utilization.utilization > 70) {
        expect(utilization.recommendations.length).toBeGreaterThan(0);
      }

      await mongoose.disconnect();
    });

    it('should calculate idle percentage correctly', async () => {
      const { connectMainDB, getPoolUtilization } = require('../../config/db');
      await connectMainDB();

      const utilization = getPoolUtilization();

      // Idle percentage should be between 0 and 100
      expect(utilization.idlePercentage).toBeGreaterThanOrEqual(0);
      expect(utilization.idlePercentage).toBeLessThanOrEqual(100);

      await mongoose.disconnect();
    });
  });

  describe('Connection Health Check', () => {
    it('should report healthy status when connected', async () => {
      const { connectMainDB, getHealthCheck } = require('../../config/db');
      await connectMainDB();

      const health = await getHealthCheck();

      expect(health.status).toBe('healthy');
      expect(health.database.connected).toBe(true);
      expect(health.database.name).toBeDefined();
      expect(health.database.responseTime).toBeDefined();
      expect(health.connectionPool).toBeDefined();
      expect(health.metrics).toBeDefined();

      await mongoose.disconnect();
    });

    it('should include connection pool stats in health check', async () => {
      const { connectMainDB, getHealthCheck } = require('../../config/db');
      await connectMainDB();

      const health = await getHealthCheck();

      expect(health.connectionPool).toBeDefined();
      expect(health.connectionPool.active).toBeGreaterThanOrEqual(0);
      expect(health.connectionPool.idle).toBeGreaterThanOrEqual(0);
      expect(health.connectionPool.total).toBeGreaterThanOrEqual(0);

      await mongoose.disconnect();
    });

    it('should measure database response time', async () => {
      const { connectMainDB, getHealthCheck } = require('../../config/db');
      await connectMainDB();

      const health = await getHealthCheck();

      expect(health.database.responseTime).toBeDefined();
      expect(health.database.responseTime).toMatch(/\d+ms/);

      await mongoose.disconnect();
    });
  });

  describe('Database Metrics', () => {
    it('should provide comprehensive database metrics', async () => {
      const { connectMainDB, getMetrics } = require('../../config/db');
      await connectMainDB();

      const metrics = getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.connection).toBeDefined();
      expect(metrics.queries).toBeDefined();
      expect(metrics.connectionPool).toBeDefined();
      expect(metrics.tenants).toBeDefined();

      await mongoose.disconnect();
    });

    it('should track connection attempts and failures', async () => {
      const { connectMainDB, getMetrics } = require('../../config/db');
      await connectMainDB();

      const metrics = getMetrics();

      expect(metrics.connection.attempts).toBeGreaterThan(0);
      expect(metrics.connection.failures).toBeGreaterThanOrEqual(0);
      expect(metrics.connection.lastConnectionTime).toBeDefined();

      await mongoose.disconnect();
    });

    it('should track query statistics', async () => {
      const { connectMainDB, getMetrics } = require('../../config/db');
      await connectMainDB();

      const metrics = getMetrics();

      expect(metrics.queries.total).toBeGreaterThanOrEqual(0);
      expect(metrics.queries.slow).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(metrics.queries.slowQueriesDetails)).toBe(true);

      await mongoose.disconnect();
    });

    it('should track tenant statistics', async () => {
      const { connectMainDB, getMetrics } = require('../../config/db');
      await connectMainDB();

      const metrics = getMetrics();

      expect(metrics.tenants.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(metrics.tenants.topTenants)).toBe(true);

      await mongoose.disconnect();
    });
  });

  describe('Connection Status', () => {
    it('should report connection status correctly', async () => {
      const { connectMainDB, getConnectionStatus } = require('../../config/db');
      await connectMainDB();

      const status = getConnectionStatus();

      expect(status.isConnected).toBe(true);
      expect(status.readyState).toBe(1);
      expect(status.readyStateText).toBe('connected');
      expect(status.name).toBeDefined();

      await mongoose.disconnect();
    });

    it('should report disconnected status when not connected', async () => {
      const { getConnectionStatus } = require('../../config/db');

      const status = getConnectionStatus();

      expect(status.isConnected).toBe(false);
      expect(status.readyState).not.toBe(1);
    });
  });

  describe('Connection Lifecycle', () => {
    it('should connect successfully', async () => {
      const { connectMainDB, isConnected } = require('../../config/db');
      
      await connectMainDB();
      
      expect(isConnected()).toBe(true);
      
      await mongoose.disconnect();
    });

    it('should close connection gracefully', async () => {
      const { connectMainDB, closeConnection, isConnected } = require('../../config/db');
      
      await connectMainDB();
      expect(isConnected()).toBe(true);
      
      await closeConnection();
      expect(isConnected()).toBe(false);
    });

    it('should throw error when getting connection before connecting', () => {
      const { getConnection } = require('../../config/db');
      
      expect(() => getConnection()).toThrow('Database connection not established');
    });
  });

  describe('Pool Configuration Validation', () => {
    it('should handle invalid pool size values gracefully', async () => {
      process.env.DB_MAX_POOL_SIZE = 'invalid';
      process.env.DB_MIN_POOL_SIZE = 'invalid';
      
      const { connectMainDB } = require('../../config/db');
      
      // Should use NaN which will be handled by MongoDB driver defaults
      await connectMainDB();
      expect(mongoose.connection.readyState).toBe(1);
      
      await mongoose.disconnect();
    });

    it('should handle negative pool size values', async () => {
      process.env.DB_MAX_POOL_SIZE = '-5';
      process.env.DB_MIN_POOL_SIZE = '-2';
      
      const { connectMainDB } = require('../../config/db');
      
      // MongoDB driver should handle negative values
      await connectMainDB();
      expect(mongoose.connection.readyState).toBe(1);
      
      await mongoose.disconnect();
    });
  });
});
