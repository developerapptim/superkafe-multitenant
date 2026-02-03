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
        let orderData = req.body;

        // PARSE IF STRING (Multer stores non-file fields as strings in req.body)
        if (req.body.orderData && typeof req.body.orderData === 'string') {
            try {
                orderData = JSON.parse(req.body.orderData);
            } catch (err) {
                return res.status(400).json({ error: 'Invalid order data format' });
            }
        }

        // Attach Payment Proof if uploaded
        if (req.file) {
            orderData.paymentProofImage = `/uploads/payments/${req.file.filename}`;
        }

        // 1. Calculate HPP & Deduct Stock
        // We need to fetch Recipes and Ingredients
        const recipes = await Recipe.find();
        const ingredients = await Ingredient.find();

        const ingredientMap = new Map();
        ingredients.forEach(i => ingredientMap.set(String(i.id), i));

        const recipeMap = new Map();
        recipes.forEach(r => recipeMap.set(String(r.menuId), r.ingredients));

        let orderTotalHPP = 0;
        const enrichedItems = []; // Items with locked HPP

        // Process each item in the order
        if (orderData.items && Array.isArray(orderData.items)) {
            for (const item of orderData.items) {
                const menuId = String(item.id);
                const recipeIngredients = recipeMap.get(menuId);
                let itemHPP = 0;

                if (recipeIngredients) {
                    for (const ri of recipeIngredients) {
                        const ingKey = String(ri.ing_id);
                        const ingData = ingredientMap.get(ingKey);
                        const required = Number(ri.jumlah || 0);

                        if (ingData) {
                            // Calculate HPP for this ingredient
                            const costPerUnit = (ingData.isi_prod && ingData.isi_prod > 0)
                                ? (ingData.harga_beli / ingData.isi_prod)
                                : ingData.harga_beli;

                            itemHPP += (costPerUnit * required);

                            // DEDUCT STOCK (Only Physical)
                            if (ingData.type === 'physical' || !ingData.type) { // Default physical
                                const qtyOrdered = Number(item.qty || item.count || 0);
                                const qtyToDeduct = required * qtyOrdered;

                                // Update Ingredient
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
                            }
                        }
                    }
                }

                const qtyOrdered = Number(item.qty || item.count || 0);
                orderTotalHPP += (itemHPP * qtyOrdered);

                // Push to enriched items
                enrichedItems.push({
                    ...item,
                    hpp_locked: itemHPP // LOCK HPP HERE
                });
            }
        }

        // 2. Create Order Object
        const newOrder = new Order({
            ...orderData,
            items: enrichedItems,
            timestamp: Date.now()
        });

        await newOrder.save();

        // 3. Update Shift (Sales recording)
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

                await activeShift.save();
            }
        }

        // 4. Update Customer Loyalty & Auto-create Customer
        if (newOrder.customerPhone && newOrder.customerPhone.length > 5) {
            let customer = await Customer.findOne({
                $or: [{ id: newOrder.customerId }, { phone: newOrder.customerPhone }]
            });

            if (!customer) {
                // Create new Customer automatically
                customer = new Customer({
                    id: `cust_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    name: newOrder.customerName || 'Pelanggan Baru',
                    phone: newOrder.customerPhone,
                    tier: 'regular',
                    points: 0,
                    totalSpent: 0,
                    visitCount: 0,
                    createdAt: new Date()
                });
            }

            // Link customer to order if wasn't linked
            if (newOrder.customerId !== customer.id) {
                newOrder.customerId = customer.id;
                await newOrder.save();
            }

            // Sync/Update Customer Name if it was default/empty
            if (newOrder.customerName && (!customer.name || customer.name === 'Pelanggan Baru')) {
                customer.name = newOrder.customerName;
            }

            // Calculate Loyalty Points (ONLY IF PAID)
            // If unpaid, points will be added in payOrder
            if (newOrder.status === 'done' || newOrder.paymentStatus === 'paid') {
                const settings = await Settings.findOne({ key: 'businessSettings' });
                const ratio = settings?.loyaltySettings?.pointRatio || 10000;
                const pointsEarned = Math.floor(newOrder.total / ratio);

                customer.totalSpent += newOrder.total;
                customer.visitCount += 1;
                customer.points += pointsEarned;
                customer.lastOrderDate = new Date();
                if (pointsEarned > 0) customer.lastPointsEarned = new Date();
            }

            await customer.save();
        }

        res.status(201).json(newOrder);

    } catch (err) {
        console.error('❌ Create Order Error:', err);
        // Log validation errors specifically
        if (err.name === 'ValidationError') {
            console.error('Validation Details:', JSON.stringify(err.errors, null, 2));
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
        } else if (order.customerPhone && order.customerPhone.length > 5) {
            // If no ID linked, try finding by phone
            customer = await Customer.findOne({ phone: order.customerPhone });
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
