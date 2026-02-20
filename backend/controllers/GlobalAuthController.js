const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'warkop_secret_jwt';

/**
 * Global Auth Controller - Modern Authentication System
 * Mendukung: Global email lookup, PIN authentication, Shared tablet
 */

/**
 * POST /api/auth/global-login
 * Global login dengan email - auto-detect tenant
 */
const globalLogin = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { email, password } = req.body;

    // Validasi input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email dan password wajib diisi'
      });
    }

    console.log('[GLOBAL AUTH] Attempting global login', { email });

    // 1. Cari email di semua tenant databases
    const tenants = await Tenant.find({ isActive: true }).lean();
    
    let foundEmployee = null;
    let foundTenant = null;

    for (const tenant of tenants) {
      try {
        const tenantDB = await getTenantDB(tenant.dbName);
        const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);
        
        const employee = await EmployeeModel.findOne({
          email: email,
          status: 'active'
        });

        if (employee) {
          foundEmployee = employee;
          foundTenant = tenant;
          console.log('[GLOBAL AUTH] Employee found in tenant', {
            tenant: tenant.slug,
            email: email
          });
          break;
        }
      } catch (dbError) {
        console.error(`[GLOBAL AUTH] Error checking tenant ${tenant.slug}:`, dbError.message);
        continue;
      }
    }

    // 2. Jika tidak ditemukan
    if (!foundEmployee || !foundTenant) {
      return res.status(404).json({
        success: false,
        error: 'Email tidak ditemukan di sistem'
      });
    }

    // 3. Check email verification (only for local auth)
    if (foundEmployee.authProvider === 'local' && !foundEmployee.isVerified) {
      return res.status(403).json({
        success: false,
        error: 'Email belum diverifikasi. Silakan cek email Anda untuk kode verifikasi.',
        requiresVerification: true,
        email: foundEmployee.email,
        tenantSlug: foundTenant.slug
      });
    }

    // 4. Validate password
    if (!foundEmployee.password) {
      return res.status(401).json({
        success: false,
        error: 'Akun ini tidak memiliki password. Gunakan metode login lain.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, foundEmployee.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Password salah'
      });
    }

    // 5. Generate JWT token
    const token = jwt.sign(
      {
        id: foundEmployee.id,
        role: foundEmployee.role,
        name: foundEmployee.name,
        tenantSlug: foundTenant.slug
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 6. Update is_logged_in status
    foundEmployee.is_logged_in = true;
    await foundEmployee.save();

    console.log('[GLOBAL AUTH] Login successful', {
      email: email,
      tenant: foundTenant.slug,
      role: foundEmployee.role,
      duration: `${Date.now() - startTime}ms`
    });

    // 7. Return success response
    res.json({
      success: true,
      token,
      tenantSlug: foundTenant.slug,
      tenantName: foundTenant.name,
      user: {
        id: foundEmployee.id,
        name: foundEmployee.name,
        email: foundEmployee.email,
        role: foundEmployee.role,
        image: foundEmployee.image,
        role_access: foundEmployee.role_access
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('[GLOBAL AUTH ERROR] Global login failed', {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat login'
    });
  }
};

/**
 * POST /api/auth/login-pin
 * Login dengan PIN untuk shared tablet
 */
exports.loginWithPIN = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { tenantSlug, employeeId, pin } = req.body;

    // Validasi input
    if (!tenantSlug || !employeeId || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Tenant slug, employee ID, dan PIN wajib diisi'
      });
    }

    // Validasi format PIN (4-6 digit)
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        error: 'PIN harus berupa 4-6 digit angka'
      });
    }

    console.log('[PIN AUTH] Attempting PIN login', {
      tenantSlug,
      employeeId
    });

    // 1. Cari tenant
    const tenant = await Tenant.findOne({
      slug: tenantSlug.toLowerCase(),
      isActive: true
    }).lean();

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant tidak ditemukan atau tidak aktif'
      });
    }

    // 2. Koneksi ke database tenant
    const tenantDB = await getTenantDB(tenant.dbName);
    const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);

    // 3. Cari employee
    const employee = await EmployeeModel.findOne({
      id: employeeId,
      status: 'active'
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Karyawan tidak ditemukan atau tidak aktif'
      });
    }

    // 4. Validate PIN
    if (!employee.pin) {
      return res.status(401).json({
        success: false,
        error: 'PIN belum diatur untuk karyawan ini'
      });
    }

    const isPINValid = await bcrypt.compare(pin, employee.pin);
    
    if (!isPINValid) {
      return res.status(401).json({
        success: false,
        error: 'PIN salah'
      });
    }

    // 5. Generate JWT token
    const token = jwt.sign(
      {
        id: employee.id,
        role: employee.role,
        name: employee.name,
        tenantSlug: tenant.slug
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 6. Update is_logged_in status
    employee.is_logged_in = true;
    await employee.save();

    console.log('[PIN AUTH] Login successful', {
      employeeId,
      tenant: tenant.slug,
      role: employee.role,
      duration: `${Date.now() - startTime}ms`
    });

    // 7. Return success response
    res.json({
      success: true,
      token,
      user: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        image: employee.image,
        role_access: employee.role_access
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('[PIN AUTH ERROR] PIN login failed', {
      error: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    });

    res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat login dengan PIN'
    });
  }
};

