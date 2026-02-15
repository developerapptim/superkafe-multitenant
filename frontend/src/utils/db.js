import Dexie from 'dexie';

const db = new Dexie('WarkopPOSDB');

db.version(1).stores({
    products: 'id, name, price, category, stock', // Use 'id' as PK for easy upsert
    offline_orders: '++id, timestamp, synced' // synced index for fast filtering
});

export default db;
