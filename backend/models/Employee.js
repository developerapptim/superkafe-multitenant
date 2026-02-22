const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

// Employee Model
const EmployeeSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    username: { type: String, sparse: true },
    email: { type: String, sparse: true }, // Email untuk authentication
    password: { type: String }, // hashed with bcrypt
    pin: { type: String }, // 4-6 digit PIN hashed with bcrypt for shared tablet
    pin_code: { type: String, maxlength: 6 }, // Legacy 6-digit PIN for kiosk attendance (plain text)
    image: { type: String }, // Profile image URL for staff selection screen
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'kasir', 'waiter', 'kitchen', 'barista', 'manager', 'owner', 'staf'], default: 'kasir' },
    role_access: [{ type: String }], // ['POS', 'Kitchen', 'Meja', 'Keuangan', 'Laporan', 'Menu']
    phone: String,
    address: String,
    salary: { type: Number, default: 0 }, // Monthly salary
    daily_rate: { type: Number, default: 0 }, // Daily rate for payroll calculation
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    is_logged_in: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    // Email Verification Fields
    isVerified: { type: Boolean, default: false },
    otpCode: { type: String },
    otpExpiry: { type: Date },
    // Google Auth Fields
    googleId: { type: String, sparse: true },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    createdAt: { type: Date, default: Date.now }
});

// Apply tenant scoping plugin for automatic tenant isolation
EmployeeSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('Employee', EmployeeSchema);
