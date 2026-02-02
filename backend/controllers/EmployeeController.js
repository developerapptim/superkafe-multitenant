const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

exports.getEmployees = async (req, res) => {
    try {
        const employees = await Employee.find({ status: { $ne: 'inactive' } }).select('-password');
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createEmployee = async (req, res) => {
    try {
        console.log('Creating employee:', req.body); // Debug log
        const {
            name, username, password, role,
            phone, address, salary, daily_rate,
            pin_code, role_access
        } = req.body;

        // Check exists ONLY if username is provided
        if (username) {
            const exists = await Employee.findOne({ username });
            if (exists) {
                if (exists.status === 'active' || exists.isActive) {
                    return res.status(400).json({ error: 'Username already taken' });
                } else {
                    // If exists but inactive, archive the old username to free it up
                    exists.username = `${exists.username}_deleted_${Date.now()}`;
                    await exists.save();
                }
            }
        }

        // Hash password if provided
        let hashedPassword = undefined;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);
        }

        const newEmployee = new Employee({
            id: `emp_${Date.now()}`,
            name,
            username: username || undefined,
            password: hashedPassword,
            role: role || 'kasir',
            phone,
            address,
            salary: Number(salary) || 0,
            daily_rate: Number(daily_rate) || 0,
            pin_code: pin_code, // Save the kiosk PIN
            role_access: role_access || [],
            status: 'active',
            isActive: true
        });

        await newEmployee.save();
        res.status(201).json(newEmployee);

    } catch (err) {
        console.error('Create Employee Error:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join(', ') });
        }
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
};


exports.updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (updates.password) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(updates.password, salt);
        }

        const employee = await Employee.findOneAndUpdate(
            { id },
            { $set: updates },
            { new: true }
        ).select('-password');

        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        res.json(employee);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;

        // Soft delete: Change status to 'inactive' so history remains
        const employee = await Employee.findOneAndUpdate(
            { id },
            { status: 'inactive' },
            { new: true }
        );

        if (!employee) return res.status(404).json({ error: 'Employee not found' });

        res.json({ ok: true, message: 'Employee deactivated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find employee
        const employee = await Employee.findOne({
            username: { $regex: new RegExp(`^${username}$`, 'i') },
            status: 'active'
        });

        if (!employee) return res.status(401).json({ error: 'Invalid credentials' });

        // Check password (or PIN if implemented as primary)
        const isMatch = await bcrypt.compare(password, employee.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: employee.id, role: employee.role, name: employee.name },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            token,
            user: {
                id: employee.id,
                name: employee.name,
                role: employee.role
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.fixData = async (req, res) => {
    try {
        console.log('🔧 Starting Data Repair...');
        const employees = await Employee.find({});
        let fixedCount = 0;
        let logs = [];

        // 1. Fix Usernames
        for (const emp of employees) {
            if (!emp.username || emp.username.trim() === '') {
                // Generate username
                let newUsername = emp.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                // Ensure unique
                let suffix = 1;
                while (await Employee.findOne({ username: newUsername })) {
                    newUsername = `${emp.name.toLowerCase().replace(/[^a-z0-9]/g, '')}${suffix++}`;
                }

                emp.username = newUsername;
                if (!emp.pin_code && emp.role !== 'admin') emp.pin_code = '123456';

                await emp.save();
                logs.push(`Fixed ${emp.name} -> username: ${newUsername}`);
                fixedCount++;
            }
        }

        // 2. Ensure Admin
        const admin = await Employee.findOne({ role: 'admin', status: 'active' });
        if (!admin) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('password', salt);

            const newAdmin = new Employee({
                id: `emp_admin_${Date.now()}`,
                name: 'Administrator',
                username: 'admin',
                password: hashedPassword,
                role: 'admin',
                status: 'active',
                role_access: ['*']
            });
            await newAdmin.save();
            logs.push('Created new Admin account (user: admin, pass: password)');
        } else {
            logs.push(`Admin already exists: ${admin.username}`);
        }

        res.json({ success: true, fixed: fixedCount, logs });

    } catch (err) {
        console.error('Fix Data Error:', err);
        res.status(500).json({ error: err.message });
    }
};
