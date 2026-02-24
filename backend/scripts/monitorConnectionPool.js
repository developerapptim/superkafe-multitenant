/**
 * Connection Pool Monitoring Script
 * 
 * This script monitors connection pool utilization and provides
 * recommendations for optimal configuration.
 * 
 * Requirements: 8.4
 */

const { connectMainDB, getPoolUtilization, getMetrics } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Monitor connection pool for a specified duration
 * @param {number} durationSeconds - Duration to monitor in seconds
 * @param {number} intervalSeconds - Sampling interval in seconds
 */
async function monitorConnectionPool(durationSeconds = 60, intervalSeconds = 5) {
  console.log('🔍 Connection Pool Monitoring\n');
  console.log('=' .repeat(60));
  
  try {
    // Connect to database
    await connectMainDB();
    console.log('✅ Connected to database\n');
    
    const samples = [];
    const startTime = Date.now();
    const endTime = startTime + (durationSeconds * 1000);
    
    console.log(`📊 Monitoring for ${durationSeconds} seconds (sampling every ${intervalSeconds}s)...\n`);
    
    // Monitoring loop
    while (Date.now() < endTime) {
      const utilization = getPoolUtilization();
      samples.push(utilization);
      
      // Display current status
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[${elapsed}s] Status: ${utilization.status.toUpperCase()}`);
      console.log(`  Active: ${utilization.active}/${utilization.maxPoolSize} (${utilization.utilization}%)`);
      console.log(`  Idle: ${utilization.idle} (${utilization.idlePercentage}%)`);
      
      if (utilization.recommendations.length > 0) {
        console.log(`  ⚠️  Recommendations:`);
        utilization.recommendations.forEach(rec => {
          console.log(`     - ${rec}`);
        });
      }
      console.log('');
      
      // Wait for next sample
      await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
    }
    
    // Calculate statistics
    console.log('='.repeat(60));
    console.log('📈 MONITORING SUMMARY\n');
    
    const avgUtilization = samples.reduce((sum, s) => sum + s.utilization, 0) / samples.length;
    const maxUtilization = Math.max(...samples.map(s => s.utilization));
    const minUtilization = Math.min(...samples.map(s => s.utilization));
    
    const avgActive = samples.reduce((sum, s) => sum + s.active, 0) / samples.length;
    const maxActive = Math.max(...samples.map(s => s.active));
    
    const criticalSamples = samples.filter(s => s.status === 'critical').length;
    const warningSamples = samples.filter(s => s.status === 'warning').length;
    const healthySamples = samples.filter(s => s.status === 'healthy').length;
    
    console.log(`Total Samples: ${samples.length}`);
    console.log(`\nUtilization Statistics:`);
    console.log(`  Average: ${avgUtilization.toFixed(2)}%`);
    console.log(`  Maximum: ${maxUtilization.toFixed(2)}%`);
    console.log(`  Minimum: ${minUtilization.toFixed(2)}%`);
    
    console.log(`\nActive Connections:`);
    console.log(`  Average: ${avgActive.toFixed(1)}`);
    console.log(`  Peak: ${maxActive}`);
    console.log(`  Max Pool Size: ${samples[0].maxPoolSize}`);
    
    console.log(`\nHealth Status Distribution:`);
    console.log(`  ✅ Healthy: ${healthySamples} (${(healthySamples/samples.length*100).toFixed(1)}%)`);
    console.log(`  ⚠️  Warning: ${warningSamples} (${(warningSamples/samples.length*100).toFixed(1)}%)`);
    console.log(`  🚨 Critical: ${criticalSamples} (${(criticalSamples/samples.length*100).toFixed(1)}%)`);
    
    // Overall recommendations
    console.log(`\n💡 OVERALL RECOMMENDATIONS:\n`);
    
    if (maxUtilization > 90) {
      console.log(`  🚨 CRITICAL: Peak utilization reached ${maxUtilization.toFixed(1)}%`);
      console.log(`     → Increase DB_MAX_POOL_SIZE from ${samples[0].maxPoolSize} to ${samples[0].maxPoolSize + 5}`);
    } else if (maxUtilization > 70) {
      console.log(`  ⚠️  WARNING: Peak utilization reached ${maxUtilization.toFixed(1)}%`);
      console.log(`     → Consider increasing DB_MAX_POOL_SIZE if load increases`);
    } else if (avgUtilization < 20) {
      console.log(`  ℹ️  INFO: Average utilization is low (${avgUtilization.toFixed(1)}%)`);
      console.log(`     → Consider reducing DB_MAX_POOL_SIZE to ${Math.max(5, Math.ceil(maxActive * 1.5))}`);
    } else {
      console.log(`  ✅ Pool configuration is optimal for current load`);
    }
    
    // Configuration recommendations
    console.log(`\n📝 SUGGESTED CONFIGURATION:\n`);
    console.log(`  DB_MAX_POOL_SIZE=${Math.max(5, Math.ceil(maxActive * 1.5))}`);
    console.log(`  DB_MIN_POOL_SIZE=${Math.max(2, Math.ceil(avgActive * 0.5))}`);
    console.log(`  DB_SOCKET_TIMEOUT_MS=45000`);
    console.log(`  DB_SERVER_SELECTION_TIMEOUT_MS=5000`);
    console.log(`  DB_HEARTBEAT_FREQUENCY_MS=10000`);
    console.log(`  DB_MAX_IDLE_TIME_MS=60000`);
    console.log(`  DB_WAIT_QUEUE_TIMEOUT_MS=10000`);
    
    console.log('\n' + '='.repeat(60));
    
    // Get final metrics
    const metrics = getMetrics();
    console.log('\n📊 DATABASE METRICS:\n');
    console.log(`  Total Queries: ${metrics.queries.total}`);
    console.log(`  Slow Queries: ${metrics.queries.slow}`);
    console.log(`  Active Tenants: ${metrics.tenants.count}`);
    
    if (metrics.tenants.topTenants.length > 0) {
      console.log(`\n  Top Tenants by Query Count:`);
      metrics.tenants.topTenants.forEach((tenant, i) => {
        console.log(`    ${i + 1}. Tenant ${tenant.tenantId}: ${tenant.queryCount} queries (avg ${tenant.avgDuration}ms)`);
      });
    }
    
    console.log('\n✅ Monitoring complete.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error during monitoring:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const durationSeconds = parseInt(args[0]) || 60;
const intervalSeconds = parseInt(args[1]) || 5;

// Run monitoring if executed directly
if (require.main === module) {
  console.log(`\nUsage: node monitorConnectionPool.js [duration_seconds] [interval_seconds]`);
  console.log(`Example: node monitorConnectionPool.js 120 10\n`);
  
  monitorConnectionPool(durationSeconds, intervalSeconds);
}

module.exports = { monitorConnectionPool };
