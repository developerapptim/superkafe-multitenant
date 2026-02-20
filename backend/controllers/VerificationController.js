const { getTenantDB } = require('../config/db');
const { generateOTP, sendOTPEmail, sendWelcomeEmail } = require('../services/emailService');
const Tenant = require('../models/Tenant');

/**
 * POST /api/verify/otp
 * Verifikasi OTP code
 */
const verifyOTP = async (req, res) => {
  try {
    const { email, otpCode, tenantSlug } = req.body;

    // Validasi input
    if (!email || !otpCode || !tenantSlug) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP code, dan tenant slug wajib diisi'
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

    // Koneksi ke database tenant
    const tenantDB = await getTenantDB(tenant.dbName);
    const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);

    // Cari user berdasarkan email
    const user = await EmployeeModel.findOne({ email: email });

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

    // Cek OTP code
    if (user.otpCode !== otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Kode OTP tidak valid'
      });
    }

    // Cek expiry
    if (new Date() > user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'Kode OTP sudah kadaluarsa. Silakan minta kode baru.'
      });
    }

    // Update user sebagai terverifikasi
    user.isVerified = true;
    user.otpCode = null;
    user.otpExpiry = null;
    await user.save();

    console.log('[VERIFY] User berhasil diverifikasi', {
      email: email,
      tenant: tenantSlug
    });

    // Kirim welcome email
    try {
      await sendWelcomeEmail(email, user.name, tenant.name, tenant.slug);
    } catch (emailError) {
      console.error('[VERIFY] Failed to send welcome email:', emailError.message);
    }

    res.json({
      success: true,
      message: 'Email berhasil diverifikasi! Anda sekarang dapat login.',
      data: {
        email: user.email,
        name: user.name,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error('[VERIFY ERROR] Gagal verifikasi OTP:', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat verifikasi OTP'
    });
  }
};

/**
 * POST /api/verify/resend-otp
 * Kirim ulang OTP code
 */
const resendOTP = async (req, res) => {
  try {
    const { email, tenantSlug } = req.body;

    // Validasi input
    if (!email || !tenantSlug) {
      return res.status(400).json({
        success: false,
        message: 'Email dan tenant slug wajib diisi'
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

    // Koneksi ke database tenant
    const tenantDB = await getTenantDB(tenant.dbName);
    const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);

    // Cari user berdasarkan email
    const user = await EmployeeModel.findOne({ email: email });

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
    const otpCode = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

    // Update user dengan OTP baru
    user.otpCode = otpCode;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Kirim OTP ke email
    await sendOTPEmail(email, otpCode, tenant.name);

    console.log('[VERIFY] OTP baru berhasil dikirim', {
      email: email,
      tenant: tenantSlug
    });

    res.json({
      success: true,
      message: 'Kode OTP baru telah dikirim ke email Anda'
    });

  } catch (error) {
    console.error('[VERIFY ERROR] Gagal mengirim ulang OTP:', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengirim ulang OTP'
    });
  }
};

module.exports = {
  verifyOTP,
  resendOTP
};
