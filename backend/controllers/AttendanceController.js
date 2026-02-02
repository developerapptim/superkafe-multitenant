const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

// Get all attendance records
exports.getAll = async (req, res) => {
    try {
        const { date, employee_id } = req.query;
        let query = {};
        if (date) query.date = date;
        if (employee_id) query.employeeId = employee_id;

        const attendance = await Attendance.find(query).sort({ date: -1, clockIn: -1 });
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Get today's attendance
exports.getToday = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const attendance = await Attendance.find({ date: today });
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Clock In
exports.clockIn = async (req, res) => {
    try {
        const { employee_id } = req.body;
        const employee = await Employee.findOne({ id: employee_id });
        if (!employee) return res.status(404).json({ error: 'Pegawai tidak ditemukan' });

        const today = new Date().toISOString().split('T')[0];
        const existing = await Attendance.findOne({ employeeId: employee_id, date: today });
        if (existing) return res.status(400).json({ error: 'Sudah absen masuk hari ini' });

        const newAttendance = new Attendance({
            id: `att_${Date.now()}`,
            employeeId: employee_id,
            employeeName: employee.name,
            date: today,
            clockIn: new Date().toLocaleTimeString('id-ID', { hour12: false }),
            status: 'present'
        });

        await newAttendance.save();
        res.status(201).json(newAttendance);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Clock Out
exports.clockOut = async (req, res) => {
    try {
        const { employee_id } = req.body;

        const today = new Date().toISOString().split('T')[0];
        const attendance = await Attendance.findOne({ employeeId: employee_id, date: today });

        if (!attendance) return res.status(404).json({ error: 'Belum absen masuk hari ini' });
        if (attendance.clockOut) return res.status(400).json({ error: 'Sudah absen pulang hari ini' });

        attendance.clockOut = new Date().toLocaleTimeString('id-ID', { hour12: false });
        await attendance.save();

        res.json(attendance);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Manual Create
exports.create = async (req, res) => {
    try {
        const item = new Attendance({
            ...req.body,
            id: `att_${Date.now()}`
        });
        await item.save();
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Update
exports.update = async (req, res) => {
    try {
        const item = await Attendance.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
        res.json(item);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
