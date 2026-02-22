const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

// Order Model
const OrderSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    customerName: { type: String, default: 'Guest' },
    customerId: String,
    phone: String, // Customer phone number for loyalty tracking
    tableNumber: String,
    items: Array, // [{ id, name, price, qty, note, ... }]
    total: { type: Number, required: true },
    paymentMethod: { type: String, default: 'cash' },
    paymentStatus: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
    status: { type: String, enum: ['new', 'process', 'served', 'done', 'cancel', 'merged'], default: 'new' },
    timestamp: { type: Number, default: Date.now },
    note: String,
    paymentProofImage: String,
    is_archived_from_pos: { type: Boolean, default: false },
    shiftId: String, // Links order to a specific shift (for reporting)
    stockDeducted: { type: Boolean, default: false }, // Tracks if inventory was deducted for this order
    cancellationReason: String, // Reason for cancellation (POS only)
    cancelledBy: String, // Staff who cancelled the order

    // Voucher / Marketing Fields
    voucherCode: String,
    voucherDiscount: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 }, // Subtotal sebelum diskon voucher

    // Merge Fields
    isMerged: { type: Boolean, default: false }, // Is this a new merged order?
    originalOrders: [{ type: String }], // IDs of orders merged into this ONE
    mergedBy: String, // Staff who performed merge
    mergedAt: Date,
    mergedInto: String // ID of the new merged order (for original orders)
});

// Indexes for Analytics Performance
OrderSchema.index({ status: 1, timestamp: -1 }); // Most critical for report filtering
OrderSchema.index({ paymentMethod: 1 }); // For payment stats
OrderSchema.index({ customerPhone: 1 }); // For retention analysis

// Apply tenant scoping plugin for automatic tenant isolation
OrderSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('Order', OrderSchema);
