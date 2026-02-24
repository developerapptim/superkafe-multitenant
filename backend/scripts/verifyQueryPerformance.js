/**
 * Query Performance Verification Script
 * 
 * This script verifies that common queries utilize tenantId indexes
 * and identifies slow queries that need optimization.
 * 
 * Requirements: 8.1, 8.6
 */

const mongoose = require('mongoose');
const { connectMainDB } = require('../config/db');
const { setTenantContext } = require('../utils/tenantContext');
const logger = require('../utils/logger');

// Import tenant-scoped models
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Table = require('../models/Table');
const Employee = require('../models/Employee');
const CashTransaction = require('../models/CashTransaction');

/**
 * Run explain() on a query and analyze index usage
 * @param {string} modelName - Name of the model
 * @param {Object} query - Query object
 * @param {Function} queryFn - Function that executes the query
 * @returns {Promise<Object>} Explain results with analysis
 */
async function analyzeQuery(modelName, queryDescription, queryFn) {
  console.log(`\n📊 Analyzing: ${modelName} - ${queryDescription}`);
  
  try {
    const startTime = Date.now();
    const explainResult = await queryFn();
    const duration = Date.now() - startTime;
    
    // Extract execution stats
    const executionStats = explainResult.executionStats || {};
    const winningPlan = explainResult.queryPlanner?.winningPlan || {};
    
    // Check if index was used
    const indexUsed = findIndexUsage(winningPlan);
    const usedTenantIdIndex = indexUsed && indexUsed.includes('tenantId');
    
    const analysis = {
      model: modelName,
      description: queryDescription,
      duration: `${duration}ms`,
      executionTimeMs: executionStats.executionTimeMillis || 0,
      totalDocsExamined: executionStats.totalDocsExamined || 0,
      totalKeysExamined: executionStats.totalKeysExamined || 0,
      nReturned: executionStats.nReturned || 0,
      indexUsed: indexUsed || 'COLLSCAN (no index)',
      usesTenantIdIndex: usedTenantIdIndex,
      isOptimal: usedTenantIdIndex && executionStats.totalDocsExamined === executionStats.nReturned,
      stage: winningPlan.stage || 'UNKNOWN'
    };
    
    // Print results
    console.log(`  ⏱️  Execution Time: ${analysis.executionTimeMs}ms`);
    console.log(`  📄 Docs Examined: ${analysis.totalDocsExamined}`);
    console.log(`  🔑 Keys Examined: ${analysis.totalKeysExamined}`);
    console.log(`  ✅ Returned: ${analysis.nReturned}`);
    console.log(`  📇 Index Used: ${analysis.indexUsed}`);
    console.log(`  🎯 Uses tenantId Index: ${analysis.usesTenantIdIndex ? '✅ YES' : '❌ NO'}`);
    console.log(`  ⚡ Optimal: ${analysis.isOptimal ? '✅ YES' : '⚠️  NO'}`);
    
    if (!usedTenantIdIndex) {
      console.log(`  ⚠️  WARNING: Query does not use tenantId index!`);
    }
    
    if (executionStats.totalDocsExamined > executionStats.nReturned * 2) {
      console.log(`  ⚠️  WARNING: Query examines too many documents (inefficient)`);
    }
    
    return analysis;
  } catch (error) {
    console.error(`  ❌ Error analyzing query: ${error.message}`);
    return {
      model: modelName,
      description: queryDescription,
      error: error.message
    };
  }
}

/**
 * Recursively find index usage in query plan
 * @param {Object} plan - Query plan object
 * @returns {string|null} Index name or null
 */
function findIndexUsage(plan) {
  if (!plan) return null;
  
  // Check if this stage uses an index
  if (plan.indexName) {
    return plan.indexName;
  }
  
  // Check for IXSCAN stage
  if (plan.stage === 'IXSCAN' && plan.keyPattern) {
    return `Index on ${Object.keys(plan.keyPattern).join(', ')}`;
  }
  
  // Recursively check input stages
  if (plan.inputStage) {
    return findIndexUsage(plan.inputStage);
  }
  
  // Check input stages array
  if (plan.inputStages && Array.isArray(plan.inputStages)) {
    for (const stage of plan.inputStages) {
      const result = findIndexUsage(stage);
      if (result) return result;
    }
  }
  
  return null;
}

/**
 * Main verification function
 */
