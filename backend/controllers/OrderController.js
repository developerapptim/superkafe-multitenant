const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');
const StockHistory = require('../models/StockHistory');
const Shift = require('../models/Shift');
const Customer = require('../models/Customer');
const Settings = require('../models/Settings');
const Voucher = require('../models/Voucher');
const Table = require('../models/Table');

// =========================================================
// HELPER: Deduct Stock when order status changes to 'process'
// =========================================================
async function deductStockForOrder(order) {
    console.log(`📉 [DEDUCT] Starting stock deduction for Order: ${order.id}`);

    const recipes = await Recipe.find();
    const ingredients = await Ingredient.find();
    const allMenuItems = await MenuItem.find();

    const ingredientMap = new Map();
    ingredients.forEach(i => ingredientMap.set(String(i.id), i));

    const recipeMap = new Map();
    recipes.forEach(r => recipeMap.set(String(r.menuId), r.ingredients));

    const menuItemMap = new Map();
    allMenuItems.forEach(m => {
        menuItemMap.set(String(m.id), m);
        menuItemMap.set(String(m._id), m);
    });

    // Helper: deduct stock for a single menu item
    const deductSingleItem = async (menuId, qtyOrdered, itemName, isFromBundle = false) => {
        const recipeIngredients = recipeMap.get(menuId);
        if (!recipeIngredients) return;

        for (const ri of recipeIngredients) {
            const ingKey = String(ri.ing_id);
            const ingData = ingredientMap.get(ingKey);

            let required = Number(ri.jumlah) || 0;

            if (ingData && (ingData.type === 'physical' || !ingData.type)) {
                const qtyToDeduct = required * qtyOrdered;

                if (!isNaN(qtyToDeduct) && qtyToDeduct > 0) {
                    const oldStock = Number(ingData.stok) || 0;
                    ingData.stok = oldStock - qtyToDeduct;
                    await ingData.save();

                    const label = isFromBundle ? `(Bundle Component)` : '';
                    console.log(`   📦 ${ingData.nama} ${label}: ${oldStock} → ${ingData.stok} (-${qtyToDeduct})`);

                    // Log Stock History
                    const history = new StockHistory({
                        id: `hist_out_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        ing_id: ingData.id,
                        ingName: ingData.nama,
                        type: 'out',
                        qty: qtyToDeduct,
                        stokSebelum: oldStock,
                        stokSesudah: ingData.stok,
                        note: `Order ${order.id} (Process) - ${itemName} ${label}`,
                        date: new Date().toISOString().split('T')[0],
                        time: new Date().toLocaleTimeString('id-ID', { hour12: false })
                    });
                    await history.save();
                }
            }
        }
    };

    if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
            const menuId = String(item.id);
            const qtyOrdered = Number(item.qty || item.count) || 0;
            const menuItem = menuItemMap.get(menuId);

            // BUNDLE LOGIC: Jika produk bundle, kurangi stok item penyusunnya
            if (menuItem && menuItem.is_bundle && menuItem.bundle_items && menuItem.bundle_items.length > 0) {
                console.log(`   🎁 Bundle detected: ${item.name}, deducting component stock...`);
                for (const bundleComponent of menuItem.bundle_items) {
                    const componentId = String(bundleComponent.product_id);
                    const componentMenu = menuItemMap.get(componentId);
                    const componentMenuId = componentMenu ? String(componentMenu.id) : componentId;
                    const componentQty = (bundleComponent.quantity || 1) * qtyOrdered;
                    const componentName = componentMenu ? componentMenu.name : `Component ${componentId}`;

                    await deductSingleItem(componentMenuId, componentQty, componentName, true);
                }
            } else {
                // Non-bundle: deduct normally
                await deductSingleItem(menuId, qtyOrdered, item.name);
            }
        }
    }
    console.log(`✅ [DEDUCT] Stock deduction complete for Order: ${order.id}`);
}

// =========================================================
// HELPER: Revert Stock when order is cancelled after processing
// =========================================================
async function revertStockForOrder(order) {
    console.log(`📈 [REVERT] Starting stock reversion for Order: ${order.id}`);

    const recipes = await Recipe.find();
    const ingredients = await Ingredient.find();

    const ingredientMap = new Map();
    ingredients.forEach(i => ingredientMap.set(String(i.id), i));

    const recipeMap = new Map();
    recipes.forEach(r => recipeMap.set(String(r.menuId), r.ingredients));

    if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
            const menuId = String(item.id);
            const recipeIngredients = recipeMap.get(menuId);

            if (recipeIngredients) {
                for (const ri of recipeIngredients) {
                    const ingKey = String(ri.ing_id);
                    const ingData = ingredientMap.get(ingKey);

                    let required = Number(ri.jumlah) || 0;
                    let qtyOrdered = Number(item.qty || item.count) || 0;

                    if (ingData && (ingData.type === 'physical' || !ingData.type)) {
                        const qtyToRevert = required * qtyOrdered;

                        if (!isNaN(qtyToRevert) && qtyToRevert > 0) {
                            const oldStock = Number(ingData.stok) || 0;
                            ingData.stok = oldStock + qtyToRevert;
                            await ingData.save();

                            console.log(`   📦 ${ingData.nama}: ${oldStock} → ${ingData.stok} (+${qtyToRevert})`);

                            // Log Stock History
                            const history = new StockHistory({
                                id: `hist_in_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                ing_id: ingData.id,
                                ingName: ingData.nama,
                                type: 'in',
                                qty: qtyToRevert,
                                stokSebelum: oldStock,
                                stokSesudah: ingData.stok,
                                note: `Order ${order.id} (Cancelled) - ${item.name} REVERTED`,
                                date: new Date().toISOString().split('T')[0],
                                time: new Date().toLocaleTimeString('id-ID', { hour12: false })
                            });
                            await history.save();
                        }
                    }
                }
            }
        }
    }
    console.log(`✅ [REVERT] Stock reversion complete for Order: ${order.id}`);
}

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

        // Attach Payment Proof (Cloudinary Stream Upload)
        if (req.file) {
            const cloudinary = require('../utils/cloudinary');
            const streamUpload = (buffer) => {
                return new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        {
                            folder: 'superkafe-payments',
                            resource_type: 'image',
                            transformation: [
                                { width: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
                            ]
                        },
                        (error, result) => {
                            if (result) {
                                resolve(result);
                            } else {
                                reject(error);
                            }
                        }
                    );
                    stream.write(buffer);
                    stream.end();
                });
            };

            try {
                console.log("☁️ Uploading payment proof to Cloudinary...");
                const result = await streamUpload(req.file.buffer);
                console.log("✅ Cloudinary Upload Success:", result.secure_url);
                orderData.paymentProofImage = result.secure_url;
            } catch (uploadErr) {
                console.error("❌ Cloudinary Upload Error:", uploadErr);
                return res.status(500).json({ error: 'Failed to upload payment proof image' });
            }
        }

        // GENERATE ORDER ID
        if (!orderData.id) {
            orderData.id = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        }
        console.log("🆔 Order ID:", orderData.id);

        // 1. Calculate HPP ONLY (Stock deduction moved to 'process' status)
        console.log("1️⃣ Starting HPP Calculation (No Stock Deduction at Creation)");
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

                        let required = Number(ri.jumlah) || 0;

                        if (ingData) {
                            // Calculate HPP
                            const costPerUnit = (ingData.isi_prod && ingData.isi_prod > 0)
                                ? (ingData.harga_beli / ingData.isi_prod)
                                : ingData.harga_beli;
                            const validCost = isNaN(costPerUnit) ? 0 : costPerUnit;
                            itemHPP += (validCost * required);
                        }
                    }
                }

                const qtyOrderedFinal = Number(item.qty || item.count) || 0;
                orderTotalHPP += (itemHPP * qtyOrderedFinal);

                enrichedItems.push({
                    ...item,
                    hpp_locked: itemHPP
                });
            }
        }
        console.log("✅ HPP Calculation Complete. Total HPP:", orderTotalHPP);

        // 2. Create Order Object (stockDeducted = false by default)
        console.log("2️⃣ Saving Order to DB (Stock NOT deducted yet)");

        // Handle voucher: increment used_count if voucher was applied
        if (orderData.voucherCode) {
            try {
                await Voucher.findOneAndUpdate(
                    { code: orderData.voucherCode.toUpperCase() },
                    { $inc: { used_count: 1 } }
                );
                console.log(`🎫 Voucher ${orderData.voucherCode} used_count incremented`);
            } catch (voucherErr) {
                console.error('⚠️ Voucher update error (non-blocking):', voucherErr);
            }
        }

        const newOrder = new Order({
            ...orderData,
            phone: orderData.customerPhone || orderData.phone, // Store phone for loyalty tracking
            items: enrichedItems,
            timestamp: Date.now(),
            stockDeducted: false, // Stock will be deducted when status changes to 'process'
            voucherCode: orderData.voucherCode || null,
            voucherDiscount: Number(orderData.voucherDiscount) || 0,
            subtotal: Number(orderData.subtotal) || orderData.total,
        });

        await newOrder.save();
        console.log("✅ Order Saved Successfully");

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

        // 3.5 Update Table Status (if dine_in and tableNumber exists)
        if (newOrder.orderType === 'dine_in' && newOrder.tableNumber) {
            console.log(`🔍 Checking Table Update for Order ${newOrder.id}`);
            console.log(`   - Order Type: ${newOrder.orderType}`);
            console.log(`   - Table Number: ${newOrder.tableNumber} (Type: ${typeof newOrder.tableNumber})`);

            try {
                // Find table by number (or id if you store id in tableNumber, but schema says number)
                // In your frontend, you send table.number as value.
                const table = await Table.findOne({ number: newOrder.tableNumber.toString() }); // Force string comparison
                if (table) {
                    console.log(`   - Table Found: ${table.number} (ID: ${table.id})`);
                    console.log(`   - Current Status: ${table.status}`);

                    table.status = 'occupied';
                    table.currentOrderId = newOrder.id; // Link active order
                    if (!table.currentOrderIds) table.currentOrderIds = [];
                    if (!table.currentOrderIds.includes(newOrder.id)) table.currentOrderIds.push(newOrder.id);
                    table.occupiedSince = new Date();
                    await table.save();
                    console.log(`✅ Table ${newOrder.tableNumber} status updated to OCCUPIED`);
                } else {
                    console.log(`⚠️ Table ${newOrder.tableNumber} NOT FOUND in database`);
                }
            } catch (tblErr) {
                console.error("⚠️ Failed to update table status:", tblErr);
            }
        } else {
            console.log(`ℹ️ Skipping Table Update: Type=${newOrder.orderType}, Table=${newOrder.tableNumber}`);
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

                    // 1. Get Settings & Thresholds
                    const thresholds = settings?.loyaltySettings?.tierThresholds || { silver: 500000, gold: 2000000 };
                    const ratio = settings?.loyaltySettings?.pointRatio || 10000;

                    // 2. Determine Current Tier (based on totalSpent BEFORE this order)
                    let currentTier = 'bronze';
                    if (customer.totalSpent >= thresholds.gold) currentTier = 'gold';
                    else if (customer.totalSpent >= thresholds.silver) currentTier = 'silver';

                    // 3. Determine Multiplier
                    let multiplier = 1;
                    if (currentTier === 'gold') multiplier = 1.5;
                    else if (currentTier === 'silver') multiplier = 1.25;

                    console.log(`📊 Tier: ${currentTier}, Multiplier: ${multiplier}x`);

                    // 4. Calculate Points
                    const basePoints = Math.floor(newOrder.total / ratio);
                    const pointsEarned = Math.floor(basePoints * multiplier);

                    customer.totalSpent += newOrder.total;
                    customer.visitCount += 1;
                    customer.points += pointsEarned;
                    customer.lastOrderDate = new Date();
                    // Update tier in DB just in case, though calculated dynamically in frontend
                    customer.tier = currentTier;

                    if (pointsEarned > 0) customer.lastPointsEarned = new Date();
                    console.log(`💎 Awarded ${pointsEarned} points (${basePoints} base * ${multiplier}x)`);
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

        // Emit Socket Event
        const io = req.app.get('io');
        if (io) {
            io.emit('orders:update', { action: 'create', order: newOrder });
            console.log('📡 Emitted orders:update (create)');
        }

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
        const { startDate, endDate, status, limit, page } = req.query;
        let query = {};

        // Date Filter
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.timestamp.$gte = start.getTime();
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.timestamp.$lte = end.getTime();
            }
        }

        // Status Filter
        if (status && status !== 'all') {
            query.status = status;
        }

        // Pagination Logic
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10; // Default limit 10
        const skip = (pageNum - 1) * limitNum;

        // Count Total Documents for Pagination Metadata
        const totalItems = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalItems / limitNum);

        // Fetch Paginated Data
        const orders = await Order.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(); // Use lean() for performance

        // Return Structured Response
        res.json({
            data: orders,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems,
                hasMore: pageNum < totalPages
            }
        });

    } catch (err) {
        console.error('Get Orders Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findOne({ id: orderId });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Security Check: Prevent deleting Paid/Done orders
        if (order.paymentStatus === 'paid' || order.status === 'done') {
            return res.status(403).json({ error: 'Tidak dapat menghapus pesanan yang sudah lunas/selesai demi integritas data.' });
        }

        // Double check: Only allow specific statuses
        const allowedStatuses = ['new', 'process', 'pending', 'cancel', 'merged'];
        if (!allowedStatuses.includes(order.status) && order.paymentStatus !== 'unpaid') {
            return res.status(403).json({ error: 'Status pesanan tidak valid untuk dihapus.' });
        }

        await Order.deleteOne({ id: orderId });
        console.log(`🗑️ Order ${orderId} deleted by user`);

        // Emit Socket Event
        const io = req.app.get('io');
        if (io) {
            io.emit('orders:update', { action: 'delete', orderId });
            console.log('📡 Emitted orders:update (delete)');
        }

        res.json({ message: 'Pesanan berhasil dihapus' });
    } catch (err) {
        console.error('Delete Order Error:', err);
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
        const order = await Order.findOne({ id: req.params.id });

        if (!order) return res.status(404).json({ error: 'Order not found' });

        const previousStatus = order.status;

        // Apply updates
        if (status) order.status = status;
        if (paymentStatus) order.paymentStatus = paymentStatus;

        // ========= STOCK LOGIC =========
        // Deduct stock when status changes to 'process' and stock hasn't been deducted yet
        if (status === 'process' && !order.stockDeducted) {
            console.log(`🔄 Status -> 'process': Triggering stock deduction for Order ${order.id}`);
            await deductStockForOrder(order);
            order.stockDeducted = true;
        }

        // Revert stock when status changes to 'cancel'
        if (status === 'cancel') {
            // Save cancellation reason
            if (req.body.cancellationReason) {
                order.cancellationReason = req.body.cancellationReason;
            }

            // Revert stock if previously deducted
            if (order.stockDeducted) {
                console.log(`🔄 Status -> 'cancel': Triggering stock reversion for Order ${order.id}`);
                await revertStockForOrder(order);
                order.stockDeducted = false;
            }

            // Auto-Refund logic: If Paid -> Refunded
            if (order.paymentStatus === 'paid') {
                console.log(`💸 Order ${order.id} was PAID. Marking as REFUNDED due to cancellation.`);
                order.paymentStatus = 'refunded'; // Or 'void' based on business rule. "Refunded" is clearer.
            }
        }
        // ================================

        await order.save();
        console.log(`✅ Order ${order.id} status updated: ${previousStatus} → ${status || previousStatus}`);

        // Emit Socket Event
        const io = req.app.get('io');
        if (io) {
            io.emit('orders:update', { action: 'update', orderId: order.id, status: status || previousStatus });
            console.log('📡 Emitted orders:update (update)');
        }

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
        // order.status = 'done'; // REMOVED: Do not auto-complete. Let frontend handle flow (Pay -> Process -> Done)
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

        // Emit Socket Event
        // Emit Socket Event
        const io = req.app.get('io');
        if (io) {
            io.emit('orders:update', { action: 'pay', orderId: order.id });
            console.log('📡 Emitted orders:update (pay)');
        }

        res.json(order);
    } catch (err) {
        console.error('Pay Order Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get orders for today (public/customer usage to sync status)
exports.getTodayOrders = async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Fetch minimal fields for status sync
        const orders = await Order.find({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        }).select('id status total paymentStatus tableNumber timestamp createdAt');

        res.json(orders);
    } catch (err) {
        console.error('Get Today Orders Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get Pending Orders Count (Today Only) - Sync with POS Frontend Logic
exports.getPendingCount = async (req, res) => {
    try {
        // Exact same logic as Frontend Kasir.jsx
        const today = new Date().toISOString().split('T')[0];

        // Get ALL orders and filter manually to match EXACTLY what Frontend does
        const allOrders = await Order.find({}).lean();

        const filteredOrders = allOrders.filter(o => {
            // Not archived
            if (o.is_archived_from_pos) return false;

            // Status must be 'new' (for Baru tab)
            if (o.status !== 'new') return false;

            // Date check - Sync with POS strict filter
            const orderDate = o.date || (o.timestamp && new Date(o.timestamp).toISOString().split('T')[0]);
            if (orderDate !== today) return false;

            return true;
        });

        console.log(`[getPendingCount] Today: ${today}, Count: ${filteredOrders.length}`);

        res.json({ count: filteredOrders.length });
    } catch (error) {
        console.error('Get Pending Count Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Merge Orders Feature
exports.mergeOrders = async (req, res) => {
    try {
        const { orderIds, mergedCustomerName, mergedTableNumber, mergedBy } = req.body;

        // Validation
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length < 2) {
            return res.status(400).json({ message: 'Minimal 2 pesanan untuk digabung' });
        }

        // Fetch original orders
        const orders = await Order.find({ id: { $in: orderIds } });

        if (orders.length !== orderIds.length) {
            return res.status(404).json({ message: 'Beberapa pesanan tidak ditemukan' });
        }

        // Check if any order is already merged or not active
        const invalidOrders = orders.filter(o => o.status === 'merged' || o.status === 'cancel' || o.isMerged);
        if (invalidOrders.length > 0) {
            return res.status(400).json({ message: 'Beberapa pesanan tidak valid untuk digabung (sudah digabung/batal)' });
        }

        // Combine items
        // We use flatMap to get all items from all orders
        const allItems = orders.flatMap(order => order.items || []);

        // Calculate Grand Total
        // We recalculate from items to be safe, or sum up order totals
        const grandTotal = orders.reduce((sum, order) => sum + (order.total || 0), 0);

        // Generate ID for new merged order
        const newOrderId = `ORD-M-${Date.now()}`;
        const now = new Date();

        // Create Merged Order
        const mergedOrder = new Order({
            id: newOrderId,
            customerName: mergedCustomerName || orders[0].customerName || 'Gabungan', // Use provided name or first order's name
            tableNumber: mergedTableNumber || orders[0].tableNumber,
            items: allItems,
            total: grandTotal,
            status: 'new', // Default to new/pending
            paymentStatus: 'unpaid',
            timestamp: now.getTime(),
            date: now.toISOString().split('T')[0],
            time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),

            // Merge Info
            isMerged: true,
            originalOrders: orderIds,
            mergedBy: mergedBy || 'Staff',
            mergedAt: now,

            // Flags
            stockDeducted: orders.some(o => o.stockDeducted) // If any original order had stock deducted, mark this as true? 
            // Better logic: If stock WAS deducted in original, we shouldn't deduct again.
            // But if we create a NEW order, the system might try to deduct again when processed.
            // Strategy: We keep stockDeducted as false, but maybe we should ensure original orders don't double count?
            // Actually, if we merge 'new' orders, stock hasn't been deducted yet.
            // If we merge 'process' orders, stock HAS been deducted.
            // Let's assume we merge pending/new orders mostly.
        });

        await mergedOrder.save();

        // Update Original Orders
        await Order.updateMany(
            { id: { $in: orderIds } },
            {
                status: 'merged', // Mark as merged
                mergedInto: newOrderId,
                is_archived_from_pos: true // Hide from POS list
            }
        );

        res.status(201).json({
            message: 'Pesanan berhasil digabung',
            mergedOrder
        });

        // Emit Socket Event
        const io = req.app.get('io');
        if (io) {
            io.emit('orders:update', { action: 'merge', mergedOrder });
            console.log('📡 Emitted orders:update (merge)');
        }

    } catch (error) {
        console.error('Merge Orders Error:', error);
        res.status(500).json({ message: error.message });
    }
};
