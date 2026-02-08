const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');
const StockHistory = require('../models/StockHistory');
const Shift = require('../models/Shift');
const Customer = require('../models/Customer');
const Settings = require('../models/Settings');

exports.checkPhone = async (req, res) => {
    try {
        const { phone } = req.body;
        const orders = await Order.find({
            customerPhone: phone,
            status: { $in: ['new', 'process'] }
        });

        if (orders.length > 0) {
            res.json({
                hasActiveOrder: true,
                orders: orders.map(o => ({
                    id: o.id,
                    total: o.total,
                    itemCount: o.items.length,
                    time: new Date(o.timestamp).toLocaleTimeString(),
                    tableNumber: o.tableNumber
                }))
            });
        } else {
            res.json({ hasActiveOrder: false });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createOrder = async (req, res) => {
    try {
        console.log("➡️ Create Order Request Received");
        let orderData = req.body;

        // PARSE IF STRING
        if (req.body.orderData && typeof req.body.orderData === 'string') {
            try {
                orderData = JSON.parse(req.body.orderData);
            } catch (err) {
                console.error("❌ JSON Parse Error:", err);
                return res.status(400).json({ error: 'Invalid order data format' });
            }
        }

        // Attach Payment Proof
        if (req.file) {
            orderData.paymentProofImage = `/uploads/payments/${req.file.filename}`;
        }

        // GENERATE ORDER ID
        if (!orderData.id) {
            orderData.id = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        }
        console.log("🆔 Order ID:", orderData.id);

        // 1. Calculate HPP & Deduct Stock
        console.log("1️⃣ Starting Stock Deduction Logic");
        const recipes = await Recipe.find();
        const ingredients = await Ingredient.find();

        const ingredientMap = new Map();
        ingredients.forEach(i => ingredientMap.set(String(i.id), i));

        const recipeMap = new Map();
        recipes.forEach(r => recipeMap.set(String(r.menuId), r.ingredients));

        let orderTotalHPP = 0;
        const enrichedItems = [];

        if (orderData.items && Array.isArray(orderData.items)) {
            for (const item of orderData.items) {
                const menuId = String(item.id);
                const recipeIngredients = recipeMap.get(menuId);
                let itemHPP = 0;

                if (recipeIngredients) {
                    for (const ri of recipeIngredients) {
                        const ingKey = String(ri.ing_id);
                        const ingData = ingredientMap.get(ingKey);

                        // SANITIZE & VALIDATE NUMBERS
                        let required = Number(ri.jumlah);
                        if (isNaN(required)) {
                            console.warn(`⚠️ Invalid Recipe Amount for ingredient ${ri.ing_id}: ${ri.jumlah}, defaulting to 0`);
                            required = 0;
                        }

                        let qtyOrdered = Number(item.qty || item.count);
                        if (isNaN(qtyOrdered)) {
                            console.warn(`⚠️ Invalid Order Qty for item ${item.name}: ${item.qty || item.count}, defaulting to 0`);
                            qtyOrdered = 0;
                        }

                        if (ingData) {
                            // Calculate HPP
                            const costPerUnit = (ingData.isi_prod && ingData.isi_prod > 0)
                                ? (ingData.harga_beli / ingData.isi_prod)
                                : ingData.harga_beli;

                            // Safe check for costPerUnit
                            const validCost = isNaN(costPerUnit) ? 0 : costPerUnit;

                            itemHPP += (validCost * required);

                            // DEDUCT STOCK
                            if (ingData.type === 'physical' || !ingData.type) {
                                const qtyToDeduct = required * qtyOrdered;

                                console.log(`📉 Deducting Stock: ${ingData.nama} (ID: ${ingData.id}) | Current: ${ingData.stok} | Deduct: ${qtyToDeduct}`);

                                if (isNaN(ingData.stok)) {
                                    console.error(`⚠️ Stock corrupted (NaN) for ${ingData.nama}, resetting to 0`);
                                    ingData.stok = 0;
                                }

                                if (!isNaN(qtyToDeduct)) {
                                    ingData.stok -= qtyToDeduct;
                                    await ingData.save();

                                    // Log Stock History
                                    const history = new StockHistory({
                                        id: `hist_out_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                        ing_id: ingData.id,
                                        ingName: ingData.nama,
                                        type: 'out',
                                        qty: qtyToDeduct,
                                        stokSebelum: ingData.stok + qtyToDeduct,
                                        stokSesudah: ingData.stok,
                                        note: `Order ${orderData.id} - ${item.name}`,
                                        date: new Date().toISOString().split('T')[0],
                                        time: new Date().toLocaleTimeString('id-ID', { hour12: false })
                                    });
                                    await history.save();
                                } else {
                                    console.error(`❌ Validation Failed: qtyToDeduct is NaN for ${ingData.nama}`);
                                }
                            }
                        }
                    }
                }

                const qtyOrderedFinal = Number(item.qty || item.count);
                const safeQty = isNaN(qtyOrderedFinal) ? 0 : qtyOrderedFinal;

                orderTotalHPP += (itemHPP * safeQty);

                enrichedItems.push({
                    ...item,
                    hpp_locked: itemHPP
                });
            }
        }
        console.log("✅ Stock Deduction Complete. Total HPP:", orderTotalHPP);

        // 2. Create Order Object
        console.log("2️⃣ Saving Order to DB");
        const newOrder = new Order({
            ...orderData,
            items: enrichedItems,
            timestamp: Date.now()
        });

        await newOrder.save();
        console.log("✅ Order Saved Successfully");

        // 3. Update Shift
        console.log("3️⃣ Updating Active Shift");
        if (newOrder.status === 'done' || newOrder.paymentStatus === 'paid') {
            const activeShift = await Shift.findOne({ endTime: null });
            if (activeShift) {
                if (newOrder.paymentMethod === 'cash') {
                    activeShift.cashSales = (activeShift.cashSales || 0) + newOrder.total;
                    activeShift.currentCash = (activeShift.currentCash || 0) + newOrder.total;
                } else {
                    activeShift.nonCashSales = (activeShift.nonCashSales || 0) + newOrder.total;
                    activeShift.currentNonCash = (activeShift.currentNonCash || 0) + newOrder.total;
                }

                if (!activeShift.orders) activeShift.orders = [];
                activeShift.orders.push(newOrder.id);

                // Link Order to Shift ID
                newOrder.shiftId = activeShift.id;
                await newOrder.save(); // Save again with shiftId

                await activeShift.save();
                console.log("✅ Shift Updated");
            } else {
                console.log("⚠️ No Active Shift Found");
            }
        } else {
            console.log("ℹ️ Order not paid/done, skipping shift update");
        }

        // 4. Update Customer Loyalty
        console.log("4️⃣ Extending Customer Logic");
        if (newOrder.customerPhone || (newOrder.customerName && newOrder.customerName !== 'Pelanggan Baru')) {
            console.log("🔍 Processing Customer Logic");
            let customer = null;
            const query = [];

            if (newOrder.customerId && newOrder.customerId !== 'guest') query.push({ id: newOrder.customerId });
            if (newOrder.customerPhone && newOrder.customerPhone.length > 5) query.push({ phone: newOrder.customerPhone });

            // If No Phone/ID but has Name, try to find by Name (Case Insensitive) ?
            // Risk: "Aldy" vs "aldy" vs "Aldy " -> Duplicates.
            // Decision: If only Name provided, we create NEW customer or update if exactly matches?
            // For now, let's include name in search if phone is missing
            if ((!newOrder.customerPhone || newOrder.customerPhone.length < 6) && newOrder.customerName) {
                query.push({ name: new RegExp('^' + newOrder.customerName.trim() + '$', 'i') });
            }

            if (query.length > 0) {
                customer = await Customer.findOne({ $or: query });
            }

            if (!customer) {
                console.log("✨ Creating New Customer");
                customer = new Customer({
                    id: `cust_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    name: newOrder.customerName || 'Pelanggan Baru',
                    phone: newOrder.customerPhone, // Can be null/empty
                    tier: 'regular',
                    points: 0,
                    totalSpent: 0,
                    visitCount: 0,
                    createdAt: new Date()
                });
            } else {
                console.log("✅ Customer Found:", customer.name);
            }

            // Link customer to order
            if (newOrder.customerId !== customer.id) {
                newOrder.customerId = customer.id;
                await newOrder.save();
                console.log("🔗 Order Linked to Customer ID:", customer.id);
            }

            // Sync Name/Phone if missing in customer
            if (newOrder.customerName && (!customer.name || customer.name === 'Pelanggan Baru')) {
                customer.name = newOrder.customerName;
            }
            if (newOrder.customerPhone && !customer.phone) {
                customer.phone = newOrder.customerPhone;
            }

            // Calculate Loyalty Points
            if (newOrder.status === 'done' || newOrder.paymentStatus === 'paid') {
                console.log("💎 Calculating Loyalty Points");
                try {
                    const settings = await Settings.findOne({ key: 'businessSettings' });
                    const ratio = settings?.loyaltySettings?.pointRatio || 10000;
                    const pointsEarned = Math.floor(newOrder.total / ratio);

                    customer.totalSpent += newOrder.total;
                    customer.visitCount += 1;
                    customer.points += pointsEarned;
                    customer.lastOrderDate = new Date();
                    if (pointsEarned > 0) customer.lastPointsEarned = new Date();
                    console.log(`💎 Awarded ${pointsEarned} points`);
                } catch (loyaltyErr) {
                    console.error("⚠️ Loyalty Calculation Error:", loyaltyErr);
                }
            }

            await customer.save();
            console.log("✅ Customer Updated/Saved");
        } else {
            console.log("ℹ️ No valid customer info provided, skipping customer logic");
        }

        console.log("🎉 Order Creation Complete");
        res.status(201).json(newOrder);

    } catch (err) {
        console.error('❌ Create Order Exception:', err);
        console.error('Stack:', err.stack);
        if (err.name === 'ValidationError') {
            console.error('vErr:', JSON.stringify(err.errors, null, 2));
        }
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

exports.getOrders = async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const orders = await Order.find().sort({ timestamp: -1 }).limit(limit);
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findOne({ id: req.params.id });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { status, paymentStatus } = req.body;
        const updateData = {};
        if (status) updateData.status = status;
        if (paymentStatus) updateData.paymentStatus = paymentStatus;

        const order = await Order.findOneAndUpdate({ id: req.params.id }, updateData, { new: true });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.payOrder = async (req, res) => {
    try {
        const { paymentMethod, note } = req.body;
        const order = await Order.findOne({ id: req.params.id });

        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.paymentStatus === 'paid') return res.status(400).json({ error: 'Order already paid' });

        // 1. Update Order
        order.paymentStatus = 'paid';
        order.paymentMethod = paymentMethod || 'cash';
        order.status = 'done'; // Complete the order
        if (note) order.note = note;

        // 2. Update Shift (Record Sales)
        const activeShift = await Shift.findOne({ endTime: null });
        if (activeShift) {
            // Link Order to Shift ID (for reporting)
            order.shiftId = activeShift.id;

            if (order.paymentMethod === 'cash') {
                activeShift.cashSales = (activeShift.cashSales || 0) + order.total;
                activeShift.currentCash = (activeShift.currentCash || 0) + order.total;
            } else {
                activeShift.nonCashSales = (activeShift.nonCashSales || 0) + order.total;
                activeShift.currentNonCash = (activeShift.currentNonCash || 0) + order.total;
            }

            if (!activeShift.orders) activeShift.orders = [];
            activeShift.orders.push(order.id);

            await activeShift.save();
        }

        // 3. Update Customer Loyalty & Auto-create
        let customer = null;
        if (order.customerId && order.customerId !== 'guest') {
            customer = await Customer.findOne({ id: order.customerId });
        } else if ((order.customerPhone && order.customerPhone.length > 5) || (order.customerName && order.customerName !== 'Pelanggan Baru')) {
            // Find by Phone or Name
            const query = [];
            if (order.customerPhone && order.customerPhone.length > 5) {
                query.push({ phone: order.customerPhone });
            }
            if (!order.customerPhone && order.customerName) {
                query.push({ name: new RegExp('^' + order.customerName.trim() + '$', 'i') });
            }

            if (query.length > 0) {
                customer = await Customer.findOne({ $or: query });
            }

            if (!customer) {
                // Create new Customer
                customer = new Customer({
                    id: `cust_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    name: order.customerName || 'Pelanggan Baru',
                    phone: order.customerPhone,
                    tier: 'regular',
                    createdAt: new Date()
                });
            }
            // Link to order
            order.customerId = customer.id;
        }

        if (customer) {
            const settings = await Settings.findOne({ key: 'businessSettings' });
            const ratio = settings?.loyaltySettings?.pointRatio || 10000;
            const pointsEarned = Math.floor(order.total / ratio);

            customer.totalSpent += order.total;
            customer.visitCount += 1;
            customer.points += pointsEarned;
            customer.lastOrderDate = new Date();
            if (pointsEarned > 0) customer.lastPointsEarned = new Date();

            await customer.save();
        }

        await order.save();

        res.json(order);
    } catch (err) {
        console.error('Pay Order Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
