const User = require('../models/User');
const Tenant = require('../models/Tenant');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.globalLogin = async (req, res) => {
  try {
    const { email, password, isPersonalDevice } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password harus diisi' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }
    const tenant = await Tenant.findById(user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });
    }

    // Determine token expiration based on personal device flag
    const isAdmin = ['admin', 'owner'].includes(user.role);
    const expiresIn = (isPersonalDevice && isAdmin) ? '30d' : '24h';

    const token = jwt.sign(
      { userId: user._id, tenantId: user.tenantId, tenantSlug: tenant.slug, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn }
    );
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: tenant.slug
      },
      tenant: {
        id: tenant._id,
        slug: tenant.slug,
        name: tenant.businessName,
        selectedTheme: tenant.selectedTheme,
        hasSeenThemePopup: tenant.hasSeenThemePopup
      }
    });
  } catch (error) {
    console.error('Global login error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat login' });
  }
};

exports.loginWithPIN = async (req, res) => {
  try {
    const { pin, tenantSlug } = req.body;
    if (!pin || !tenantSlug) {
      return res.status(400).json({ success: false, message: 'PIN dan tenant slug harus diisi' });
    }
    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });
    }
    const user = await User.findOne({ pin: pin, tenantId: tenant._id });
    if (!user) {
      return res.status(401).json({ success: false, message: 'PIN salah' });
    }

    // POS Tablet login uses 12h expiration
    const token = jwt.sign(
      { userId: user._id, tenantId: user.tenantId, tenantSlug: tenant.slug, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId, tenantSlug: tenant.slug } });
  } catch (error) {
    console.error('PIN login error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat login dengan PIN' });
  }
};

exports.getStaffList = async (req, res) => {
  try {
    const { tenantSlug } = req.params;
    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });
    }
    const staff = await User.find({ tenantId: tenant._id, pin: { $exists: true, $ne: null } }).select('name role pin');
    res.json({ success: true, staff: staff.map(s => ({ id: s._id, name: s.name, role: s.role, hasPin: !!s.pin })) });
  } catch (error) {
    console.error('Get staff list error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengambil daftar staff' });
  }
};

exports.verifyAdminPIN = async (req, res) => {
  try {
    const { pin, tenantSlug } = req.body;
    if (!pin || !tenantSlug) {
      return res.status(400).json({ success: false, message: 'PIN dan tenant slug harus diisi' });
    }
    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });
    }
    const admin = await User.findOne({ pin: pin, tenantId: tenant._id, role: { $in: ['admin', 'owner'] } });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'PIN admin salah atau tidak memiliki akses' });
    }
    res.json({ success: true, admin: { id: admin._id, name: admin.name, role: admin.role } });
  } catch (error) {
    console.error('Verify admin PIN error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat verifikasi PIN admin' });
  }
};

exports.setPIN = async (req, res) => {
  try {
    const { pin } = req.body;
    const userId = req.user.userId;
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'PIN harus 4 digit angka' });
    }
    const existingUser = await User.findOne({ pin: pin, tenantId: req.user.tenantId, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'PIN sudah digunakan oleh user lain' });
    }
    const user = await User.findByIdAndUpdate(userId, { pin: pin }, { new: true }).select('-password');
    res.json({ success: true, message: 'PIN berhasil diatur', user: { id: user._id, name: user.name, hasPin: !!user.pin } });
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengatur PIN' });
  }
};
