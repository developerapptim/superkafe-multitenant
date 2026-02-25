/**
 * Migration Script: Drop dbName Unique Index from All Databases
 * 
 * Purpose: Remove the unique constraint on the dbName field in the Tenant collection
 * from all possible databases (superkafe_v2, superkafe_main, superkafe_negoes).
 * 
 * This handles cases where the database name was changed during development.
 * 
 * Usage:
 *   node backend/scripts/dropDbNameIndexAllDatabases.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Extract connection details from MONGODB_URI
const getConnectionDetails = () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/superkafe_v2';
  const match = uri.match(/mongodb:\/\/([^@]+@)?([^/]+)\/([^?]+)/);
  
  if (!match) {
    throw new Error('Invalid MONGODB_URI format');
  }
  
  const auth = match[1] || '';
  const host = match[2];
  const authSource = uri.includes('authSource=') ? uri.split('authSource=')[1].split('&')[0] : 'admin';
  
  return {
    baseUri: `mongodb://${auth}${host}`,
    authSource
  };
};

const dropIndexFromDatabase = async (dbName, baseUri, authSource) => {
  let connection;
  
  try {
    console.log(`\n[MIGRATION] Checking database: ${dbName}`);
    
    // Connect to specific database
    const uri = `${baseUri}/${dbName}?authSource=${authSource}`;
    connection = await mongoose.createConnection(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log(`[MIGRATION] Connected to: ${dbName}`);
    
    // Get Tenant collection
    const collection = connection.collection('tenants');
    
    // Check if collection exists
    const collections = await connection.db.listCollections({ name: 'tenants' }).toArray();
    if (collections.length === 0) {
      console.log(`[MIGRATION] ℹ️  No 'tenants' collection in ${dbName} - skipping`);
      await connection.close();
      return { database: dbName, status: 'skipped', reason: 'collection not found' };
    }
    
    // List existing indexes
    const indexes = await collection.indexes();
    console.log(`[MIGRATION] Indexes in ${dbName}:`, indexes.map(idx => idx.name).join(', '));
    
    // Check if dbName index exists
    const dbNameIndex = indexes.find(idx => 
      idx.key && idx.key.dbName === 1 && idx.unique === true
    );
    
    if (dbNameIndex) {
      console.log(`[MIGRATION] Found dbName unique index in ${dbName}:`, dbNameIndex.name);
      
      // Drop the index
      await collection.dropIndex(dbNameIndex.name);
      console.log(`[MIGRATION] ✅ Successfully dropped dbName unique index from ${dbName}`);
      
      await connection.close();
      return { database: dbName, status: 'dropped', indexName: dbNameIndex.name };
    } else {
      console.log(`[MIGRATION] ℹ️  No dbName unique index in ${dbName}`);
      await connection.close();
      return { database: dbName, status: 'not_found' };
    }
    
  } catch (error) {
    if (connection) {
      await connection.close();
    }
    
    console.error(`[MIGRATION ERROR] Failed to process ${dbName}:`, error.message);
    return { database: dbName, status: 'error', error: error.message };
  }
};

const runMigration = async () => {
  try {
    console.log('[MIGRATION] Starting dbName index removal from all databases...');
    
    const { baseUri, authSource } = getConnectionDetails();
    console.log('[MIGRATION] Base URI:', baseUri.replace(/\/\/.*@/, '//***@')); // Mask credentials
    console.log('[MIGRATION] Auth Source:', authSource);
    
    // List of databases to check
    const databases = ['superkafe_v2', 'superkafe_main', 'superkafe_negoes'];
    
    const results = [];
    
    // Process each database
    for (const dbName of databases) {
      const result = await dropIndexFromDatabase(dbName, baseUri, authSource);
      results.push(result);
    }
    
    // Summary
    console.log('\n[MIGRATION] ========== SUMMARY ==========');
    results.forEach(result => {
      const statusEmoji = {
        'dropped': '✅',
        'not_found': 'ℹ️',
        'skipped': '⏭️',
        'error': '❌'
      }[result.status] || '❓';
      
      console.log(`${statusEmoji} ${result.database}: ${result.status}${result.indexName ? ` (${result.indexName})` : ''}${result.reason ? ` - ${result.reason}` : ''}${result.error ? ` - ${result.error}` : ''}`);
    });
    
    const droppedCount = results.filter(r => r.status === 'dropped').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    console.log('\n[MIGRATION] Migration completed');
    console.log(`[MIGRATION] Indexes dropped: ${droppedCount}`);
    console.log(`[MIGRATION] Errors: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log('\n[MIGRATION] ⚠️  Some databases had errors. Check logs above.');
      process.exit(1);
    } else {
      console.log('\n[MIGRATION] ✅ All databases processed successfully');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('[MIGRATION ERROR] Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run migration
runMigration();
