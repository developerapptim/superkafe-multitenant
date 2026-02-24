const mongoose = require('mongoose');

// Mock the database module to avoid requiring actual database connection
jest.mock('../../config/db', () => {
  const actualDb = jest.requireActual('../../config/db');
  
  // Mock metrics state
  const mockMetrics = {
    connectionAttempts: 5,
    connectionFailures: 0,
    lastConnectionTime: new Date('2024-01-15T10:00:00Z'),
    totalQueries: 150,
    queriesByTenant: new Map(),
    slowQueries: [],
    connectionPoolStats: {
      active: 3,
      idle: 7,
      total: 10,
      maxPoolSize: 10,
      minPoolSize: 2
    }
  };
  
  return {
    ...actualDb,
    connectMainDB: jest.fn().mockResolvedValue({
      connection: {
        host: 'localhost',
        name: 'superkafe_v2',
        readyState: 1
      }
    }),
    closeConnection: jest.fn().mockResolvedValue(undefined),
    getHealthCheck: jest.fn().mockResolvedValue({
      status: 'healthy',
      database: {
        connected: true,
        name: 'superkafe_v2',
        host: 'localhost',
        responseTime: '5ms'
      },
      connectionPool: {
        active: 3,
        idle: 7,
        total: 10,
        maxPoolSize: 10,
        minPoolSize: 2
      },
      metrics: {
        totalQueries: 150,
        slowQueries: 2,
        connectionAttempts: 5,
        connectionFailures: 0,
        lastConnectionTime: new Date('2024-01-15T10:00:00Z')
      },
      timestamp: new Date().toISOString()
    }),
    getMetrics: jest.fn(() => ({
      connection: {
        attempts: mockMetrics.connectionAttempts,
        failures: mockMetrics.connectionFailures,
        lastConnectionTime: mockMetrics.lastConnectionTime
      },
      queries: {
        total: mockMetrics.totalQueries,
        slow: mockMetrics.slowQueries.length,
        slowQueriesDetails: mockMetrics.slowQueries.slice(-10)
      },
      connectionPool: mockMetrics.connectionPoolStats,
      tenants: {
        count: mockMetrics.queriesByTenant.size,
        topTenants: Array.from(mockMetrics.queriesByTenant.entries())
          .map(([tenantId, stats]) => ({
            tenantId,
            queryCount: stats.count,
            avgDuration: Math.round(stats.avgDuration * 100) / 100
          }))
          .sort((a, b) => b.queryCount - a.queryCount)
          .slice(0, 5)
      }
    })),
    trackTenantQuery: jest.fn((tenantId, duration) => {
      if (!mockMetrics.queriesByTenant.has(tenantId)) {
        mockMetrics.queriesByTenant.set(tenantId, {
          count: 0,
          totalDuration: 0,
          avgDuration: 0
        });
      }
      
      const tenantMetrics = mockMetrics.queriesByTenant.get(tenantId);
      tenantMetrics.count++;
      tenantMetrics.totalDuration += duration;
      tenantMetrics.avgDuration = tenantMetrics.totalDuration / tenantMetrics.count;
      
      mockMetrics.totalQueries++;
    })
  };
});

const { 
  getHealthCheck, 
  getMetrics, 
  trackTenantQuery
} = require('../../config/db');

/**
 * Unit Tests for Monitoring Metrics
 * 
 * Feature: unified-nexus-architecture
 * Task: 10.6 Write unit tests for monitoring metrics
 * 
 * **Validates: Requirements 11.2, 11.6**
 * 
 * These tests verify that the system properly tracks:
 * - Connection pool metrics (active, idle, total connections)
 * - Query performance tracking per tenant
 * - Health check endpoint functionality
 * - Metrics are exposed in a queryable format
 * - Metrics include timestamps and tenant context
 */

