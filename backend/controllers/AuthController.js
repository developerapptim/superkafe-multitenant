const Employee = require('../models/Employee');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');


const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt:', { username }); // Debug

        // 1. Find employee by username
        const employee = await Employee.findOne({
            username: { $regex: new RegExp(`^${username}$`, 'i') }
        });

        if (!employee) {
            return res.status(401).json({ error: 'Username tidak ditemukan' });
        }

        // 2. Check status
        if (employee.status !== 'active' && !employee.isActive) {
            return res.status(403).json({ error: 'Akun dinonaktifkan. Hubungi admin.' });
        }

        let isMatch = false;

        // 3. Try Password Match (if user has password)
        if (employee.password) {
            isMatch = await bcrypt.compare(password, employee.password);
        }

        // 4. If Password didn't match (or wasn't set), Try PIN Match
        // The frontend sends input in 'password' field. Check against pin_code or pin.
        if (!isMatch) {
            if (employee.pin_code === password || employee.pin === password) {
                isMatch = true;
            }
        }

        if (!isMatch) {
            return res.status(401).json({ error: 'Password atau PIN salah' });
        }

        // 5. Generate Token
        const token = jwt.sign(
            {
                id: employee.id,
                role: employee.role,
                name: employee.name
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: employee.id,
                name: employee.name,
                role: employee.role,
                image: employee.image,
                role_access: employee.role_access // Important for frontend permission checks
            }
        });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};


exports.checkAuth = (req, res) => {
    // If middleware passed, token is valid
    res.json({ valid: true, user: req.user });
};
