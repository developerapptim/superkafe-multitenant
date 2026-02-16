// Basic Payroll Calculation
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

exports.calculate = async (req, res) => {
    try {
        const { employee_id, start_date, end_date } = req.body;

        const employee = await Employee.findOne({ id: employee_id });
        if (!employee) return res.status(404).json({ error: 'Pegawai not found' });

        // Get Attendance
        const attendance = await Attendance.find({
            employeeId: employee_id,
            date: { $gte: start_date, $lte: end_date }
        });

        // Calculate Attendance Stats
        const days_present = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
        const days_late = attendance.filter(a => a.status === 'late').length;

        // Calculate Base Pay
        const dailyRate = employee.dailySalary || employee.salary || 0; // Fallback if schema differs
        const base_pay = days_present * dailyRate;

        // Get Pending Kasbon (Debts)
        const Debt = require('../models/Debt');
        const kasbons = await Debt.find({
            personId: employee_id,
            type: 'kasbon',
            status: 'pending'
        });

        const kasbon_deduction = kasbons.reduce((sum, item) => sum + (item.amount || 0), 0);
        const net_pay = Math.max(0, base_pay - kasbon_deduction);

        res.json({
            employee,
            period: { start: start_date, end: end_date },
            attendanceDetails: attendance,
            kasbon_details: kasbons,
            summary: {
                days_present,
                days_late,
                base_pay,
                kasbon_deduction,
                net_pay
            }
        });
    } catch (err) {
        console.error("Payroll Error:", err);
        res.status(500).json({ error: 'Server error' });
    }
};
