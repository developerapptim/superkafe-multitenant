const mongoose = require('mongoose');

// Order Model
const OrderSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    customerName: { type: String, default: 'Guest' },
    customerId: String,
    tableNumber: String,
    items: Array, // [{ id, name, price, qty, note, ... }]
    total: { type: Number, required: true },
    paymentMethod: { type: String, default: 'cash' },
    paymentStatus: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
    status: { type: String, enum: ['new', 'process', 'served', 'done', 'cancel'], default: 'new' },
    timestamp: { type: Number, default: Date.now },
    note: String,
    paymentProofImage: String,
    is_archived_from_pos: { type: Boolean, default: false },
    shiftId: String, // Links order to a specific shift (for reporting)
    stockDeducted: { type: Boolean, default: false }, // Tracks if inventory was deducted for this order
    cancellationReason: String, // Reason for cancellation (POS only)
    cancelledBy: String // Staff who cancelled the order
});

module.exports = mongoose.model('Order', OrderSchema);
