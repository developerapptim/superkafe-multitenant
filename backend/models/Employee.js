const mongoose = require('mongoose');

// Employee Model
const EmployeeSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    username: { type: String, sparse: true },
    password: { type: String }, // hashed
    pin: { type: String },
    pin_code: { type: String, maxlength: 6 }, // 6-digit PIN for kiosk attendance
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'kasir', 'waiter', 'kitchen', 'barista', 'manager', 'owner', 'staf'], default: 'kasir' },
    role_access: [{ type: String }], // ['POS', 'Kitchen', 'Meja', 'Keuangan', 'Laporan', 'Menu']
    phone: String,
    address: String,
    salary: { type: Number, default: 0 }, // Monthly salary
    daily_rate: { type: Number, default: 0 }, // Daily rate for payroll calculation
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Employee', EmployeeSchema);
