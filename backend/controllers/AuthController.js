const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');

const JWT_SECRET = process.env.JWT_SECRET || 'warkop_secret_jwt';

// Restricted roles that can only have one active session at a time
const restrictedRoles = ['kasir', 'waiter', 'kitchen', 'barista', 'staf'];

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Find Employee by Username, Email, or Name
        const employee = await Employee.findOne({
            $or: [
                { username: username },
                { email: username }, // Support login dengan email
                { name: username }
            ],
            status: 'active'
        });

        if (!employee) {
            return res.status(404).json({ error: 'Karyawan tidak ditemukan atau tidak aktif' });
        }

        // 1a. Check Email Verification (only for local auth with email)
        if (employee.authProvider === 'local' && employee.email && !employee.isVerified) {
            return res.status(403).json({
                error: 'Email belum diverifikasi. Silakan cek email Anda untuk kode verifikasi.',
                requiresVerification: true,
                email: employee.email
            });
        }

        // 2. Check for "Single Active Staff" Policy (Only for restricted roles)
        if (restrictedRoles.includes(employee.role)) {
            const activeStaff = await Employee.findOne({
                role: { $in: restrictedRoles },
                is_logged_in: true
            });

            if (activeStaff) {
                // 2a. Check if it's the SAME USER re-logging in
                if (activeStaff.id === employee.id) {
                    console.log(`ℹ️ User ${employee.name} re-logging in while active. Allowing.`);
                    // Proceed (allow same user to refresh session)
                } else {
                    // 2b. It's a DIFFERENT user. Check if Mamat truly has an open shift.
                    // Query for ANY open shift (not by userId, since old shifts may not have it)
                    const openShift = await Shift.findOne({ status: 'OPEN' });

                    if (openShift) {
                        // There IS an open shift. Block the new user.
                        return res.status(403).json({
                            error: `Login Gagal. Staff ${activeStaff.name} sedang aktif. Harap hubungi Admin jika ini kesalahan.`
                        });
                    } else {
                        // No open shift exists! This is a stuck session. Auto-logout Mamat.
                        console.log(`⚠️ Auto-logging out stuck user: ${activeStaff.name} (No Open Shift found)`);
                        activeStaff.is_logged_in = false;
                        await activeStaff.save();
                        // Proceed to allow Dika to login
                    }
                }
            }
        }

        // 3. Validate Password or PIN
        let isMatch = false;

        if (employee.password) {
            isMatch = await bcrypt.compare(password, employee.password);
        }

        if (!isMatch) {
            if (employee.pin_code === password || employee.pin === password) {
                isMatch = true;
            }
        }

        if (!isMatch) {
            return res.status(401).json({ error: 'Password atau PIN salah' });
        }

        // 4. Generate Token
        const token = jwt.sign(
            {
                id: employee.id,
                role: employee.role,
                name: employee.name
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 5. Update is_logged_in status
        employee.is_logged_in = true;
        await employee.save();

        res.json({
            token,
            user: {
                id: employee.id,
                name: employee.name,
                role: employee.role,
                image: employee.image,
                role_access: employee.role_access
            }
        });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const checkAuth = (req, res) => {
    res.json({ valid: true, user: req.user });
};

const logout = async (req, res) => {
    try {
        const userId = req.user.id;
        await Employee.updateOne({ id: userId }, { is_logged_in: false });
        res.json({ message: 'Logout berhasil' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Gagal logout' });
    }
};

module.exports = {
    login,
    checkAuth,
    logout
};