async function verifyQueryPerformance() {
  console.log('🚀 Starting Query Performance Verification\n');
  console.log('=' .repeat(60));
  
  try {
    // Connect to database
    await connectMainDB();
    console.log('✅ Connected to database\n');
    
    // Get a test tenant
    const Tenant = require('../models/Tenant');
    const testTenant = await Tenant.findOne({ isActive: true });
    
    if (!testTenant) {
      console.error('❌ No active tenant found. Please create a tenant first.');
      process.exit(1);
    }
    
    console.log(`🏢 Using tenant: ${testTenant.name} (${testTenant.slug})`);
    console.log(`   Tenant ID: ${testTenant._id}`);
    
    // Set tenant context
    setTenantContext({
      id: testTenant._id.toString(),
      slug: testTenant.slug,
      name: testTenant.name,
      dbName: 'superkafe_v2'
    });
    
    const results = [];
    
    // Test 1: MenuItem.find() with tenantId filter
    results.push(await analyzeQuery(
      'MenuItem',
      'Find all active menu items',
      () => MenuItem.find({ is_active: true }).explain('executionStats')
    ));
    
    // Test 2: MenuItem.findOne() with tenantId filter
    results.push(await analyzeQuery(
      'MenuItem',
      'Find one menu item by category',
      () => MenuItem.findOne({ category: 'Kopi' }).explain('executionStats')
    ));
    
    // Test 3: Order.find() with tenantId and date filter
    results.push(await analyzeQuery(
      'Order',
      'Find orders from last 7 days',
      () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return Order.find({ 
          createdAt: { $gte: sevenDaysAgo }
        }).explain('executionStats');
      }
    ));
    
    // Test 4: Table.find() with tenantId filter
    results.push(await analyzeQuery(
      'Table',
      'Find all tables',
      () => Table.find({}).explain('executionStats')
    ));
    
    // Test 5: Employee.find() with tenantId and role filter
    results.push(await analyzeQuery(
      'Employee',
      'Find employees by role',
      () => Employee.find({ role: 'admin' }).explain('executionStats')
    ));
    
    // Test 6: CashTransaction.find() with tenantId and date range
    results.push(await analyzeQuery(
      'CashTransaction',
      'Find transactions from today',
      () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return CashTransaction.find({
          createdAt: { $gte: today }
        }).explain('executionStats');
      }
    ));
    
    // Test 7: MenuItem.countDocuments() with tenantId
    results.push(await analyzeQuery(
      'MenuItem',
      'Count active menu items',
      () => MenuItem.countDocuments({ is_active: true }).explain('executionStats')
    ));
    
    // Test 8: Order.aggregate() with tenantId
    results.push(await analyzeQuery(
      'Order',
      'Aggregate orders by status',
      () => Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).explain('executionStats')
    ));
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    
    const totalQueries = results.filter(r => !r.error).length;
    const queriesUsingTenantId = results.filter(r => r.usesTenantIdIndex).length;
    const optimalQueries = results.filter(r => r.isOptimal).length;
    const slowQueries = results.filter(r => r.executionTimeMs > 100).length;
    
    console.log(`\n📈 Total Queries Analyzed: ${totalQueries}`);
    console.log(`✅ Queries Using tenantId Index: ${queriesUsingTenantId}/${totalQueries}`);
    console.log(`⚡ Optimal Queries: ${optimalQueries}/${totalQueries}`);
    console.log(`🐌 Slow Queries (>100ms): ${slowQueries}`);
    
    if (queriesUsingTenantId === totalQueries) {
      console.log('\n🎉 SUCCESS: All queries use tenantId indexes!');
    } else {
      console.log('\n⚠️  WARNING: Some queries do not use tenantId indexes!');
      console.log('   Please review the queries above and optimize them.');
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    const needsOptimization = results.filter(r => !r.isOptimal && !r.error);
    if (needsOptimization.length > 0) {
      console.log('\n   Queries needing optimization:');
      needsOptimization.forEach(r => {
        console.log(`   - ${r.model}: ${r.description}`);
        if (!r.usesTenantIdIndex) {
          console.log(`     → Add compound index with tenantId`);
        }
        if (r.totalDocsExamined > r.nReturned * 2) {
          console.log(`     → Query examines ${r.totalDocsExamined} docs but returns ${r.nReturned}`);
        }
      });
    } else {
      console.log('   ✅ All queries are well optimized!');
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Exit
    await mongoose.connection.close();
    console.log('\n✅ Verification complete. Database connection closed.');
    
    // Exit with appropriate code
    process.exit(queriesUsingTenantId === totalQueries ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Error during verification:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run verification if executed directly
if (require.main === module) {
  verifyQueryPerformance();
}

module.exports = { verifyQueryPerformance, analyzeQuery };
