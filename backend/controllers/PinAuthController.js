const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const Tenant = require('../models/Tenant');
const { runWithTenantContext } = require('../utils/tenantContext');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// ==========================================
// PIN VERIFICATION FLOW
// ==========================================

const verifyGooglePin = async (req, res) => {
    try {
        const { tempToken, pin, tenantSlug } = req.body;

        if (!tempToken || !pin || !tenantSlug) {
            return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
        }

        // Verify tempToken
        const decoded = jwt.verify(tempToken, JWT_SECRET);
        if (decoded.type !== 'pin_verification') {
            return res.status(401).json({ success: false, message: 'Token tidak valid' });
        }

        const tenant = await Tenant.findOne({ slug: tenantSlug });
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });
        }

        const result = await runWithTenantContext(
            { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName || 'superkafe_v2' },
            async () => {
                const user = await Employee.findOne({ $or: [{ id: decoded.id }, { _id: decoded.id }] });
                if (!user) return { error: 'User tidak ditemukan' };
                if (!user.pin) return { error: 'PIN belum diatur untuk akun ini' };

                // Brute-force protection
                if (user.pinLockedUntil && new Date() < user.pinLockedUntil) {
                    const waitMin = Math.ceil((user.pinLockedUntil - new Date()) / 60000);
                    return { error: `Terlalu banyak percobaan salah. Coba lagi dalam ${waitMin} menit.` };
                }

                const isMatch = await bcrypt.compare(pin, user.pin);
                if (!isMatch) {
                    // Update failed attempts
                    user.pinFailedAttempts += 1;
                    if (user.pinFailedAttempts >= 5) {
                        user.pinLockedUntil = new Date(Date.now() + 15 * 60000); // Lock for 15 mins
                    }
                    await user.save();
                    return { error: 'PIN salah' };
                }

                // Sukses
                user.pinFailedAttempts = 0;
                user.pinLockedUntil = null;
                await user.save();

                return { user };
            }
        );

        if (result.error) {
            return res.status(400).json({ success: false, message: result.error });
        }

        const { user } = result;

        // Generate full JWT
        const fullToken = jwt.sign(
            {
                id: user.id || user._id.toString(),
                email: user.email,
                role: user.role,
                tenant: tenantSlug,
                tenantDbName: tenant.dbName
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.json({
            success: true,
            message: 'PIN valid. Login berhasil.',
            token: fullToken,
            user: {
                id: user.id || user._id.toString(),
                username: user.username,
                email: user.email,
                name: user.name,
                image: user.image,
                role: user.role || 'admin',
                role_access: (user.role_access && user.role_access.length > 0) ? user.role_access : ['POS', 'Kitchen', 'Meja', 'Keuangan', 'Laporan', 'Menu', 'Pegawai', 'Pengaturan'],
            },
            tenant: {
                slug: tenant.slug,
                name: tenant.name,
                status: tenant.status
            }
        });

    } catch (err) {
        console.error('Verify PIN Error:', err);
        return res.status(401).json({ success: false, message: 'Sesi kedaluwarsa atau token tidak valid' });
    }
};

// ==========================================
// PIN MANAGEMENT (DARI DASHBOARD PENGATURAN)
// ==========================================

const togglePinSecurity = async (req, res) => {
    try {
        const { isEnabled, newPin } = req.body;
        const userId = req.user.id; 

        const user = await Employee.findOne({ $or: [{ id: userId }, { _id: userId }] });
        if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

        if (isEnabled && newPin) {
            if (newPin.length !== 6) return res.status(400).json({ success: false, message: 'PIN harus 6 digit' });
            
            const salt = await bcrypt.genSalt(10);
            user.pin = await bcrypt.hash(newPin, salt);
            user.isPinSecurityEnabled = true;

        } else if (isEnabled && !user.pin) {
             return res.status(400).json({ success: false, message: 'Anda harus mengatur PIN baru saat mengaktifkan fitur ini' });
        } else if (isEnabled && user.pin) {
            user.isPinSecurityEnabled = true;
        } else {
            user.isPinSecurityEnabled = false;
        }

        await user.save();
        return res.json({ success: true, message: 'Pengaturan keamanan PIN berhasil diperbarui', isPinSecurityEnabled: user.isPinSecurityEnabled });

    } catch (err) {
        console.error('Toggle PIN Error:', err);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan internal server' });
    }
}

