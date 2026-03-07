const Order = require('../models/Order');
const Table = require('../models/Table');
const axios = require('axios');

// Services (Sprint 2 Refactor — extracted from this controller)
const OrderService = require('../services/OrderService');
const CustomerService = require('../services/CustomerService');
const ShiftService = require('../services/ShiftService');

// Stock deduction & reversion are now in OrderService.deductStock() / OrderService.revertStock()


const checkPhone = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin
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

const createOrder = async (req, res) => {
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

        // Attach Payment Proof (LOCAL STORAGE)
        if (req.file) {
            try {
                // File sudah disimpan oleh multer ke disk
                // Buat URL path untuk akses public
                const imageUrl = `/uploads/payments/${req.file.filename}`;

                console.log("💾 Payment proof saved locally:", imageUrl);
                orderData.paymentProofImage = imageUrl;
            } catch (uploadErr) {
                console.error("❌ Payment Proof Save Error:", uploadErr);
                return res.status(500).json({ error: 'Failed to save payment proof image' });
            }
        }

        // GENERATE ORDER ID
        if (!orderData.id) {
            orderData.id = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        }
        console.log("🆔 Order ID:", orderData.id);

        // 1. Calculate HPP (via OrderService)
        console.log("1️⃣ Starting HPP Calculation");
        const { enrichedItems, orderTotalHPP } = await OrderService.calculateHPP(orderData.items);
        console.log("✅ HPP Calculation Complete. Total HPP:", orderTotalHPP);

        // 2. Create Order Object (stockDeducted = false by default)
        console.log("2️⃣ Saving Order to DB (Stock NOT deducted yet)");

        // Handle voucher (via OrderService — atomic with quota guard)
        if (orderData.voucherCode) {
            await OrderService.applyVoucher(orderData.voucherCode);
        }

        const newOrder = new Order({
            ...orderData,
            phone: orderData.customerPhone || orderData.phone, // Store phone for loyalty tracking
            items: enrichedItems,
            timestamp: Date.now(),
            stockDeducted: false, // Stock will be deducted when status changes to 'process'
            // TenantId will be automatically set by the plugin
            voucherCode: orderData.voucherCode || null,
            voucherDiscount: Number(orderData.voucherDiscount) || 0,
            subtotal: Number(orderData.subtotal) || orderData.total,
        });

        await newOrder.save();
        console.log("✅ Order Saved Successfully");

        if (newOrder.status === 'done' || newOrder.paymentStatus === 'paid') {
            // Record sale in shift (via ShiftService — atomic)
            const shiftId = await ShiftService.recordSale(newOrder.id, newOrder.total, newOrder.paymentMethod);
            if (shiftId) {
                await Order.updateOne({ _id: newOrder._id }, { $set: { shiftId } });
                newOrder.shiftId = shiftId;
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
                // Tenant scoping is automatic via plugin
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

        // 4. Update Customer Loyalty (via CustomerService)
        console.log("4️⃣ Processing Customer Logic");
        const customer = await CustomerService.findOrCreateCustomer(newOrder);
        if (customer) {
            // Link customer to order
            if (newOrder.customerId !== customer.id) {
                await Order.updateOne({ _id: newOrder._id }, { $set: { customerId: customer.id } });
                newOrder.customerId = customer.id;
                console.log("🔗 Order Linked to Customer ID:", customer.id);
            }

            // Build sync fields
            const syncFields = {};
            if (newOrder.customerName && (!customer.name || customer.name === 'Pelanggan Baru')) {
                syncFields.name = newOrder.customerName;
            }
            if (newOrder.customerPhone && !customer.phone) {
                syncFields.phone = newOrder.customerPhone;
            }

            if (newOrder.status === 'done' || newOrder.paymentStatus === 'paid') {
                try {
                    await CustomerService.awardLoyaltyPoints(customer, newOrder.total, syncFields);
                } catch (loyaltyErr) {
                    console.error("⚠️ Loyalty Calculation Error:", loyaltyErr);
                }
            } else {
                await CustomerService.syncCustomerFields(customer, syncFields);
            }
            console.log("✅ Customer Updated/Saved");
        } else {
            console.log("ℹ️ No valid customer info provided, skipping customer logic");
        }

        console.log("🎉 Order Creation Complete");

        // SEND WA NOTIFICATION VIA N8N WEBHOOK
        try {
            const webhookUrl = process.env.N8N_WEBHOOK_ORDER_CREATE || 'http://76.13.196.116:5677/webhook/76a56ec0-0deb-4ebe-9c03-3a1981506916';

            // Format string dari item pesanan
            const itemsString = newOrder.items.map(item => `${item.qty || item.count}x ${item.name}`).join(', ');

            const payload = {
                name: newOrder.customerName || 'Pelanggan',
                item: itemsString,
                link_nota: `https://superkafe.com/nota/${newOrder.id}`
            };

            // Eksekusi POST tanpa await (non-blocking) agar performa kasir tetap cepat
            axios.post(webhookUrl, payload).catch(err => {
                console.error('⚠️ n8n Webhook Error (Non-blocking):', err.message);
            });
            console.log("📡 Triggered WA notification via n8n webhook");

        } catch (webhookErr) {
            console.error('⚠️ Failed to trigger WA notification:', webhookErr);
        }

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

const getOrders = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin
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

const deleteOrder = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin - only deletes orders in current tenant
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

const getOrderById = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin
        const order = await Order.findOne({ id: req.params.id });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin - only updates orders in current tenant
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
            await OrderService.deductStock(order);
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
                await OrderService.revertStock(order);
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

        // TRIGGER WA NOTIFICATION: PESANAN SELESAI
        if (status === 'done' && previousStatus !== 'done') {
            try {
                const webhookUrl = process.env.N8N_WEBHOOK_ORDER_DONE || 'http://76.13.196.116:5677/webhook/ce3ade2e-9516-43ed-9ca8-2913407877d1';

                let phoneFormatted = '';
                if (order.phone) {
                    phoneFormatted = order.phone.replace(/\D/g, ''); // hapus non-digit
                    if (phoneFormatted.startsWith('0')) {
                        phoneFormatted = '62' + phoneFormatted.substring(1);
                    }
                }

                // Webhook hanya dikirim jika ada nomor HP
                if (phoneFormatted) {
                    const payload = {
                        phone: phoneFormatted,
                        name: order.customerName || 'Pelanggan',
                        link_nota: `https://superkafe.com/nota/${order.id}`
                    };

                    axios.post(webhookUrl, payload, {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }).catch(err => {
                        console.error('⚠️ n8n Webhook (Order Done) Error:', err.message);
                    });
                    console.log("📡 Triggered WA Order Done notification via n8n webhook");
                } else {
                    console.log("ℹ️ No phone number available to send WA Order Done notification.");
                }
            } catch (webhookErr) {
                console.error('⚠️ Failed to trigger WA Order Done notification:', webhookErr);
            }
        }

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
const payOrder = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin
        const { paymentMethod, note } = req.body;
        const order = await Order.findOne({ id: req.params.id });

        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.paymentStatus === 'paid') return res.status(400).json({ error: 'Order already paid' });

        // 1. Update Order
        order.paymentStatus = 'paid';
        order.paymentMethod = paymentMethod || 'cash';
        // order.status = 'done'; // REMOVED: Do not auto-complete. Let frontend handle flow (Pay -> Process -> Done)
        if (note) order.note = note;

        // 2. Update Shift (via ShiftService)
        const shiftId = await ShiftService.recordSale(order.id, order.total, order.paymentMethod);
        if (shiftId) {
            order.shiftId = shiftId;
        }

        // 3. Update Customer Loyalty (via CustomerService)
        const customer = await CustomerService.findOrCreateCustomer(order);
        if (customer) {
            if (order.customerId !== customer.id) {
                order.customerId = customer.id;
            }
            try {
                await CustomerService.awardLoyaltyPoints(customer, order.total);
            } catch (loyaltyErr) {
                console.error('Loyalty Error:', loyaltyErr);
            }
        }

        await order.save();

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
const getTodayOrders = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin
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
const getPendingCount = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin
        // Exact same logic as Frontend Kasir.jsx
        const todayStr = new Date().toISOString().split('T')[0];

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Use MongoDB countDocuments instead of loading all orders into memory
        const count = await Order.countDocuments({
            status: 'new',
            is_archived_from_pos: { $ne: true },
            $or: [
                { date: todayStr },
                { timestamp: { $gte: startOfDay.getTime(), $lte: endOfDay.getTime() } }
            ]
        });

        console.log(`[getPendingCount] Today: ${todayStr}, Count: ${count}`);

        res.json({ count });
    } catch (error) {
        console.error('Get Pending Count Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Merge Orders Feature
const mergeOrders = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin - only merges orders in current tenant
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

module.exports = {
    checkPhone,
    createOrder,
    getOrders,
    deleteOrder,
    getOrderById,
    updateOrderStatus,
    payOrder,
    getTodayOrders,
    getPendingCount,
    mergeOrders
};
