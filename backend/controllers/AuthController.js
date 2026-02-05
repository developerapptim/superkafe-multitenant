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

        // 3. Single Active Staff Guard
        // Roles that are restricted to single session: 'kasir', 'staf', 'waiter', 'barista', 'kitchen'
        const restrictedRoles = ['kasir', 'staf', 'waiter', 'barista', 'kitchen'];

        if (restrictedRoles.includes(employee.role)) {
            // Check if ANY restricted staff is already logged in (excluding self if re-logging in on same device/session - though usually token is gone)
            // But if 'is_logged_in' is true, it means they are active elsewhere or didn't logout.
            // We want to block IF ANOTHER staff is active.
            // Wait, the requirement says: "cek di database apakah ada user staff lain yang sedang memiliki status is_logged_in = true."
            // "Jika ada, TOLAK LOGIN... Login Gagal. Staff [Nama] sedang aktif."

            const activeStaff = await Employee.findOne({
                role: { $in: restrictedRoles },
                is_logged_in: true,
                id: { $ne: employee.id } // exclude self? Or should self also be blocked if already logged in? 
                // If self is logged in, it might be same user. 
                // Requirement: "user staff **lain**". So exclude self.
            });

            if (activeStaff) {
                return res.status(403).json({
                    error: `Login Gagal. Staff ${activeStaff.name} sedang aktif. Harap hubungi Admin jika ini kesalahan.`
                });
            }
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

        // 6. Update is_logged_in status
        employee.is_logged_in = true;
        await employee.save();

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

exports.logout = async (req, res) => {
    try {
        const userId = req.user.id;
        await Employee.updateOne({ id: userId }, { is_logged_in: false });
        res.json({ message: 'Logout berhasil' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Gagal logout' });
    }
};