const changePin = async (req, res) => {
    try {
        const { currentPin, newPin } = req.body;
        const userId = req.user.id;

        if (!currentPin || !newPin || newPin.length !== 6) {
            return res.status(400).json({ success: false, message: 'Format PIN tidak valid' });
        }

        const user = await Employee.findOne({ $or: [{ id: userId }, { _id: userId }] });
        if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

        if (!user.pin) {
            return res.status(400).json({ success: false, message: 'Anda belum mengatur PIN. Silakan aktifkan fitur PIN Security terlebih dahulu.' });
        }

        const isMatch = await bcrypt.compare(currentPin, user.pin);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'PIN lama salah' });
        }

        const salt = await bcrypt.genSalt(10);
        user.pin = await bcrypt.hash(newPin, salt);
        await user.save();

        return res.json({ success: true, message: 'PIN berhasil diubah' });

    } catch (err) {
        console.error('Change PIN Error:', err);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan internal server' });
    }
}

const getPinStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await Employee.findOne({ $or: [{ id: userId }, { _id: userId }] });
        if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

        return res.json({ success: true, isPinSecurityEnabled: user.isPinSecurityEnabled || false, hasPinInstalled: !!user.pin });
    } catch (err) {
        console.error('Get PIN status Error:', err);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan internal server' });
    }
}

// ==========================================
// LUPA PIN FLOW
// ==========================================

const requestPinReset = async (req, res) => {
    try {
        const { email, tempToken, tenantSlug } = req.body;

        if (!email || !tempToken || !tenantSlug) {
            return res.status(400).json({ success: false, message: 'Akses ditolak' });
        }

        // Verify tempToken
        const decoded = jwt.verify(tempToken, JWT_SECRET);
        if (decoded.type !== 'pin_verification') {
            return res.status(401).json({ success: false, message: 'Token tidak valid' });
        }

        const tenant = await Tenant.findOne({ slug: tenantSlug });
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });

        const result = await runWithTenantContext(
            { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName || 'superkafe_v2' },
            async () => {
                const user = await Employee.findOne({ $or: [{ id: decoded.id }, { _id: decoded.id }], email: email });
                if (!user) return { error: 'User tidak ditemukan' };

                // Generate 6 digit reset code
                const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
                user.pinResetCode = resetCode;
                user.pinResetCodeExpiry = new Date(Date.now() + 15 * 60000); // 15 mins expiry
                await user.save();
                
                return { email: user.email, resetCode, name: user.name };
            });

        if (result.error) return res.status(400).json({ success: false, message: result.error });

        // SEND EMAIL (Simulated implementation - adjust to your email mechanism)
        console.log(`[EMAIL SEND] To: ${result.email} - PIN RESET CODE: ${result.resetCode}`);
        
        // Use existing mailer if possible, otherwise log for testing.
        // const emailService = require('../services/emailService');
        // await emailService.sendPinResetEmail(result.email, result.name, result.resetCode);

        return res.json({ success: true, message: 'Kode reset PIN telah dikirimkan ke email Anda' });

    } catch (err) {
         console.error('Request PIN Reset Error:', err);
         return res.status(500).json({ success: false, message: 'Sesi kedaluwarsa atau terjadi kesalahan server' });
    }
}

