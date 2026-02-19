const { getTenantDB } = require('../config/db');
const Tenant = require('../models/Tenant');
const jwt = require('jsonwebtoken');

/**
 * Google Auth Controller untuk Multitenant
 * 
 * Flow:
 * 1. Frontend mengirim Google ID Token + tenant slug
 * 2. Backend verify token dengan Google
 * 3. Cari/buat user di database tenant yang sesuai
 * 4. Return JWT token untuk login
 */

/**
 * POST /api/auth/google
 * Login/Register dengan Google
 */
exports.googleAuth = async (req, res) => {
  try {
    const { idToken, tenantSlug } = req.body;

    // Validasi input
    if (!idToken || !tenantSlug) {
      return res.status(400).json({
        success: false,
        message: 'Google ID Token dan tenant slug wajib diisi'
      });
    }

    // Verify Google ID Token
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    let googleUser;
    try {
      const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      googleUser = ticket.getPayload();
    } catch (verifyError) {
      console.error('[GOOGLE AUTH] Token verification failed:', verifyError.message);
      return res.status(401).json({
        success: false,
        message: 'Google token tidak valid'
      });
    }

    // Cari tenant
    const tenant = await Tenant.findOne({ slug: tenantSlug.toLowerCase() }).lean();
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant tidak ditemukan'
      });
    }

    if (!tenant.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Tenant tidak aktif'
      });
    }

    // Koneksi ke database tenant
    const tenantDB = await getTenantDB(tenant.dbName);
    const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);

    // Cari user berdasarkan Google ID atau email
    let user = await EmployeeModel.findOne({
      $or: [
        { googleId: googleUser.sub },
        { email: googleUser.email }
      ]
    });

    if (user) {
      // User sudah ada, update Google ID jika belum ada
      if (!user.googleId) {
        user.googleId = googleUser.sub;
        user.authProvider = 'google';
        user.isVerified = true; // Google email sudah terverifikasi
        await user.save();
      }

      console.log('[GOOGLE AUTH] Existing user logged in', {
        email: user.email,
        tenant: tenantSlug
      });
    } else {
      // User baru, buat akun
      const employeeId = `EMP-${Date.now()}`;
      
      user = await EmployeeModel.create({
        id: employeeId,
        username: googleUser.email.split('@')[0],
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.sub,
        authProvider: 'google',
        role: 'admin', // First Google user becomes admin
        role_access: ['POS', 'Kitchen', 'Meja', 'Keuangan', 'Laporan', 'Menu', 'Pegawai', 'Pengaturan'],
        status: 'active',
        isActive: true,
        isVerified: true, // Google email sudah terverifikasi
        password: null // No password for Google auth
      });

      console.log('[GOOGLE AUTH] New user created', {
        email: user.email,
        tenant: tenantSlug
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant: tenantSlug
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Response sukses
    res.json({
      success: true,
      message: 'Login dengan Google berhasil',
      token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        authProvider: user.authProvider
      }
    });

  } catch (error) {
    console.error('[GOOGLE AUTH ERROR] Gagal login dengan Google:', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat login dengan Google'
    });
  }
};

module.exports = {
  googleAuth
};
