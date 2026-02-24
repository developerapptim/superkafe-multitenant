const request = require('supertest');
const express = require('express');
const healthRoutes = require('../../routes/healthRoutes');

/**
 * Integration Test for Health Check Endpoint
 * 
 * Feature: unified-nexus-architecture
 * Task: 12.2 Create health check endpoint
 * 
 * **Validates: Requirements 12.2**
 * 
 * These tests verify that the health check endpoint:
 * - Returns 200 for healthy status
 * - Returns 503 for unhealthy status
 * - Includes database connectivity information
 * - Includes response time measurement
 * - Includes connection pool metrics
 * - Includes timestamp in ISO format
 */

describe('Health Check Endpoint Integration', () => {
  let app;

  beforeAll(() => {
    // Create minimal Express app for testing
    app = express();
    app.use('/health', healthRoutes);
  });

  describe('GET /health', () => {
    /**
     * Test: Health endpoint returns proper structure
     * 
     * Verifies that the endpoint returns:
     * - Status field (healthy/unhealthy)
     * - Database connection information
     * - Response time
     * - Timestamp
     */
    test('should return health check with proper structure', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      // Should return either 200 (healthy) or 503 (unhealthy)
      expect([200, 503]).toContain(response.status);

      // Verify response structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('timestamp');

      // Verify status is valid
      expect(['healthy', 'unhealthy']).toContain(response.body.status);

      // Verify database info exists
      expect(response.body.database).toBeDefined();
      expect(response.body.database).toHaveProperty('connected');
    });

    /**
     * Test: Healthy status returns 200
     * 
     * Verifies that when database is connected, endpoint returns 200
     */
    test('should return 200 when database is healthy', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      // If database is healthy, should return 200
      if (response.body.status === 'healthy') {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.database.connected).toBe(true);
        expect(response.body.database).toHaveProperty('name');
        expect(response.body.database).toHaveProperty('responseTime');
      }
    });

    /**
     * Test: Unhealthy status returns 503
     * 
     * Verifies that when database is disconnected, endpoint returns 503
     */
    test('should return 503 when database is unhealthy', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      // If database is unhealthy, should return 503
      if (response.body.status === 'unhealthy') {
        expect(response.status).toBe(503);
        expect(response.body.success).toBe(false);
        expect(response.body.database.connected).toBe(false);
      }
    });

    /**
     * Test: Response includes database name
     * 
     * Verifies that healthy response includes database name (superkafe_v2)
     */
    test('should include database name when healthy', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      if (response.body.status === 'healthy') {
        expect(response.body.database).toHaveProperty('name');
        expect(response.body.database.name).toBe('superkafe_v2');
      }
    });

    /**
     * Test: Response includes response time
     * 
     * Verifies that response includes database ping response time
     */
    test('should include response time measurement', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      if (response.body.status === 'healthy') {
        expect(response.body.database).toHaveProperty('responseTime');
        expect(response.body.database.responseTime).toMatch(/^\d+ms$/);

        // Extract and verify response time is reasonable
        const responseTimeMs = parseInt(response.body.database.responseTime);
        expect(responseTimeMs).toBeGreaterThanOrEqual(0);
        expect(responseTimeMs).toBeLessThan(5000); // Should be under 5 seconds
      }
    });

    /**
     * Test: Response includes connection pool metrics
     * 
     * Verifies that response includes connection pool information
     */
    test('should include connection pool metrics', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      if (response.body.status === 'healthy') {
        expect(response.body).toHaveProperty('connectionPool');
        
        const pool = response.body.connectionPool;
        expect(pool).toHaveProperty('active');
        expect(pool).toHaveProperty('idle');
        expect(pool).toHaveProperty('total');
        expect(pool).toHaveProperty('maxPoolSize');
        expect(pool).toHaveProperty('minPoolSize');

        // Verify pool metrics are numbers
        expect(typeof pool.active).toBe('number');
        expect(typeof pool.idle).toBe('number');
        expect(typeof pool.total).toBe('number');
        expect(typeof pool.maxPoolSize).toBe('number');
        expect(typeof pool.minPoolSize).toBe('number');
      }
    });

    /**
     * Test: Response includes timestamp
     * 
     * Verifies that response includes ISO timestamp
     */
    test('should include ISO timestamp', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('timestamp');
      
      // Verify timestamp is valid ISO format
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Verify timestamp is recent (within last 5 seconds)
      const now = Date.now();
      const timestampMs = timestamp.getTime();
      expect(now - timestampMs).toBeLessThan(5000);
    });

    /**
     * Test: Response includes query metrics
     * 
     * Verifies that response includes query performance metrics
     */
    test('should include query metrics summary', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      if (response.body.status === 'healthy') {
        expect(response.body).toHaveProperty('metrics');
        
        const metrics = response.body.metrics;
        expect(metrics).toHaveProperty('totalQueries');
        expect(metrics).toHaveProperty('slowQueries');
        expect(metrics).toHaveProperty('connectionAttempts');
        expect(metrics).toHaveProperty('connectionFailures');

        // Verify metrics are numbers
        expect(typeof metrics.totalQueries).toBe('number');
        expect(typeof metrics.slowQueries).toBe('number');
        expect(typeof metrics.connectionAttempts).toBe('number');
        expect(typeof metrics.connectionFailures).toBe('number');
      }
    });
  });

  describe('GET /health/metrics', () => {
    /**
     * Test: Metrics endpoint returns detailed information
     * 
     * Verifies that the metrics endpoint returns comprehensive metrics
     */
    test('should return detailed metrics', async () => {
      const response = await request(app)
        .get('/health/metrics')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('timestamp');

      // Verify metrics structure
      const metrics = response.body.metrics;
      expect(metrics).toHaveProperty('connection');
      expect(metrics).toHaveProperty('queries');
      expect(metrics).toHaveProperty('connectionPool');
      expect(metrics).toHaveProperty('tenants');
    });
  });
});
