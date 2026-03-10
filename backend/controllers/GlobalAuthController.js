const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Employee = require('../models/Employee');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { runWithTenantContext } = require('../utils/tenantContext');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

/**
 * Helper: Get tenant context object from tenant document
 */
const getTenantCtx = (tenant) => ({
  id: tenant._id.toString(),
  slug: tenant.slug,
  name: tenant.name || tenant.businessName,
  dbName: tenant.dbName
});

/**
 * POST /api/auth/global-login
 * Login admin/owner via email+password (auto-detect tenant)
 */
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
      JWT_SECRET,
      { expiresIn }
    );
    res.json({
      success: true,
      token,
      tenantSlug: tenant.slug,
      tenantName: tenant.businessName || tenant.name,
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
        name: tenant.businessName || tenant.name,
        selectedTheme: tenant.selectedTheme,
        hasSeenThemePopup: tenant.hasSeenThemePopup
      }
    });
  } catch (error) {
    console.error('Global login error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat login' });
  }
};

/**
 * POST /api/auth/login-pin
 * Login staff via PIN pada tenant tertentu.
 * Supports two modes:
 * 1. With employeeId: Direct PIN check for specific employee (from DeviceLogin staff grid)
 * 2. Without employeeId: Scan all active employees for matching PIN (from emergency GlobalLogin)
 */
exports.loginWithPIN = async (req, res) => {
  try {
    const { pin, tenantSlug, employeeId } = req.body;
    if (!pin || !tenantSlug) {
      return res.status(400).json({ success: false, message: 'PIN dan tenant slug harus diisi' });
    }

    // 1. Resolve tenant
    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });
    }

    // 2. Query Employee within tenant context
    const result = await runWithTenantContext(getTenantCtx(tenant), async () => {
      let employee = null;

      if (employeeId) {
        // Mode 1: Specific employee from staff selection grid
        employee = await Employee.findOne({ id: employeeId, status: 'active' });
        if (!employee) {
          return { error: 'Pegawai tidak ditemukan atau tidak aktif', status: 404 };
        }
      } else {
        // Mode 2: Find by scanning all active employees (emergency login)
        const activeEmployees = await Employee.find({ status: 'active' });
        for (const emp of activeEmployees) {
          // Try bcrypt hashed PIN first
          if (emp.pin) {
            const match = await bcrypt.compare(pin, emp.pin);
            if (match) { employee = emp; break; }
          }
          // Fallback: legacy plaintext pin_code
          if (!employee && emp.pin_code && emp.pin_code === pin) {
            employee = emp;
            break;
          }
        }
        if (!employee) {
          return { error: 'PIN salah', status: 401 };
        }
      }

      // 3. Check brute-force lockout
      if (employee.pinLockedUntil && new Date() < employee.pinLockedUntil) {
        const remainingMs = employee.pinLockedUntil - new Date();
        const remainingMin = Math.ceil(remainingMs / 60000);
        return { error: `Akun terkunci. Coba lagi dalam ${remainingMin} menit.`, status: 429 };
      }

      // 4. Verify PIN (for Mode 1 - employeeId was provided)
      if (employeeId) {
        let isMatch = false;

        // Try bcrypt hashed PIN
        if (employee.pin) {
          isMatch = await bcrypt.compare(pin, employee.pin);
        }
        // Fallback: legacy plaintext pin_code
        if (!isMatch && employee.pin_code && employee.pin_code === pin) {
          isMatch = true;
        }

        if (!isMatch) {
          // Increment failed attempts
          const attempts = (employee.pinFailedAttempts || 0) + 1;
          const updateFields = { pinFailedAttempts: attempts };

          // Lock after 5 failed attempts for 5 minutes
          if (attempts >= 5) {
            updateFields.pinLockedUntil = new Date(Date.now() + 5 * 60 * 1000);
            updateFields.pinFailedAttempts = 0;
          }

          await Employee.updateOne({ id: employeeId }, { $set: updateFields });
          return { error: 'PIN salah', status: 401 };
        }
      }

      // 5. Reset failed attempts on successful login
      if (employee.pinFailedAttempts > 0) {
        await Employee.updateOne({ id: employee.id }, { $set: { pinFailedAttempts: 0, pinLockedUntil: null } });
      }

      return { employee };
    });

    // Handle errors from tenant context
    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    const { employee } = result;

    // 6. Generate JWT token
    const token = jwt.sign(
      {
        id: employee.id,
        role: employee.role,
        name: employee.name,
        tenantId: tenant._id.toString(),
        tenantSlug: tenant.slug
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // 7. Update login status
    await runWithTenantContext(getTenantCtx(tenant), async () => {
      await Employee.updateOne({ id: employee.id }, { $set: { is_logged_in: true } });
    });

    res.json({
      success: true,
      token,
      user: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        image: employee.image,
        role_access: employee.role_access,
        tenantId: tenant._id.toString(),
        tenantSlug: tenant.slug
      }
    });

  } catch (error) {
    console.error('PIN login error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat login dengan PIN' });
  }
};

