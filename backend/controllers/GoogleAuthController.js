const { getTenantDB } = require('../config/db');
const Tenant = require('../models/Tenant');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

/**
 * Google Auth Controller untuk Multitenant
 * 
 * Flow Narasi (Auto Register/Login):
 * 1. Frontend mengirim Google ID Token + tenant slug
 * 2. Backend verify token dengan Google
 * 3. Pengecekan Akun:
 *    - Jika email belum terdaftar → Auto Register (buat akun baru)
 *    - Jika email sudah terdaftar → Auto Login
 * 4. Data Default untuk user baru: Nama & Foto Profil dari Google
 * 5. Return JWT token untuk akses Dashboard
 */

/**
 * POST /api/auth/google
 * Login/Register Otomatis dengan Google
 * 
 * Support 2 mode:
 * 1. Login ke tenant existing (idToken + tenantSlug)
 * 2. Register tenant baru (email, name, picture, googleId + tenantSlug)
 */
const googleAuth = async (req, res) => {
  try {
    const { idToken, tenantSlug, email, name, picture } = req.body;

    // Validasi input
    if (!tenantSlug) {
      return res.status(400).json({
        success: false,
        message: 'Tenant slug wajib diisi'
      });
    }

    let googleUser;

    // Mode 1: Verify ID Token (dari Google Sign-In button)
    if (idToken && !email) {
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      
      try {
        const ticket = await client.verifyIdToken({
          idToken: idToken,
          audience: process.env.GOOGLE_CLIENT_ID
        });
        googleUser = ticket.getPayload();
        
        console.log('[GOOGLE AUTH] Token verified for:', {
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture
        });
      } catch (verifyError) {
        console.error('[GOOGLE AUTH] Token verification failed:', verifyError.message);
        return res.status(401).json({
          success: false,
          message: 'Google token tidak valid'
        });
      }
    } 
    // Mode 2: Direct data dari frontend (untuk registrasi tenant baru)
    else if (email && name) {
      googleUser = {
        sub: idToken, // Google User ID
        email: email,
        name: name,
        picture: picture
      };
      
      console.log('[GOOGLE AUTH] Direct auth data:', {
        email: googleUser.email,
        name: googleUser.name
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Data Google tidak lengkap'
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

    // PENGECEKAN AKUN: Cari user berdasarkan email atau Google ID
    let user = await EmployeeModel.findOne({
      $or: [
        { googleId: googleUser.sub },
        { email: googleUser.email }
      ]
    });

    let isNewUser = false;

    if (user) {
      // ✅ AUTO-LOGIN: Email sudah terdaftar
      console.log('[GOOGLE AUTH] ✅ Auto-Login - Email sudah terdaftar:', {
        email: user.email,
        name: user.name,
        tenant: tenantSlug
      });

      // Update Google ID dan foto profil jika belum ada
      let needsUpdate = false;
      
      if (!user.googleId) {
        user.googleId = googleUser.sub;
        user.authProvider = 'google';
        user.isVerified = true;
        needsUpdate = true;
      }

      // Update foto profil dari Google jika belum ada atau masih default
      if (!user.image || user.image === '' || user.image.includes('default')) {
        user.image = googleUser.picture;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save();
        console.log('[GOOGLE AUTH] User data updated with Google info');
      }

    } else {
      // 🆕 AUTO-REGISTER: Email belum terdaftar, buat akun baru
      isNewUser = true;
      const employeeId = `EMP-${Date.now()}`;
      
      // DATA DEFAULT: Ambil Nama & Foto Profil dari Google
      user = await EmployeeModel.create({
        id: employeeId,
        username: googleUser.email.split('@')[0], // username dari email
        email: googleUser.email,
        name: googleUser.name, // ✅ Nama dari Google
        image: googleUser.picture, // ✅ Foto Profil dari Google
        googleId: googleUser.sub,
        authProvider: 'google',
        role: 'admin', // User pertama jadi admin
        role_access: ['POS', 'Kitchen', 'Meja', 'Keuangan', 'Laporan', 'Menu', 'Pegawai', 'Pengaturan'],
        status: 'active',
        isActive: true,
        isVerified: true, // Email Google sudah terverifikasi
        password: null // Tidak perlu password untuk Google auth
      });

      console.log('[GOOGLE AUTH] 🆕 Auto-Register - Akun baru dibuat:', {
        email: user.email,
        name: user.name,
        picture: user.image,
        tenant: tenantSlug
      });
    }

    // Generate JWT token untuk akses Dashboard
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant: tenantSlug,
        tenantDbName: tenant.dbName
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Response sukses
    res.json({
      success: true,
      message: isNewUser 
        ? 'Akun berhasil dibuat dengan Google. Selamat datang!' 
        : 'Login dengan Google berhasil',
      isNewUser: isNewUser,
      token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        image: user.image, // Foto profil dari Google
        role: user.role,
        role_access: user.role_access,
        isVerified: user.isVerified,
        authProvider: user.authProvider
      },
      tenant: {
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status
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

/**
 * GET /api/auth/google/callback
 * OAuth Callback Handler (untuk redirect flow dari Google)
 * 
 * Flow ini digunakan jika frontend menggunakan OAuth redirect flow
 * instead of token-based flow
 */
const googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/login?error=no_code`);
    }

    // Decode state untuk mendapatkan tenant slug
    let tenantSlug = 'demo'; // default
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        tenantSlug = stateData.tenant || 'demo';
      } catch (e) {
        console.warn('[GOOGLE CALLBACK] Failed to parse state:', e.message);
      }
    }

    // Exchange code for tokens
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/auth/google/callback`
    );

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Verify ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const googleUser = ticket.getPayload();

    console.log('[GOOGLE CALLBACK] User authenticated:', {
      email: googleUser.email,
      tenant: tenantSlug
    });

    // Cari tenant
    const tenant = await Tenant.findOne({ slug: tenantSlug.toLowerCase() }).lean();
    if (!tenant) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5174'}/login?error=tenant_not_found`);
    }

    // Koneksi ke database tenant
    const tenantDB = await getTenantDB(tenant.dbName);
    const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);

    // Cari atau buat user
    let user = await EmployeeModel.findOne({
      $or: [
        { googleId: googleUser.sub },
        { email: googleUser.email }
      ]
    });

    let isNewUser = false;

    if (!user) {
      // Auto-register
      isNewUser = true;
      const employeeId = `EMP-${Date.now()}`;
      
      user = await EmployeeModel.create({
        id: employeeId,
        username: googleUser.email.split('@')[0],
        email: googleUser.email,
        name: googleUser.name,
        image: googleUser.picture,
        googleId: googleUser.sub,
        authProvider: 'google',
        role: 'admin',
        role_access: ['POS', 'Kitchen', 'Meja', 'Keuangan', 'Laporan', 'Menu', 'Pegawai', 'Pengaturan'],
        status: 'active',
        isActive: true,
        isVerified: true,
        password: null
      });

      console.log('[GOOGLE CALLBACK] New user registered:', user.email);
    } else {
      // Update existing user
      if (!user.googleId) {
        user.googleId = googleUser.sub;
        user.authProvider = 'google';
        user.isVerified = true;
      }
      if (!user.image || user.image === '' || user.image.includes('default')) {
        user.image = googleUser.picture;
      }
      await user.save();
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant: tenantSlug,
        tenantDbName: tenant.dbName
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Redirect ke frontend dengan token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&tenant=${tenantSlug}&isNewUser=${isNewUser}`);

  } catch (error) {
    console.error('[GOOGLE CALLBACK ERROR]:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
};

module.exports = {
  googleAuth,
  googleCallback
};