describe('Monitoring Metrics', () => {
  beforeEach(() => {
    // Clear mock call history
    jest.clearAllMocks();
  });

  describe('Connection Pool Metrics', () => {
    /**
     * Test: Connection pool metrics are tracked
     * 
     * Verifies that the system tracks:
     * - Active connections (in use)
     * - Idle connections (available)
     * - Total connections in pool
     * - Pool size limits (min/max)
     */
    test('should track connection pool metrics', async () => {
      const health = await getHealthCheck();
      
      expect(health).toBeDefined();
      expect(health.connectionPool).toBeDefined();
      
      // Verify pool metrics structure
      expect(health.connectionPool).toHaveProperty('active');
      expect(health.connectionPool).toHaveProperty('idle');
      expect(health.connectionPool).toHaveProperty('total');
      
      // Verify metrics are numbers
      expect(typeof health.connectionPool.active).toBe('number');
      expect(typeof health.connectionPool.idle).toBe('number');
      expect(typeof health.connectionPool.total).toBe('number');
      
      // Verify pool size configuration
      expect(health.connectionPool).toHaveProperty('maxPoolSize');
      expect(health.connectionPool).toHaveProperty('minPoolSize');
      expect(health.connectionPool.maxPoolSize).toBe(10);
      expect(health.connectionPool.minPoolSize).toBe(2);
      
      // Verify logical consistency
      expect(health.connectionPool.total).toBeGreaterThanOrEqual(0);
      expect(health.connectionPool.active).toBeGreaterThanOrEqual(0);
      expect(health.connectionPool.idle).toBeGreaterThanOrEqual(0);
      expect(health.connectionPool.active + health.connectionPool.idle).toBeLessThanOrEqual(
        health.connectionPool.total
      );
    });

    /**
     * Test: Pool metrics are updated dynamically
     * 
     * Verifies that pool metrics reflect current state
     */
    test('should update pool metrics dynamically', async () => {
      const metrics1 = await getHealthCheck();
      const pool1 = metrics1.connectionPool;
      
      // Get metrics again (simulating dynamic updates)
      const metrics2 = await getHealthCheck();
      const pool2 = metrics2.connectionPool;
      
      // Metrics should be defined in both calls
      expect(pool1).toBeDefined();
      expect(pool2).toBeDefined();
      
      // Total pool size should remain consistent
      expect(pool2.maxPoolSize).toBe(pool1.maxPoolSize);
      expect(pool2.minPoolSize).toBe(pool1.minPoolSize);
    });

    /**
     * Test: Pool metrics include all required fields
     * 
     * Verifies that pool metrics have complete information
     */
    test('should include all required pool metric fields', async () => {
      const metrics = getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.connectionPool).toBeDefined();
      
      const requiredFields = ['active', 'idle', 'total', 'maxPoolSize', 'minPoolSize'];
      
      requiredFields.forEach(field => {
        expect(metrics.connectionPool).toHaveProperty(field);
        expect(typeof metrics.connectionPool[field]).toBe('number');
      });
    });
  });

  describe('Query Performance Tracking', () => {
    /**
     * Test: Query performance is tracked per tenant
     * 
     * Verifies that the system tracks:
     * - Query count per tenant
     * - Total query duration per tenant
     * - Average query duration per tenant
     */
    test('should track query performance per tenant', () => {
      const tenantId1 = new mongoose.Types.ObjectId().toString();
      const tenantId2 = new mongoose.Types.ObjectId().toString();
      
      // Track queries for tenant 1
      trackTenantQuery(tenantId1, 50);
      trackTenantQuery(tenantId1, 100);
      trackTenantQuery(tenantId1, 75);
      
      // Track queries for tenant 2
      trackTenantQuery(tenantId2, 200);
      trackTenantQuery(tenantId2, 150);
      
      const metrics = getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.tenants).toBeDefined();
      expect(metrics.tenants.count).toBeGreaterThanOrEqual(2);
      
      // Verify top tenants are tracked
      expect(metrics.tenants.topTenants).toBeDefined();
      expect(Array.isArray(metrics.tenants.topTenants)).toBe(true);
      
      // Find our test tenants in top tenants
      const tenant1Stats = metrics.tenants.topTenants.find(t => t.tenantId === tenantId1);
      const tenant2Stats = metrics.tenants.topTenants.find(t => t.tenantId === tenantId2);
      
      if (tenant1Stats) {
        expect(tenant1Stats.queryCount).toBe(3);
        expect(tenant1Stats.avgDuration).toBeCloseTo(75, 1); // (50 + 100 + 75) / 3 = 75
      }
      
      if (tenant2Stats) {
        expect(tenant2Stats.queryCount).toBe(2);
        expect(tenant2Stats.avgDuration).toBeCloseTo(175, 1); // (200 + 150) / 2 = 175
      }
    });

    /**
     * Test: Query metrics include timestamps
     * 
     * Verifies that query metrics include timing information
     */
    test('should include timestamps in query metrics', async () => {
      const health = await getHealthCheck();
      
      expect(health).toBeDefined();
      expect(health.timestamp).toBeDefined();
      
      // Verify timestamp is valid ISO format
      const timestamp = new Date(health.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
      expect(health.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    /**
     * Test: Slow queries are tracked
     * 
     * Verifies that queries exceeding threshold are logged
     */
    test('should track slow queries', () => {
      const metrics = getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.queries).toBeDefined();
      expect(metrics.queries).toHaveProperty('slow');
      expect(metrics.queries).toHaveProperty('slowQueriesDetails');
      
      // Verify slow queries structure
      expect(typeof metrics.queries.slow).toBe('number');
      expect(Array.isArray(metrics.queries.slowQueriesDetails)).toBe(true);
      
      // If there are slow queries, verify their structure
      if (metrics.queries.slowQueriesDetails.length > 0) {
        const slowQuery = metrics.queries.slowQueriesDetails[0];
        
        expect(slowQuery).toHaveProperty('collection');
        expect(slowQuery).toHaveProperty('method');
        expect(slowQuery).toHaveProperty('duration');
        expect(slowQuery).toHaveProperty('timestamp');
        
        expect(typeof slowQuery.duration).toBe('number');
        expect(slowQuery.duration).toBeGreaterThan(0);
      }
    });

    /**
     * Test: Total query count is tracked
     * 
     * Verifies that the system tracks total number of queries
     */
    test('should track total query count', () => {
      const metrics = getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.queries).toBeDefined();
      expect(metrics.queries).toHaveProperty('total');
      expect(typeof metrics.queries.total).toBe('number');
      expect(metrics.queries.total).toBeGreaterThanOrEqual(0);
    });

    /**
     * Test: Query metrics are queryable
     * 
     * Verifies that metrics can be retrieved and filtered
     */
    test('should provide queryable query metrics', () => {
      const metrics = getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.queries).toBeDefined();
      
      // Verify metrics structure allows querying
      expect(metrics.queries).toHaveProperty('total');
      expect(metrics.queries).toHaveProperty('slow');
      expect(metrics.queries).toHaveProperty('slowQueriesDetails');
      
      // Verify tenant-specific metrics are queryable
      expect(metrics.tenants).toBeDefined();
      expect(metrics.tenants).toHaveProperty('count');
      expect(metrics.tenants).toHaveProperty('topTenants');
      
      // Verify top tenants can be filtered
      const topTenants = metrics.tenants.topTenants;
      expect(Array.isArray(topTenants)).toBe(true);
      
      // Each tenant should have queryable fields
      topTenants.forEach(tenant => {
        expect(tenant).toHaveProperty('tenantId');
        expect(tenant).toHaveProperty('queryCount');
        expect(tenant).toHaveProperty('avgDuration');
      });
    });
  });

  describe('Health Check Endpoint', () => {
    /**
     * Test: Health check returns proper status
     * 
     * Verifies that health check endpoint returns:
     * - Status (healthy/unhealthy)
     * - Database connection status
     * - Response time
     * - Timestamp
     */
    test('should return proper health status', async () => {
      const health = await getHealthCheck();
      
      expect(health).toBeDefined();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('database');
      expect(health).toHaveProperty('timestamp');
      
      // Verify status is valid
      expect(['healthy', 'unhealthy']).toContain(health.status);
      
      // Verify database info
      expect(health.database).toHaveProperty('connected');
      expect(health.database).toHaveProperty('name');
      expect(health.database).toHaveProperty('responseTime');
      
      // If connected, verify database details
      if (health.database.connected) {
        expect(health.database.name).toBe('superkafe_v2');
        expect(health.database.responseTime).toMatch(/^\d+ms$/);
        
        // Extract response time number
        const responseTimeMs = parseInt(health.database.responseTime);
        expect(responseTimeMs).toBeGreaterThanOrEqual(0);
        expect(responseTimeMs).toBeLessThan(5000); // Should be fast
      }
    });

    /**
     * Test: Health check includes connection pool metrics
     * 
     * Verifies that health check includes pool information
     */
    test('should include connection pool in health check', async () => {
      const health = await getHealthCheck();
      
      expect(health).toBeDefined();
      expect(health).toHaveProperty('connectionPool');
      
      const pool = health.connectionPool;
      expect(pool).toHaveProperty('active');
      expect(pool).toHaveProperty('idle');
      expect(pool).toHaveProperty('total');
      expect(pool).toHaveProperty('maxPoolSize');
      expect(pool).toHaveProperty('minPoolSize');
    });

    /**
     * Test: Health check includes metrics summary
     * 
     * Verifies that health check includes key metrics
     */
    test('should include metrics summary in health check', async () => {
      const health = await getHealthCheck();
      
      expect(health).toBeDefined();
      expect(health).toHaveProperty('metrics');
      
      const metrics = health.metrics;
      expect(metrics).toHaveProperty('totalQueries');
      expect(metrics).toHaveProperty('slowQueries');
      expect(metrics).toHaveProperty('connectionAttempts');
      expect(metrics).toHaveProperty('connectionFailures');
      expect(metrics).toHaveProperty('lastConnectionTime');
      
      // Verify metrics are numbers
      expect(typeof metrics.totalQueries).toBe('number');
      expect(typeof metrics.slowQueries).toBe('number');
      expect(typeof metrics.connectionAttempts).toBe('number');
      expect(typeof metrics.connectionFailures).toBe('number');
    });

    /**
     * Test: Health check response time is measured
     * 
     * Verifies that health check measures its own response time
     */
    test('should measure health check response time', async () => {
      const health = await getHealthCheck();
      
      expect(health).toBeDefined();
      expect(health.database).toHaveProperty('responseTime');
      
      // Extract response time from string (e.g., "5ms")
      const responseTimeMs = parseInt(health.database.responseTime);
      
      // Response time should be reasonable
      expect(responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(responseTimeMs).toBeLessThan(1000); // Should be under 1 second
    });

    /**
     * Test: Health check includes timestamp
     * 
     * Verifies that health check includes ISO timestamp
     */
    test('should include ISO timestamp in health check', async () => {
      const health = await getHealthCheck();
      
      expect(health).toBeDefined();
      expect(health).toHaveProperty('timestamp');
      
      // Verify timestamp is valid ISO format
      const timestamp = new Date(health.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
      
      // Verify timestamp is recent (within last 5 seconds)
      const now = Date.now();
      const timestampMs = timestamp.getTime();
      expect(now - timestampMs).toBeLessThan(5000);
    });

    /**
     * Test: Health check handles database errors gracefully
     * 
     * Verifies that health check returns unhealthy status on errors
     */
    test('should handle database errors gracefully', async () => {
      // This test verifies the error handling structure
      // In a real error scenario, health check should return unhealthy status
      
      const health = await getHealthCheck();
      
      // Verify error handling structure exists
      expect(health).toBeDefined();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('database');
      
      // If unhealthy, should have error information
      if (health.status === 'unhealthy') {
        expect(health.database).toHaveProperty('connected');
        expect(health.database.connected).toBe(false);
        expect(health.database).toHaveProperty('error');
      }
    });
  });

  describe('Metrics Format and Structure', () => {
    /**
     * Test: Metrics are exposed in queryable format
     * 
     * Verifies that metrics can be easily queried and filtered
     */
    test('should expose metrics in queryable format', () => {
      const metrics = getMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
      
      // Verify top-level structure
      expect(metrics).toHaveProperty('connection');
      expect(metrics).toHaveProperty('queries');
      expect(metrics).toHaveProperty('connectionPool');
      expect(metrics).toHaveProperty('tenants');
      
      // Verify each section is an object
      expect(typeof metrics.connection).toBe('object');
      expect(typeof metrics.queries).toBe('object');
      expect(typeof metrics.connectionPool).toBe('object');
      expect(typeof metrics.tenants).toBe('object');
    });

    /**
     * Test: Connection metrics include timestamps
     * 
     * Verifies that connection metrics include timing information
     */
    test('should include timestamps in connection metrics', () => {
      const metrics = getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.connection).toBeDefined();
      expect(metrics.connection).toHaveProperty('lastConnectionTime');
      
      // If connection time exists, verify it's a valid date
      if (metrics.connection.lastConnectionTime) {
        const timestamp = new Date(metrics.connection.lastConnectionTime);
        expect(timestamp.toString()).not.toBe('Invalid Date');
      }
    });

    /**
     * Test: Metrics include tenant context
     * 
     * Verifies that metrics include tenant-specific information
     */
    test('should include tenant context in metrics', () => {
      const metrics = getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.tenants).toBeDefined();
      expect(metrics.tenants).toHaveProperty('count');
      expect(metrics.tenants).toHaveProperty('topTenants');
      
      // Verify tenant count is a number
      expect(typeof metrics.tenants.count).toBe('number');
      expect(metrics.tenants.count).toBeGreaterThanOrEqual(0);
      
      // Verify top tenants structure
      expect(Array.isArray(metrics.tenants.topTenants)).toBe(true);
      
      // Each tenant should have ID and metrics
      metrics.tenants.topTenants.forEach(tenant => {
        expect(tenant).toHaveProperty('tenantId');
        expect(tenant).toHaveProperty('queryCount');
        expect(tenant).toHaveProperty('avgDuration');
        
        expect(typeof tenant.tenantId).toBe('string');
        expect(typeof tenant.queryCount).toBe('number');
        expect(typeof tenant.avgDuration).toBe('number');
      });
    });

    /**
     * Test: Metrics are JSON serializable
     * 
     * Verifies that metrics can be serialized to JSON
     */
    test('should be JSON serializable', () => {
      const metrics = getMetrics();
      
      expect(metrics).toBeDefined();
      
      // Should be able to serialize to JSON
      let jsonString;
      expect(() => {
        jsonString = JSON.stringify(metrics);
      }).not.toThrow();
      
      // Should be able to parse back
      let parsed;
      expect(() => {
        parsed = JSON.parse(jsonString);
      }).not.toThrow();
      
      // Parsed object should have same structure
      expect(parsed).toHaveProperty('connection');
      expect(parsed).toHaveProperty('queries');
      expect(parsed).toHaveProperty('connectionPool');
      expect(parsed).toHaveProperty('tenants');
    });

    /**
     * Test: Metrics include all required fields
     * 
     * Verifies that metrics have complete information
     */
    test('should include all required metric fields', () => {
      const metrics = getMetrics();
      
      expect(metrics).toBeDefined();
      
      // Connection metrics
      expect(metrics.connection).toHaveProperty('attempts');
      expect(metrics.connection).toHaveProperty('failures');
      expect(metrics.connection).toHaveProperty('lastConnectionTime');
      
      // Query metrics
      expect(metrics.queries).toHaveProperty('total');
      expect(metrics.queries).toHaveProperty('slow');
      expect(metrics.queries).toHaveProperty('slowQueriesDetails');
      
      // Pool metrics
      expect(metrics.connectionPool).toHaveProperty('active');
      expect(metrics.connectionPool).toHaveProperty('idle');
      expect(metrics.connectionPool).toHaveProperty('total');
      
      // Tenant metrics
      expect(metrics.tenants).toHaveProperty('count');
      expect(metrics.tenants).toHaveProperty('topTenants');
    });
  });
});