/**
 * GET /api/auth/staff-list/:tenantSlug
 * Get list of active staff with PIN for shared tablet selection screen
 */
exports.getStaffList = async (req, res) => {
  try {
    const { tenantSlug } = req.params;
    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });
    }

    const staff = await runWithTenantContext(getTenantCtx(tenant), async () => {
      // Get all active employees (those with PIN set)
      const employees = await Employee.find({
        status: 'active',
        $or: [
          { pin: { $exists: true, $ne: null } },
          { pin_code: { $exists: true, $ne: null, $ne: '' } }
        ]
      }).select('id name role image pin pin_code').lean();

      return employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        role: emp.role,
        image: emp.image || null,
        hasPin: !!(emp.pin || emp.pin_code)
      }));
    });

    res.json({
      success: true,
      tenantName: tenant.businessName || tenant.name,
      staff
    });
  } catch (error) {
    console.error('Get staff list error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengambil daftar staff' });
  }
};

/**
 * POST /api/auth/verify-admin-pin
 * Verify admin PIN for override actions (e.g. void orders, admin override modal)
 */
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

    const admin = await runWithTenantContext(getTenantCtx(tenant), async () => {
      const admins = await Employee.find({
        role: { $in: ['admin', 'owner'] },
        status: 'active'
      });

      for (const adm of admins) {
        // Try bcrypt hashed PIN
        if (adm.pin) {
          const match = await bcrypt.compare(pin, adm.pin);
          if (match) return adm;
        }
        // Fallback: legacy plaintext
        if (adm.pin_code && adm.pin_code === pin) return adm;
      }
      return null;
    });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'PIN admin salah atau tidak memiliki akses' });
    }

    res.json({ success: true, admin: { id: admin.id || admin._id, name: admin.name, role: admin.role } });
  } catch (error) {
    console.error('Verify admin PIN error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat verifikasi PIN admin' });
  }
};

/**
 * POST /api/auth/set-pin
 * Set/update PIN for an employee (requires authentication)
 */
exports.setPIN = async (req, res) => {
  try {
    const { pin, employeeId } = req.body;
    const tenantSlug = req.user.tenantSlug;

    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'PIN harus 6 digit angka' });
    }

    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });
    }

    const result = await runWithTenantContext(getTenantCtx(tenant), async () => {
      const targetId = employeeId || req.user.id;

      // Hash PIN with bcrypt
      const salt = await bcrypt.genSalt(10);
      const hashedPin = await bcrypt.hash(pin, salt);

      const employee = await Employee.findOneAndUpdate(
        { id: targetId },
        { $set: { pin: hashedPin, pin_code: null } }, // Clear legacy plaintext
        { new: true }
      ).select('-password -pin');

      if (!employee) {
        return { error: 'Pegawai tidak ditemukan', status: 404 };
      }

      return { employee };
    });

    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      message: 'PIN berhasil diatur',
      user: { id: result.employee.id, name: result.employee.name, hasPin: true }
    });
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan saat mengatur PIN' });
  }
};
