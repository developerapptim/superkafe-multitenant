const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

async function checkTenant() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const Tenant = db.collection('tenants');
  const tenant = await Tenant.findOne({ slug: 'negoes' });
  
  if (tenant) {
    console.log('=== TENANT STATUS ===');
    console.log('Name:', tenant.name);
    console.log('Slug:', tenant.slug);
    console.log('Status:', tenant.status);
    console.log('Subscription Plan:', tenant.subscriptionPlan);
    console.log('Subscription Expires At:', tenant.subscriptionExpiresAt);
    console.log('Grace Period Ends At:', tenant.gracePeriodEndsAt);
    console.log('Subscription History (last 3):');
    const history = tenant.subscriptionHistory || [];
    history.slice(-3).forEach((h, i) => {
      console.log(`  [${i}] plan: ${h.plan}, amount: ${h.amount}, merchantOrderId: ${h.merchantOrderId}, paidAt: ${h.paidAt}`);
    });
  } else {
    console.log('Tenant "negoes" not found');
  }
  
  await mongoose.disconnect();
}

checkTenant();
