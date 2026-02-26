require('dotenv').config();
const mongoose = require('mongoose');

async function dropGlobalIndexes() {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('MONGODB_URI is not defined in .env');
            process.exit(1);
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        const collections = ['categories', 'menuitems', 'tables'];

        for (const collName of collections) {
            const collection = mongoose.connection.collection(collName);

            try {
                const indexes = await collection.indexes();
                const hasIdIndex = indexes.some(idx => idx.name === 'id_1');

                if (hasIdIndex) {
                    console.log(`Dropping index id_1 from ${collName}...`);
                    await collection.dropIndex('id_1');
                    console.log(`Successfully dropped id_1 from ${collName}`);
                } else {
                    console.log(`Index id_1 not found in ${collName}, skipping.`);
                }

                if (collName === 'tables') {
                    const hasNumberIndex = indexes.some(idx => idx.name === 'number_1');
                    if (hasNumberIndex) {
                        console.log(`Dropping index number_1 from ${collName}...`);
                        await collection.dropIndex('number_1');
                        console.log(`Successfully dropped number_1 from ${collName}`);
                    } else {
                        console.log(`Index number_1 not found in ${collName}, skipping.`);
                    }
                }
            } catch (err) {
                console.error(`Error processing collection ${collName}:`, err.message);
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

dropGlobalIndexes();
