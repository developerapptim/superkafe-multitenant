const Order = require('../models/Order');
const Table = require('../models/Table');
const axios = require('axios');
const WANotification = require('../services/WhatsAppNotificationService');

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
            const voucherResult = await OrderService.applyVoucher(orderData.voucherCode);
            if (!voucherResult) {
                console.log(`❌ Rejecting Order ${orderData.id}: Voucher invalid or quota exceeded`);
                return res.status(400).json({ error: 'Kode voucher tidak valid, sudah kedaluwarsa, atau kuota habis.' });
            }
        }

        const newOrder = new Order({
            ...orderData,
            phone: orderData.customerPhone || orderData.phone, // Store phone for loyalty tracking
            items: enrichedItems,
            timestamp: Date.now(),
            stockDeducted: false, // Stock will be deducted when status changes to 'process'
            tenantId: req.tenant?.id || orderData.tenantId, // Explicitly set tenantId because plugin context might drop
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

        // SEND WA NOTIFICATION: PESANAN DIPROSES (fire-and-forget)
        WANotification.sendNotification(newOrder, 'proses');

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
            .select('-paymentProofImage -__v -updatedAt') // Exclude heavy image data from list view
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

        // TRIGGER WA NOTIFICATION: PESANAN SELESAI (fire-and-forget)
        if (status === 'done' && previousStatus !== 'done') {
            WANotification.sendNotification(order, 'selesai');
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

const voidOrder = async (req, res) => {
    try {
        const { pin, reason, employeeName, employeeRole } = req.body;
        const Employee = require('../models/Employee');

        // 1. PIN Check for non-managers
        if (employeeRole !== 'admin' && employeeRole !== 'owner' && employeeRole !== 'manager') {
            if (!pin) {
                return res.status(401).json({ error: 'PIN Supervisor dibutuhkan untuk membatalkan pesanan.' });
            }

            const bcrypt = require('bcryptjs');

            // Fetch all potential supervisors (we compare PIN manually to support both hash + plaintext)
            const supervisors = await Employee.find({
                role: { $in: ['admin', 'owner', 'manager'] },
                status: 'active'
            }).select('pin pin_code role').lean();

            let verified = false;
            let hasAnyPin = false;
            for (const sup of supervisors) {
                if (sup.pin || sup.pin_code) hasAnyPin = true;

                // Check bcrypt-hashed PIN first (new format)
                if (sup.pin) {
                    try {
                        const match = await bcrypt.compare(pin, sup.pin);
                        if (match) { verified = true; break; }
                    } catch (_) { /* skip */ }
                }
                // Fallback: legacy plaintext pin_code
                if (!verified && sup.pin_code && sup.pin_code === pin) {
                    verified = true;
                    break;
                }
            }

            if (!hasAnyPin) {
                return res.status(401).json({ error: 'Belum ada Supervisor yang mengatur PIN. Silakan buat PIN di menu Pegawai.' });
            }

            if (!verified) {
                return res.status(401).json({ error: 'PIN Supervisor tidak valid atau tidak memiliki akses.' });
            }
        }

        // 2. Fetch Order
        const order = await Order.findOne({ id: req.params.id });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (order.status === 'done' || order.status === 'cancel') {
            return res.status(400).json({ error: 'Pesanan tidak bisa di-void pada status saat ini.' });
        }

        const previousStatus = order.status;

        // 3. Revert stock if previously deducted
        if (order.stockDeducted) {
            console.log(`🔄 VOID: Triggering stock reversion for Order ${order.id}`);
            await OrderService.revertStock(order);
            order.stockDeducted = false;
        }

        // 4. Update status and audit trail
        order.status = 'cancel';
        order.cancellationReason = reason || 'Dibatalkan Kasir';
        order.cancelledBy = employeeName || 'Sistem';

        // Explicit Void fields
        order.isVoided = true;
        order.voidReason = reason;
        order.voidedBy = employeeName || 'Sistem';
        order.voidedAt = new Date();

        if (order.paymentStatus === 'paid') {
            order.paymentStatus = 'refunded';
            console.log(`💸 Order ${order.id} was PAID. Marking as REFUNDED.`);
        }

        await order.save();
        console.log(`❌ Order ${order.id} VOIDED by ${employeeName}`);

        // 5. Emit Socket Event
        const io = req.app.get('io');
        if (io) {
            io.emit('orders:update', { action: 'update', orderId: order.id, status: 'cancel' });
        }

        res.json({ success: true, order });
    } catch (err) {
        console.error('Void Order Error:', err);
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

/**
 * Public Nota Endpoint — serves HTML receipt accessible via WhatsApp link.
 * No authentication required so customers can view their receipt.
 * 
 * Displays contextual information:
 * - Order status: PESANAN DIPROSES / PESANAN SELESAI
 * - Payment status: BELUM BAYAR / LUNAS
 */
const getPublicNota = async (req, res) => {
    try {
        // Direct MongoDB query without tenant scoping (public endpoint)
        const order = await Order.collection.findOne({ id: req.params.id });
        if (!order) {
            return res.status(404).send(`
                <html><body style="font-family:sans-serif;text-align:center;padding:40px;">
                    <h2>😕 Nota Tidak Ditemukan</h2>
                    <p>Pesanan dengan ID ini tidak ditemukan.</p>
                </body></html>
            `);
        }

        // Determine statuses
        const isDone = order.status === 'done';
        const isPaid = order.paymentStatus === 'paid';

        const statusLabel = isDone ? 'PESANAN SELESAI' : 'PESANAN DIPROSES';
        const statusEmoji = isDone ? '✅' : '⏳';
        const statusColor = isDone ? '#15803d' : '#b45309';
        const statusBg = isDone ? '#dcfce7' : '#fef3c7';

        const paymentLabel = isPaid ? 'LUNAS' : 'BELUM BAYAR';
        const paymentColor = isPaid ? '#15803d' : '#dc2626';
        const paymentBg = isPaid ? '#dcfce7' : '#fee2e2';

        // Format currency
        const fmt = (val) => new Intl.NumberFormat('id-ID', {
            style: 'currency', currency: 'IDR', minimumFractionDigits: 0
        }).format(val || 0);

        // Format date
        const validDateVal = order.timestamp || order.date || order.createdAt;
        const orderDate = validDateVal
            ? new Date(validDateVal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
            : '-';
        const orderTime = order.time || (validDateVal
            ? new Date(validDateVal).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            : '-');

        // Build items HTML
        const items = order.items || [];
        const itemsHTML = items.map(item => {
            const qty = item.qty || item.count || 1;
            const price = item.price || 0;
            const subtotal = qty * price;
            return `
                <tr>
                    <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
                        <strong>${item.name || '-'}</strong>
                        ${item.note ? `<br><small style="color:#6b7280;">📝 ${item.note}</small>` : ''}
                    </td>
                    <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${qty}x</td>
                    <td style="padding:6px 0;text-align:right;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${fmt(subtotal)}</td>
                </tr>
            `;
        }).join('');

        // Fetch Settings for this tenant to get correct business name and address
        const Settings = require('../models/Settings');
        const settings = await Settings.findOne({ tenantId: order.tenantId }) || {};

        const businessName = settings.name || settings.businessName || 'SuperKafe';
        const address = settings.address || '';
        const phone = settings.phone ? `Telp: ${settings.phone}` : '';
        const wifiName = settings.wifiName || '';
        const wifiPassword = settings.wifiPassword || '';

        const html = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=80mm, initial-scale=1.0">
    <title>Struk #${(order.id || '').slice(-6)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', 'Lucida Console', monospace;
            font-size: 12px;
            width: 100%;
            max-width: 80mm;
            margin: 0 auto;
            padding: 2mm;
            background: white;
            color: black;
            line-height: 1.4;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .small { font-size: 10px; }
        .tiny { font-size: 8px; color: #666; }
        
        .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
        
        .header { text-align: center; margin-bottom: 10px; }
        .header img { max-height: 40px; margin-bottom: 5px; filter: grayscale(100%); }
        .header h1 { font-size: 16px; text-transform: uppercase; margin: 5px 0; }
        
        .info-row { display: flex; justify-content: space-between; margin: 2px 0; }
        
        .item { margin: 5px 0; }
        .item-name { font-weight: bold; }
        .item-detail { display: flex; justify-content: space-between; padding-left: 10px; }
        .item-note { font-size: 10px; font-style: italic; color: #555; padding-left: 10px; }
        
        .total-row { display: flex; justify-content: space-between; margin: 3px 0; }
        .grand-total { font-size: 14px; font-weight: bold; border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
        
        .status-badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; margin-top: 5px; text-align: center; }
        .status-paid { background: #dcfce7; color: #15803d; border: 1px solid #15803d; }
        .status-unpaid { background: #fee2e2; color: #dc2626; border: 1px solid #dc2626; }
        
        .order-badge { background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusColor}; }

        .wifi-box { margin-top: 15px; border: 1px dashed #666; padding: 8px; text-align: center; background: #fafafa; border-radius: 4px; }
        .wifi-box p { margin: 2px 0; font-size: 11px; }
        
        .footer { text-align: center; margin-top: 15px; margin-bottom: 20px;}
        
        /* Action buttons hidden when printing */
        .actions {
            margin-top: auto;
            display: flex;
            justify-content: center;
            padding: 10px 0;
            background: white;
            position: sticky;
            bottom: 0;
            border-top: 1px dashed #eee;
        }
        .btn-print {
            background: #e11d48;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-family: inherit;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            font-size: 12px;
            box-shadow: 0 4px 6px rgba(225, 29, 72, 0.2);
        }
        
        @media print {
            body { max-width: 100% !important; padding: 0 1mm !important; font-size: 11px !important; }
            .actions { display: none !important; }
            @page { margin: 0; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${businessName}</h1>
        ${address ? `<p class="small" style="white-space: pre-wrap;">${address}</p>` : ''}
        ${phone ? `<p class="small">${phone}</p>` : ''}
    </div>
    
    <div class="divider"></div>
    
    <div>
        <div class="info-row">
            <span>No. Order:</span>
            <span class="bold" style="color:red;">#${(order.id || '').slice(-6)}</span>
        </div>
        <div class="center" style="margin: 8px 0;">
             <div class="status-badge order-badge">
                 ${statusEmoji} ${statusLabel}
             </div>
        </div>
        <div class="info-row">
            <span>Tgl:</span>
            <span>${orderDate}</span>
        </div>
        <div class="info-row">
            <span>Waktu:</span>
            <span>${orderTime}</span>
        </div>
        <div class="info-row">
            <span>Pelanggan:</span>
            <span>${order.customerName || 'Pelanggan'}</span>
        </div>
        ${order.tableNumber ? `<div class="info-row">
            <span>Meja:</span>
            <span class="bold" style="color:red;">${order.tableNumber}</span>
        </div>` : ''}
    </div>
    
    <div class="divider"></div>
    
    <div style="width: 100%;">
        <table style="width: 100%; border-collapse: collapse;">
            <tbody>
                ${itemsHTML}
            </tbody>
        </table>
    </div>
    
    <div class="divider"></div>
    
    <div>
        ${order.subtotal && order.subtotal !== order.total ? `
        <div class="total-row">
            <span>Subtotal</span>
            <span>${fmt(order.subtotal)}</span>
        </div>` : ''}
        ${order.voucherDiscount > 0 ? `
        <div class="total-row small">
            <span>Diskon Voucher</span>
            <span>-${fmt(order.voucherDiscount)}</span>
        </div>` : ''}
        <div class="total-row grand-total">
            <span>TOTAL</span>
            <span>${fmt(order.total)}</span>
        </div>
    </div>
    
    <div class="divider" style="margin-top:20px;"></div>
    
    <div class="center">
        <span class="small">Status Bayar:</span><br>
        <div class="status-badge ${isPaid ? 'status-paid' : 'status-unpaid'}">
            ${isPaid ? 'LUNAS' : 'BELUM BAYAR'}
        </div>
    </div>
    
    ${wifiName ? `
    <div class="wifi-box">
        <span class="bold" style="font-size:12px;">📶 Free Wi-Fi</span>
        <p>SSID: <span class="bold">${wifiName}</span></p>
        ${wifiPassword ? `<p>Pass: <span class="bold">${wifiPassword}</span></p>` : ''}
    </div>` : ''}

    <div class="divider"></div>
    
    <div class="footer">
        <p class="small">Terima kasih atas kunjungan Anda!</p>
        <p class="tiny" style="margin-top:5px;">Powered by SuperKafe</p>
    </div>
    
    <div class="actions">
        <button class="btn-print" onclick="window.print()">📥 Download PDF</button>
    </div>
</body>
</html>
        `.trim();

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);

    } catch (err) {
        console.error('Public Nota Error:', err);
        res.status(500).send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:40px;">
                <h2>😵 Terjadi Kesalahan</h2>
                <p>Tidak dapat memuat nota. Silakan coba lagi.</p>
            </body></html>
        `);
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
    voidOrder,
    getTodayOrders,
    getPendingCount,
    mergeOrders,
    getPublicNota
};
