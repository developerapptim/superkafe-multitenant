const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id; // From checkJwt middleware

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Password saat ini dan password baru wajib diisi' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
        }

        // 1. Find User
        const user = await Employee.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        // 2. Verify Current Password
        // Note: Some legacy users might not have a password set, but usually admin does.
        // If user has no password, this check might fail or need special handling. 
        // Assuming all users using this feature have a password.
        if (!user.password) {
            return res.status(400).json({ error: 'Password belum diatur. Silakan hubungi admin utama.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Password saat ini salah' });
        }

        // 3. Hash New Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 4. Update User
        user.password = hashedPassword;
        await user.save();

        res.json({ message: 'Password berhasil diubah' });

    } catch (err) {
        console.error('Change Password Error:', err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
};
