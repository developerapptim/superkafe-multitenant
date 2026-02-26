const mongoose = require('mongoose');
require('dotenv').config();

async function fixSettingsIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/superkafe_v2');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('settings');

    // Get existing indexes
    const indexes = await collection.indexes();
    console.log('\n📋 Current indexes:', JSON.stringify(indexes, null, 2));

    // Drop the problematic unique index on 'key' field
    try {
      await collection.dropIndex('key_1');
      console.log('✅ Dropped old unique index on "key" field');
    } catch (err) {
      if (err.code === 27) {
        console.log('ℹ️  Index "key_1" does not exist (already removed)');
      } else {
        console.error('❌ Error dropping index:', err.message);
      }
    }

    // Create new compound unique index
    try {
      await collection.createIndex({ tenantId: 1, key: 1 }, { unique: true });
      console.log('✅ Created compound unique index on [tenantId, key]');
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log('ℹ️  Compound index already exists');
      } else {
        console.error('❌ Error creating index:', err.message);
      }
    }

    // Verify new indexes
    const newIndexes = await collection.indexes();
    console.log('\n📋 Updated indexes:', JSON.stringify(newIndexes, null, 2));

    console.log('\n✅ Index fix complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixSettingsIndex();
