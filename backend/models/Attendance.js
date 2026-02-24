const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const AttendanceSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    employeeId: { type: String, required: true },
    employeeName: String,
    date: { type: String, required: true }, // YYYY-MM-DD
    clockIn: String,
    clockOut: String,
    status: { type: String, enum: ['present', 'absent', 'late'], default: 'present' },
    workDuration: Number, // In minutes/hours
    createdAt: { type: Date, default: Date.now }
});

// Tenant-scoped compound indexes for optimal query performance
AttendanceSchema.index({ tenantId: 1, createdAt: -1 }); // Time-based queries per tenant
AttendanceSchema.index({ tenantId: 1, status: 1 }); // Status-based queries per tenant

// Apply tenant scoping plugin for automatic tenant isolation
AttendanceSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