const verifyPinResetCodeAndSetNew = async (req, res) => {
    try {
         const { email, tempToken, resetCode, newPin, tenantSlug } = req.body;

         if (!email || !tempToken || !resetCode || !newPin || newPin.length !== 6 || !tenantSlug) {
            return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
        }

        // Verify tempToken
        const decoded = jwt.verify(tempToken, JWT_SECRET);
        if (decoded.type !== 'pin_verification') {
            return res.status(401).json({ success: false, message: 'Token tidak valid' });
        }

        const tenant = await Tenant.findOne({ slug: tenantSlug });
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });

        const result = await runWithTenantContext(
            { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName || 'superkafe_v2' },
            async () => {
                const user = await Employee.findOne({ $or: [{ id: decoded.id }, { _id: decoded.id }], email: email });
                if (!user) return { error: 'User tidak ditemukan' };

                if (!user.pinResetCode || user.pinResetCode !== resetCode) {
                    return { error: 'Kode reset salah' };
                }

                if (new Date() > user.pinResetCodeExpiry) {
                    return { error: 'Kode reset kedaluwarsa, silakan minta ulang' };
                }

                // Sukses verifikasi, set PIN baru
                const salt = await bcrypt.genSalt(10);
                user.pin = await bcrypt.hash(newPin, salt);
                
                // Clear reset code
                user.pinResetCode = null;
                user.pinResetCodeExpiry = null;
                user.pinFailedAttempts = 0;
                user.pinLockedUntil = null;
                
                await user.save();
                
                return { user };
            });


        if (result.error) return res.status(400).json({ success: false, message: result.error });

        return res.json({ success: true, message: 'PIN berhasil direset. Silakan login kembali dengan PIN baru Anda.' });

    } catch(err) {
        console.error('Verify PIN Reset Error:', err);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem' });
    }
}

// ==========================================
// SET PIN (Pertama kali, dari halaman Pengaturan)
// ==========================================

const setPin = async (req, res) => {
    try {
        const { newPin, pin } = req.body;
        const targetPin = newPin || pin;
        const userId = req.user.id;
        // Support both 'tenantSlug' and 'tenant' from JWT (different auth flows use different field names)
        const tenantSlug = req.user.tenantSlug || req.user.tenant;

        if (!targetPin || targetPin.length !== 6 || !/^\d{6}$/.test(targetPin)) {
            return res.status(400).json({ success: false, message: 'PIN harus 6 digit angka' });
        }

        if (!tenantSlug) {
            return res.status(400).json({ success: false, message: 'Tenant tidak ditemukan di token' });
        }

        const tenant = await Tenant.findOne({ slug: tenantSlug.toLowerCase() });
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });
        }

        const result = await runWithTenantContext(
            { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName || 'superkafe_v2' },
            async () => {
                const user = await Employee.findOne({ $or: [{ id: userId }, { _id: userId }] });
                if (!user) return { error: 'User tidak ditemukan', status: 404 };

                // Hanya admin yang boleh set PIN keamanan login Google
                if (user.role !== 'admin') {
                    return { error: 'Hanya admin yang dapat mengatur PIN keamanan', status: 403 };
                }

                // Jika sudah ada PIN, harus gunakan changePin
                if (user.pin) {
                    return { error: 'PIN sudah ada. Gunakan fitur Ubah PIN untuk menggantinya.', status: 400 };
                }

                const salt = await bcrypt.genSalt(10);
                user.pin = await bcrypt.hash(targetPin, salt);
                await user.save();

                return { success: true };
            }
        );

        if (result.error) {
            return res.status(result.status).json({ success: false, message: result.error });
        }

        return res.json({ success: true, message: 'PIN berhasil diatur', hasPinInstalled: true });

    } catch (err) {
        console.error('Set PIN Error:', err);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan internal server' });
    }
}

module.exports = {
    verifyGooglePin,
    togglePinSecurity,
    changePin,
    getPinStatus,
    requestPinReset,
    verifyPinResetCodeAndSetNew,
    setPin
};
