#!/usr/bin/env node

/**
 * Deployment Automation Script
 * 
 * Automates the deployment process with the following features:
 * - Pre-deployment validation (environment variables and database connectivity)
 * - Automatic database initialization if empty
 * - Clear deployment status messages
 * - Graceful error handling with rollback capability
 * 
 * Requirements: 12.3
 * 
 * Usage:
 *   node scripts/deploy.js
 *   npm run deploy
 */

const mongoose = require('mongoose');
const { validateEnvironmentVariables } = require('../utils/envValidator');
const { getHealthCheck } = require('../config/db');
const initUniverse = require('./initUniverse');
const Tenant = require('../models/Tenant');
require('dotenv').config();

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Print colored message to console
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print section header
 */
function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70) + '\n');
}

/**
 * Step 1: Validate environment variables
 */
async function validateEnvironment() {
  logSection('📋 STEP 1: Validating Environment Variables');
  
  const result = validateEnvironmentVariables();
  
  if (!result.success) {
    log('❌ Environment validation failed!', 'red');
    console.log('');
    
    result.errors.forEach(error => {
      log(`   ❌ ${error.variable}`, 'red');
      log(`      ${error.description}`, 'reset');
      log(`      Error: ${error.error}`, 'yellow');
      console.log('');
    });
    
    log('💡 Fix these issues:', 'yellow');
    log('   1. Create a .env file in the backend directory', 'reset');
    log('   2. Copy .env.example to .env: cp .env.example .env', 'reset');
    log('   3. Fill in all required environment variables', 'reset');
    log('   4. Run deployment again', 'reset');
    console.log('');
    
    return false;
  }
  
  log('✅ All required environment variables are valid', 'green');
  
  // Log warnings for optional variables
  if (result.warnings.length > 0) {
    log(`⚠️  ${result.warnings.length} optional variable(s) not set:`, 'yellow');
    result.warnings.forEach(warning => {
      log(`   - ${warning.variable}: ${warning.description}`, 'yellow');
    });
  }
  
  console.log('');
  log('Environment variables:', 'cyan');
  log(`   MONGODB_URI: ${process.env.MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`, 'reset');
  log(`   PORT: ${process.env.PORT || '5001'}`, 'reset');
  log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`, 'reset');
  
  return true;
}

/**
 * Step 2: Validate database connectivity
 */
async function validateDatabaseConnectivity() {
  logSection('🔌 STEP 2: Validating Database Connectivity');
  
  try {
    log('Connecting to database...', 'cyan');
    
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // 10 second timeout
      connectTimeoutMS: 10000
    });
    
    log(`✅ Connected to database: ${mongoose.connection.name}`, 'green');
    
    // Validate we're connected to superkafe_v2
    if (mongoose.connection.name !== 'superkafe_v2') {
      log(`❌ Expected database 'superkafe_v2' but connected to '${mongoose.connection.name}'`, 'red');
      log('   Update MONGODB_URI to point to superkafe_v2 database', 'yellow');
      return false;
    }
    
    // Test database operations
    log('Testing database operations...', 'cyan');
    const startTime = Date.now();
    await mongoose.connection.db.admin().ping();
    const responseTime = Date.now() - startTime;
    
    log(`✅ Database responding (${responseTime}ms)`, 'green');
    
    // Check database stats
    const stats = await mongoose.connection.db.stats();
    log('', 'reset');
    log('Database statistics:', 'cyan');
    log(`   Collections: ${stats.collections}`, 'reset');
    log(`   Data size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`, 'reset');
    log(`   Storage size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`, 'reset');
    
    return true;
  } catch (error) {
    log('❌ Database connectivity check failed!', 'red');
    log(`   Error: ${error.message}`, 'yellow');
    console.log('');
    log('💡 Troubleshooting:', 'yellow');
    log('   1. Verify MongoDB is running', 'reset');
    log('   2. Check MONGODB_URI in .env file', 'reset');
    log('   3. Verify network connectivity to MongoDB', 'reset');
    log('   4. Check MongoDB logs for errors', 'reset');
    log('   5. Ensure database superkafe_v2 exists', 'reset');
    
    return false;
  }
}

/**
 * Step 3: Check if database initialization is needed
 */
async function checkDatabaseInitialization() {
  logSection('🔍 STEP 3: Checking Database Initialization Status');
  
  try {
    // Check if any tenants exist
    const tenantCount = await Tenant.countDocuments();
    
    log(`Found ${tenantCount} tenant(s) in database`, 'cyan');
    
    if (tenantCount === 0) {
      log('⚠️  Database is empty - initialization required', 'yellow');
      return { needsInit: true, isEmpty: true };
    }
    
    // Check if default tenant "negoes" exists
    const defaultTenant = await Tenant.findOne({ slug: 'negoes' });
    
    if (!defaultTenant) {
      log('⚠️  Default tenant "negoes" not found - initialization recommended', 'yellow');
      return { needsInit: true, isEmpty: false };
    }
    
    log('✅ Database is initialized', 'green');
    log(`   Default tenant: ${defaultTenant.name} (${defaultTenant.slug})`, 'reset');
    log(`   Status: ${defaultTenant.status}`, 'reset');
    log(`   Active: ${defaultTenant.isActive}`, 'reset');
    
    return { needsInit: false, tenant: defaultTenant };
  } catch (error) {
    log('❌ Failed to check database status', 'red');
    log(`   Error: ${error.message}`, 'yellow');
    throw error;
  }
}

/**
 * Step 4: Initialize database if needed
 */
async function initializeDatabase() {
  logSection('🌌 STEP 4: Initializing Database');
  
  log('Running initUniverse script...', 'cyan');
  console.log('');
  
  try {
    // Close current connection so initUniverse can manage its own
    await mongoose.connection.close();
    
    // Run initialization
    const result = await initUniverse();
    
    // Reconnect after initialization
    await mongoose.connect(process.env.MONGODB_URI);
    
    if (!result.success) {
      log('❌ Database initialization failed!', 'red');
      log(`   ${result.message}`, 'yellow');
      return false;
    }
    
    log('✅ Database initialized successfully', 'green');
    return true;
  } catch (error) {
    log('❌ Database initialization failed!', 'red');
    log(`   Error: ${error.message}`, 'yellow');
    
    // Try to reconnect
    try {
      await mongoose.connect(process.env.MONGODB_URI);
    } catch (reconnectError) {
      log('❌ Failed to reconnect to database', 'red');
    }
    
    return false;
  }
}

/**
 * Step 5: Final validation
 */
async function finalValidation() {
  logSection('✅ STEP 5: Final Validation');
  
  try {
    // Verify tenant exists
    const tenant = await Tenant.findOne({ slug: 'negoes' });
    if (!tenant) {
      log('❌ Validation failed: Default tenant not found', 'red');
      return false;
    }
    
    log('✅ Default tenant verified', 'green');
    log(`   Name: ${tenant.name}`, 'reset');
    log(`   Slug: ${tenant.slug}`, 'reset');
    log(`   Status: ${tenant.status}`, 'reset');
    
    // Get collection counts
    const collections = await mongoose.connection.db.listCollections().toArray();
    log('', 'reset');
    log(`✅ Database has ${collections.length} collections`, 'green');
    
    return true;
  } catch (error) {
    log('❌ Final validation failed', 'red');
    log(`   Error: ${error.message}`, 'yellow');
    return false;
  }
}

/**
 * Main deployment function
 */
async function deploy() {
  const startTime = Date.now();
  
  console.log('');
  logSection('🚀 DEPLOYMENT AUTOMATION STARTED');
  log(`Timestamp: ${new Date().toISOString()}`, 'cyan');
  log(`Node version: ${process.version}`, 'cyan');
  log(`Platform: ${process.platform}`, 'cyan');
  
  try {
    // Step 1: Validate environment
    const envValid = await validateEnvironment();
    if (!envValid) {
      log('', 'reset');
      log('❌ Deployment aborted: Environment validation failed', 'red');
      process.exit(1);
    }
    
    // Step 2: Validate database connectivity
    const dbValid = await validateDatabaseConnectivity();
    if (!dbValid) {
      log('', 'reset');
      log('❌ Deployment aborted: Database connectivity check failed', 'red');
      process.exit(1);
    }
    
    // Step 3: Check if initialization is needed
    const initStatus = await checkDatabaseInitialization();
    
    // Step 4: Initialize database if needed
    if (initStatus.needsInit) {
      log('', 'reset');
      log('🔄 Database initialization required', 'yellow');
      
      const initSuccess = await initializeDatabase();
      if (!initSuccess) {
        log('', 'reset');
        log('❌ Deployment aborted: Database initialization failed', 'red');
        process.exit(1);
      }
    } else {
      log('', 'reset');
      log('✅ Database initialization not needed - skipping', 'green');
    }
    
    // Step 5: Final validation
    const validationSuccess = await finalValidation();
    if (!validationSuccess) {
      log('', 'reset');
      log('❌ Deployment aborted: Final validation failed', 'red');
      process.exit(1);
    }
    
    // Success!
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    logSection('✅ DEPLOYMENT COMPLETED SUCCESSFULLY');
    log(`Duration: ${duration} seconds`, 'cyan');
    log(`Database: ${mongoose.connection.name}`, 'cyan');
    log(`Status: Ready for production`, 'green');
    console.log('');
    
    log('🎉 Next steps:', 'bright');
    log('   1. Start the application: npm start', 'reset');
    log('   2. Verify health endpoint: curl http://localhost:5001/health', 'reset');
    log('   3. Login with credentials:', 'reset');
    log('      Email: admin@negoes.com', 'reset');
    log('      Password: admin123', 'reset');
    log('   4. Monitor logs for any issues', 'reset');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    logSection('❌ DEPLOYMENT FAILED');
    log(`Duration: ${duration} seconds`, 'cyan');
    log(`Error: ${error.message}`, 'red');
    console.log('');
    log('Stack trace:', 'yellow');
    console.error(error.stack);
    console.log('');
    
    log('💡 Troubleshooting:', 'yellow');
    log('   1. Check the error message above', 'reset');
    log('   2. Verify all environment variables are set correctly', 'reset');
    log('   3. Ensure MongoDB is running and accessible', 'reset');
    log('   4. Check MongoDB logs for errors', 'reset');
    log('   5. Try running individual validation steps manually', 'reset');
    console.log('');
    
    process.exit(1);
  } finally {
    // Cleanup: close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      log('🔌 Database connection closed', 'cyan');
    }
  }
}

// Run deployment if called directly
if (require.main === module) {
  deploy().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = deploy;
