const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');
const StockHistory = require('../models/StockHistory');
const Shift = require('../models/Shift');
const Customer = require('../models/Customer');
const Settings = require('../models/Settings');

exports.createOrder = async (req, res) => {
    try {
        const orderData = req.body;

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
                                const qtyToDeduct = required * item.count; // item.count is qty ordered

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

                orderTotalHPP += (itemHPP * item.count);

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

        // 4. Update Customer Loyalty (if customer attached)
        if (newOrder.customerId && newOrder.customerId !== 'guest') {
            const customer = await Customer.findOne({ id: newOrder.customerId });
            if (customer) {
                // Fetch Settings for point ratio
                const settings = await Settings.findOne({ key: 'businessSettings' });
                const ratio = settings?.loyaltySettings?.pointRatio || 10000;
                const pointsEarned = Math.floor(newOrder.total / ratio);

                customer.totalSpent += newOrder.total;
                customer.visitCount += 1;
                customer.points += pointsEarned;
                customer.lastOrderDate = new Date();
                if (pointsEarned > 0) customer.lastPointsEarned = new Date();

                await customer.save();
            }
        }

        res.status(201).json(newOrder);

    } catch (err) {
        console.error('Create Order Error:', err);
        res.status(500).json({ error: 'Server error' });
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
