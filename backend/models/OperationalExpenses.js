const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const OperationalExpenseSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    category: {
        type: String,
        required: true,
        enum: ['Listrik', 'Air', 'Sewa', 'Gaji', 'Maintenance', 'Pemasaran', 'Lainnya']
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, required: true }, // Detail keperluan
    date: { type: Date, default: Date.now },
    paymentMethod: { type: String, enum: ['Tunai', 'Transfer', 'E-Wallet', 'Kartu'], default: 'Tunai' },

    // Proof & Audit
    proofImage: String, // URL/Path to Bukti Transfer/Struk
    notes: String,

    // Audit Trail
    createdBy: { type: String, required: true }, // User Name/ID
    updatedBy: String,

    // Soft Delete
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    deletedBy: String

}, { timestamps: true });

// Prevent finding deleted items by default queries? 
// Better to handle in controller for explicit checks, but we can index query speed.
OperationalExpenseSchema.index({ date: -1 });
OperationalExpenseSchema.index({ category: 1 });
OperationalExpenseSchema.index({ isDeleted: 1 });

// Apply tenant scoping plugin for automatic tenant isolation
OperationalExpenseSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('OperationalExpense', OperationalExpenseSchema);
