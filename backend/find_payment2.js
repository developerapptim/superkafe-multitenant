const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

async function findLatestPayment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const colls = await db.listCollections().toArray();
    
    console.log('Collections:', colls.map(c => c.name).filter(n => n.toLowerCase().includes('pay') || n.toLowerCase().includes('sub') || n.toLowerCase().includes('tenant')));
    
    const Payment = db.collection('subscriptionpayments');
    const payment = await Payment.find().sort({createdAt: -1}).limit(1).toArray();
    console.log('Latest SubscriptionPayment:', payment.map(p => ({
        id: p._id, merchantOrderId: p.merchantOrderId, amount: p.amount, status: p.paymentStatus || p.status
    })));

    const Tenant = db.collection('tenants');
    const tenant = await Tenant.find({"subscription.status": "pending"}).limit(1).toArray();
    if(tenant.length > 0) console.log('Found tenant pending:', tenant[0].slug, tenant[0].subscription);
    
  } catch(e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
}
findLatestPayment();
