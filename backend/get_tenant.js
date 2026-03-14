const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

async function getTenant() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const Tenant = db.collection('tenants');
  const tenants = await Tenant.find().limit(3).toArray();
  for (let t of tenants) {
    console.log(`id: ${t._id}, name: "${t.name}", slug: "${t.slug}"`);
  }
  await mongoose.disconnect();
}

getTenant();
