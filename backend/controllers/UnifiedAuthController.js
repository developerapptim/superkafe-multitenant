const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Employee = require('../models/Employee');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { runWithTenantContext } = require('../utils/tenantContext');

/**
 * Unified Auth Controller
 * 
 * Flow baru:
 * 1. Register/Login → Buat User (belum ada tenant)
 * 2. Setup Wizard → Buat Tenant + pindahkan User ke Employee
 */

/**
 * Helper function to get employee data with tenant context
 * @param {Object} user - User object with tenantId
 * @returns {Object} Token payload with employee data
 */
const getEmployeeTokenPayload = async (user) => {
  let tokenPayload = {
    userId: user._id,
    email: user.email,
    hasCompletedSetup: user.hasCompletedSetup,
    tenantSlug: user.tenantSlug
  };

  if (user.hasCompletedSetup && user.tenantId) {
    // Fetch tenant info
    const tenant = await Tenant.findById(user.tenantId);
    if (tenant) {
      // Get employee data using tenant context
      const employee = await runWithTenantContext(
        { id: tenant._id.toString(), slug: tenant.slug, name: tenant.name, dbName: tenant.dbName },
        async () => {
          return await Employee.findOne({ email: user.email }).lean();
        }
      );

      if (employee) {
        tokenPayload = {
          id: employee._id.toString(),
          email: employee.email,
          role: employee.role,
          tenant: tenant.slug,
          tenantSlug: tenant.slug, // CRITICAL: Add tenantSlug for frontend header
          tenantId: tenant._id.toString(),
          tenantDbName: tenant.dbName,
          userId: user._id.toString()
        };
      }
    }
  }

  return tokenPayload;
};

/**
 * POST /api/auth/register
 * Register user baru (tanpa tenant)
 */
const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validasi input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, dan nama wajib diisi'
      });
    }

    // Validasi format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid'
      });
    }

    // Validasi password minimal 6 karakter
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal 6 karakter'
      });
    }

    // Cek apakah email sudah terdaftar
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate OTP untuk verifikasi email
    const { generateOTP, sendOTPEmail } = require('../services/emailService');
    const otpCode = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

    // Buat user baru
    const newUser = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name.trim(),
      authProvider: 'local',
      isVerified: false,
      otpCode: otpCode,
      otpExpiry: otpExpiry,
      hasCompletedSetup: false
    });

    console.log('[AUTH] User baru berhasil dibuat', {
      email: newUser.email,
      name: newUser.name,
      authProvider: newUser.authProvider
    });

    // Kirim OTP ke email
    try {
      await sendOTPEmail(email, otpCode, name);
      console.log('[AUTH] OTP email sent successfully');
    } catch (emailError) {
      console.error('[AUTH] Failed to send OTP email:', emailError.message);
    }

    // Response sukses
    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil! Silakan cek email Anda untuk kode verifikasi.',
      data: {
        email: newUser.email,
        name: newUser.name,
        requiresVerification: true,
        hasCompletedSetup: false
      }
    });

  } catch (error) {
    console.error('[AUTH ERROR] Gagal register:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat registrasi'
    });
  }
};

/**
 * POST /api/auth/login
 * Login user (tanpa tenant slug)
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validasi input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password wajib diisi'
      });
    }

    // Cari user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah'
      });
    }

    // Cek password (skip untuk Google auth)
    if (user.authProvider === 'local') {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Email atau password salah'
        });
      }
    }

    // Cek verifikasi email (untuk local auth)
    if (user.authProvider === 'local' && !user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email belum diverifikasi',
        requiresVerification: true,
        email: user.email
      });
    }

    // Get token payload with employee data if setup completed
    const tokenPayload = await getEmployeeTokenPayload(user);

    // Generate JWT token
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log('[AUTH] User berhasil login', {
      email: user.email,
      hasCompletedSetup: user.hasCompletedSetup
    });

    // Fetch tenant data if setup completed
    let tenantData = null;
    if (user.hasCompletedSetup && user.tenantId) {
      const tenant = await Tenant.findById(user.tenantId);
      if (tenant) {
        tenantData = {
          id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          selectedTheme: tenant.selectedTheme,
          hasSeenThemePopup: tenant.hasSeenThemePopup
        };
      }
    }

    // Response sukses
    const response = {
      success: true,
      message: 'Login berhasil',
      token: token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        image: user.image,
        authProvider: user.authProvider,
        hasCompletedSetup: user.hasCompletedSetup,
        tenantSlug: user.tenantSlug
      }
    };

    if (tenantData) {
      response.tenant = tenantData;
    }

    res.json(response);

  } catch (error) {
    console.error('[AUTH ERROR] Gagal login:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat login'
    });
  }
};

/**
 * POST /api/auth/google
 * Register/Login dengan Google (tanpa tenant)
 */
