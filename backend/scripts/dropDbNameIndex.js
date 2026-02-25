/**
 * Migration Script: Drop dbName Unique Index
 * 
 * Purpose: Remove the unique constraint on the dbName field in the Tenant collection.
 * This is required for the Unified Nexus Architecture where all tenants share
 * the same database (superkafe_v2).
 * 
 * Run this script ONCE after deploying the updated Tenant model.
 * 
 * Usage:
 *   node backend/scripts/dropDbNameIndex.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const dropDbNameIndex = async () => {
  try {
    console.log('[MIGRATION] Starting dbName index removal...');
    
    // Connect to database
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/superkafe_v2';
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('[MIGRATION] Connected to database:', mongoose.connection.name);
    
    // Get Tenant collection
    const db = mongoose.connection.db;
    const collection = db.collection('tenants');
    
    // List existing indexes
    const indexes = await collection.indexes();
    console.log('[MIGRATION] Current indexes:', JSON.stringify(indexes, null, 2));
    
    // Check if dbName index exists
    const dbNameIndex = indexes.find(idx => 
      idx.key && idx.key.dbName === 1 && idx.unique === true
    );
    
    if (dbNameIndex) {
      console.log('[MIGRATION] Found dbName unique index:', dbNameIndex.name);
      
      // Drop the index
      await collection.dropIndex(dbNameIndex.name);
      console.log('[MIGRATION] ✅ Successfully dropped dbName unique index');
    } else {
      console.log('[MIGRATION] ℹ️  No dbName unique index found (already removed or never existed)');
    }
    
    // Verify indexes after removal
    const updatedIndexes = await collection.indexes();
    console.log('[MIGRATION] Updated indexes:', JSON.stringify(updatedIndexes, null, 2));
    
    // Close connection
    await mongoose.connection.close();
    console.log('[MIGRATION] Migration completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('[MIGRATION ERROR] Failed to drop dbName index:', error.message);
    console.error(error.stack);
    
    // If error is "ns not found" (collection doesn't exist), that's OK
    if (error.message.includes('ns not found')) {
      console.log('[MIGRATION] ℹ️  Tenants collection does not exist yet - this is OK for fresh installations');
      process.exit(0);
    }
    
    process.exit(1);
  }
};

// Run migration
dropDbNameIndex();
