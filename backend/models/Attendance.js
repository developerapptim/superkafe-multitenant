const mongoose = require('mongoose');

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

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
