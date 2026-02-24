const express = require('express');
const router = express.Router();
const { getHealthCheck, getMetrics, getPoolUtilization } = require('../config/db');

/**
 * Health Check Routes
 * 
 * Provides endpoints for monitoring database connectivity and metrics.
 * These endpoints do not require authentication or tenant resolution.
 */

/**
 * GET /health
 * Basic health check endpoint
 * Returns database connectivity status and response time
 */
router.get('/', async (req, res) => {
  try {
    const health = await getHealthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.status === 'healthy',
      ...health
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Failed to perform health check',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/metrics
 * Detailed metrics endpoint
 * Returns comprehensive database and query metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = getMetrics();
    
    res.status(200).json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/pool
 * Connection pool utilization endpoint
 * Returns pool statistics and recommendations
 */
router.get('/pool', async (req, res) => {
  try {
    const poolUtilization = getPoolUtilization();
    
    res.status(200).json({
      success: true,
      pool: poolUtilization,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pool utilization',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
