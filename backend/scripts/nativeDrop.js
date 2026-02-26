require('dotenv').config();
const { MongoClient } = require('mongodb');

async function dropBadIndexes() {
    console.log('Connecting to', process.env.MONGODB_URI);
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        console.log('Connected to DB natively.');
        const db = client.db('superkafe_main'); // Usually parsed from URI, but hardcoding for safety

        const collections = ['categories', 'menuitems', 'tables'];
        for (const colName of collections) {
            console.log(`Checking indexes for ${colName}...`);
            const collection = db.collection(colName);
            try {
                const indexes = await collection.indexes();
                console.log(`Indexes in ${colName}:`, indexes.map(i => i.name));

                if (indexes.some(i => i.name === 'id_1')) {
                    console.log(`Dropping id_1 from ${colName}`);
                    await collection.dropIndex('id_1');
                    console.log(`Dropped id_1 from ${colName}`);
                }

                if (colName === 'tables' && indexes.some(i => i.name === 'number_1')) {
                    console.log(`Dropping number_1 from tables`);
                    await collection.dropIndex('number_1');
                    console.log(`Dropped number_1 from tables`);
                }
            } catch (e) {
                console.log(`Could not check/drop for ${colName}:`, e.message);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
        console.log('Closed connection');
        process.exit(0);
    }
}

dropBadIndexes();
