// Basic Payroll Calculation
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

exports.calculate = async (req, res) => {
    try {
        const { employee_id, start_date, end_date } = req.body;

        const employee = await Employee.findOne({ id: employee_id });
        if (!employee) return res.status(404).json({ error: 'Pegawai not found' });

        const attendance = await Attendance.find({
            employeeId: employee_id,
            date: { $gte: start_date, $lte: end_date }
        });

        const totalDays = attendance.length;
        const totalSalary = totalDays * (employee.dailySalary || 0);

        res.json({
            employee,
            period: { start: start_date, end: end_date },
            totalDays,
            totalSalary,
            attendanceDetails: attendance
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
