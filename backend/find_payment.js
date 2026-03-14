const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

async function findLatestPayment() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const paymentSchema = new mongoose.Schema({
    merchantOrderId: String,
    status: String,
    amount: Number
  }, { strict: false });
  
  // Try to find the collection
  const colls = await mongoose.connection.db.listCollections().toArray();
  const collNames = colls.map(c => c.name);
  console.log('Collections:', collNames.filter(n => n.toLowerCase().includes('payment') || n.toLowerCase().includes('subs')));
  
  // Assuming the collection is something like subscriptionpayments or payments
  const Payment = mongoose.model('Payment', paymentSchema, 'subscriptionpayments'); // Guessing
  
  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants');
  
  // Try looking in Tenant collection if subscriptions are embedded or have references
  const tenants = await Tenant.find({"subscription.status": "pending"}).limit(1);
  if(tenants.length > 0) {
     console.log('Found tenant pending:', JSON.stringify(tenants[0].subscription));
  }
  
  try {
     const payments = await Payment.find().sort({createdAt: -1}).limit(5);
     console.log('Latest payments:', payments);
  } catch(e) {}
  
  await mongoose.disconnect();
}
findLatestPayment();