const googleAuth = async (req, res) => {
  try {
    const { idToken, email, name, picture } = req.body;

    let googleUser;

    // Mode 1: Verify ID Token
    if (idToken && !email) {
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      
      try {
        const ticket = await client.verifyIdToken({
          idToken: idToken,
          audience: process.env.GOOGLE_CLIENT_ID
        });
        googleUser = ticket.getPayload();
      } catch (verifyError) {
        console.error('[AUTH] Google token verification failed:', verifyError.message);
        return res.status(401).json({
          success: false,
          message: 'Google token tidak valid'
        });
      }
    } 
    // Mode 2: Direct data
    else if (email && name) {
      googleUser = {
        sub: idToken,
        email: email,
        name: name,
        picture: picture
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Data Google tidak lengkap'
      });
    }

    // Cari user berdasarkan email atau Google ID
    let user = await User.findOne({
      $or: [
        { googleId: googleUser.sub },
        { email: googleUser.email.toLowerCase() }
      ]
    });

    let isNewUser = false;

    if (!user) {
      // Buat user baru
      isNewUser = true;
      user = await User.create({
        email: googleUser.email.toLowerCase(),
        name: googleUser.name,
        image: googleUser.picture,
        googleId: googleUser.sub,
        authProvider: 'google',
        isVerified: true, // Google email sudah terverifikasi
        hasCompletedSetup: false,
        password: null
      });

      console.log('[AUTH] User baru dibuat dengan Google', {
        email: user.email,
        name: user.name
      });
    } else {
      // Update existing user
      if (!user.googleId) {
        user.googleId = googleUser.sub;
        user.authProvider = 'google';
        user.isVerified = true;
      }
      if (!user.image) {
        user.image = googleUser.picture;
      }
      await user.save();

      console.log('[AUTH] User existing login dengan Google', {
        email: user.email
      });
    }

    // Get token payload with employee data if setup completed
    const tokenPayload = await getEmployeeTokenPayload(user);

    // Generate JWT token
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Fetch tenant data if setup completed
    let tenantData = null;
    if (user.hasCompletedSetup && user.tenantId) {
      const tenant = await Tenant.findById(user.tenantId);
      if (tenant) {
        tenantData = {
          id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          selectedTheme: tenant.selectedTheme,
          hasSeenThemePopup: tenant.hasSeenThemePopup
        };
      }
    }

    // Response sukses
    const response = {
      success: true,
      message: isNewUser 
        ? 'Akun berhasil dibuat dengan Google!' 
        : 'Login dengan Google berhasil!',
      isNewUser: isNewUser,
      token: token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        image: user.image,
        authProvider: user.authProvider,
        hasCompletedSetup: user.hasCompletedSetup,
        tenantSlug: user.tenantSlug
      }
    };

    if (tenantData) {
      response.tenant = tenantData;
    }

    res.json(response);

  } catch (error) {
    console.error('[AUTH ERROR] Gagal Google auth:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat login dengan Google'
    });
  }
};

/**
 * POST /api/auth/verify-otp
 * Verifikasi OTP untuk email verification
 */
const verifyOTP = async (req, res) => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Email dan kode OTP wajib diisi'
      });
    }

    // Cari user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    // Cek OTP
    if (user.otpCode !== otpCode) {
      return res.status(401).json({
        success: false,
        message: 'Kode OTP tidak valid'
      });
    }

    // Cek expiry
    if (new Date() > user.otpExpiry) {
      return res.status(401).json({
        success: false,
        message: 'Kode OTP sudah kadaluarsa'
      });
    }

    // Update user
    user.isVerified = true;
    user.otpCode = null;
    user.otpExpiry = null;
    await user.save();

    console.log('[AUTH] Email verified successfully', {
      email: user.email
    });

    // Get token payload with employee data if setup completed
    const tokenPayload = await getEmployeeTokenPayload(user);

    // Generate JWT token
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Fetch tenant data if setup completed
    let tenantData = null;
    if (user.hasCompletedSetup && user.tenantId) {
      const tenant = await Tenant.findById(user.tenantId);
      if (tenant) {
        tenantData = {
          id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          selectedTheme: tenant.selectedTheme,
          hasSeenThemePopup: tenant.hasSeenThemePopup
        };
      }
    }

    const response = {
      success: true,
      message: 'Email berhasil diverifikasi!',
      token: token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        image: user.image,
        authProvider: user.authProvider,
        hasCompletedSetup: user.hasCompletedSetup,
        tenantSlug: user.tenantSlug
      }
    };

    if (tenantData) {
      response.tenant = tenantData;
    }

    res.json(response);

  } catch (error) {
    console.error('[AUTH ERROR] Gagal verify OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat verifikasi OTP'
    });
  }
};

/**
 * POST /api/auth/resend-otp
 * Kirim ulang OTP untuk verifikasi email
 */
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email wajib diisi'
      });
    }

    // Cari user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    // Cek apakah sudah terverifikasi
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah terverifikasi'
      });
    }

    // Generate OTP baru
    const { generateOTP, sendOTPEmail } = require('../services/emailService');
    const otpCode = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

    // Update user
    user.otpCode = otpCode;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Kirim OTP ke email
    try {
      await sendOTPEmail(email, otpCode, user.name);
      console.log('[AUTH] OTP resent successfully');
    } catch (emailError) {
      console.error('[AUTH] Failed to resend OTP email:', emailError.message);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengirim email OTP'
      });
    }

    res.json({
      success: true,
      message: 'Kode OTP baru telah dikirim ke email Anda'
    });

  } catch (error) {
    console.error('[AUTH ERROR] Gagal resend OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengirim ulang OTP'
    });
  }
};

module.exports = {
  register,
  login,
  googleAuth,
  verifyOTP,
  resendOTP
};
