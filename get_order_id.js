const mongoose = require('mongoose');
const Order = require('./backend/models/Order');

mongoose.connect('mongodb://localhost:27017/warkop-pos', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const order = await Order.findOne({}).sort({ timestamp: -1 });
    if (order) {
        console.log("FOUND_ORDER_ID:", order.id);
    } else {
        console.log("NO_ORDERS");
    }
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