/**
 * GET /api/auth/staff-list/:tenantSlug
 * Mendapatkan daftar staff untuk shared tablet selection screen
 */
exports.getStaffList = async (req, res) => {
  try {
    const { tenantSlug } = req.params;

    // 1. Cari tenant
    const tenant = await Tenant.findOne({
      slug: tenantSlug.toLowerCase(),
      isActive: true
    }).lean();

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant tidak ditemukan'
      });
    }

    // 2. Koneksi ke database tenant
    const tenantDB = await getTenantDB(tenant.dbName);
    const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);

    // 3. Ambil daftar staff yang aktif dan memiliki PIN
    const staffList = await EmployeeModel.find({
      status: 'active',
      pin: { $exists: true, $ne: null }
    })
    .select('id name role image')
    .lean();

    console.log('[STAFF LIST] Retrieved staff list', {
      tenant: tenantSlug,
      count: staffList.length
    });

    res.json({
      success: true,
      data: staffList,
      tenantName: tenant.name
    });

  } catch (error) {
    console.error('[STAFF LIST ERROR]', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Gagal mengambil daftar staff'
    });
  }
};

/**
 * POST /api/auth/verify-admin-pin
 * Verifikasi PIN admin untuk override actions (tanpa logout)
 */
exports.verifyAdminPIN = async (req, res) => {
  try {
    const { tenantSlug, pin } = req.body;

    if (!tenantSlug || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Tenant slug dan PIN wajib diisi'
      });
    }

    // 1. Cari tenant
    const tenant = await Tenant.findOne({
      slug: tenantSlug.toLowerCase(),
      isActive: true
    }).lean();

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant tidak ditemukan'
      });
    }

    // 2. Koneksi ke database tenant
    const tenantDB = await getTenantDB(tenant.dbName);
    const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);

    // 3. Cari admin dengan PIN yang cocok
    const admins = await EmployeeModel.find({
      role: 'admin',
      status: 'active',
      pin: { $exists: true, $ne: null }
    });

    let isValid = false;
    let adminName = null;

    for (const admin of admins) {
      const isPINValid = await bcrypt.compare(pin, admin.pin);
      if (isPINValid) {
        isValid = true;
        adminName = admin.name;
        break;
      }
    }

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'PIN admin tidak valid'
      });
    }

    console.log('[ADMIN PIN] Verification successful', {
      tenant: tenantSlug,
      admin: adminName
    });

    res.json({
      success: true,
      message: 'PIN admin terverifikasi',
      adminName
    });

  } catch (error) {
    console.error('[ADMIN PIN ERROR]', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Gagal memverifikasi PIN admin'
    });
  }
};

/**
 * POST /api/auth/set-pin
 * Set atau update PIN untuk employee (harus authenticated)
 */
exports.setPIN = async (req, res) => {
  try {
    const { employeeId, pin, tenantSlug } = req.body;

    // Validasi input
    if (!employeeId || !pin || !tenantSlug) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID, PIN, dan tenant slug wajib diisi'
      });
    }

    // Validasi format PIN
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        error: 'PIN harus berupa 4-6 digit angka'
      });
    }

    // 1. Cari tenant
    const tenant = await Tenant.findOne({
      slug: tenantSlug.toLowerCase(),
      isActive: true
    }).lean();

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant tidak ditemukan'
      });
    }

    // 2. Koneksi ke database tenant
    const tenantDB = await getTenantDB(tenant.dbName);
    const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);

    // 3. Hash PIN
    const hashedPIN = await bcrypt.hash(pin, 10);

    // 4. Update employee
    const employee = await EmployeeModel.findOneAndUpdate(
      { id: employeeId },
      { pin: hashedPIN },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Karyawan tidak ditemukan'
      });
    }

    console.log('[SET PIN] PIN updated successfully', {
      employeeId,
      tenant: tenantSlug
    });

    res.json({
      success: true,
      message: 'PIN berhasil diatur'
    });

  } catch (error) {
    console.error('[SET PIN ERROR]', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Gagal mengatur PIN'
    });
  }
};

module.exports = {
  globalLogin,
  loginWithPIN,
  getStaffList,
  verifyAdminPIN,
  setPIN
};
