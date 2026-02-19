const nodemailer = require('nodemailer');

/**
 * Email Service untuk mengirim OTP dan notifikasi
 * Menggunakan Nodemailer dengan SMTP
 */

// Konfigurasi transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true untuk 465, false untuk port lain
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

/**
 * Generate OTP 6 digit
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Kirim OTP ke email
 */
const sendOTPEmail = async (email, otp, tenantName) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"SuperKafe by LockApp" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Kode Verifikasi SuperKafe - ${tenantName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 20px;
              overflow: hidden;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 40px 20px;
              text-align: center;
              color: white;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .header p {
              margin: 10px 0 0 0;
              opacity: 0.9;
              font-size: 14px;
            }
            .content {
              padding: 40px 30px;
            }
            .otp-box {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 15px;
              padding: 30px;
              text-align: center;
              margin: 30px 0;
            }
            .otp-code {
              font-size: 48px;
              font-weight: bold;
              letter-spacing: 10px;
              color: white;
              margin: 0;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
            }
            .otp-label {
              color: rgba(255,255,255,0.9);
              font-size: 14px;
              margin-top: 10px;
            }
            .info {
              background: #f8f9fa;
              border-left: 4px solid #667eea;
              padding: 15px 20px;
              margin: 20px 0;
              border-radius: 5px;
            }
            .info p {
              margin: 5px 0;
              color: #666;
              font-size: 14px;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 25px;
              margin: 20px 0;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Verifikasi Email Anda</h1>
              <p>${tenantName}</p>
            </div>
            <div class="content">
              <p>Halo,</p>
              <p>Terima kasih telah mendaftar di SuperKafe! Gunakan kode OTP di bawah ini untuk memverifikasi email Anda:</p>
              
              <div class="otp-box">
                <p class="otp-code">${otp}</p>
                <p class="otp-label">Kode Verifikasi</p>
              </div>

              <div class="info">
                <p><strong>⏰ Kode ini berlaku selama 10 menit</strong></p>
                <p>Jangan bagikan kode ini kepada siapapun</p>
                <p>Jika Anda tidak merasa mendaftar, abaikan email ini</p>
              </div>

              <p>Setelah verifikasi berhasil, Anda dapat langsung login dan mulai menggunakan SuperKafe untuk mengelola bisnis kafe Anda.</p>
            </div>
            <div class="footer">
              <p>© 2025 SuperKafe by LockApp. All rights reserved.</p>
              <p>Email ini dikirim otomatis, mohon tidak membalas.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('[EMAIL] OTP sent successfully:', {
      messageId: info.messageId,
      email: email,
      tenant: tenantName
    });

    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send OTP:', {
      error: error.message,
      stack: error.stack,
      email: email
    });

    throw error;
  }
};

/**
 * Kirim email welcome setelah verifikasi berhasil
 */
const sendWelcomeEmail = async (email, name, tenantName, tenantSlug) => {
  try {
    const transporter = createTransporter();

    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5002'}/auth/login`;

    const mailOptions = {
      from: `"SuperKafe by LockApp" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Selamat Datang di SuperKafe - ${tenantName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 20px;
              overflow: hidden;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 40px 20px;
              text-align: center;
              color: white;
            }
            .content {
              padding: 40px 30px;
            }
            .button {
              display: inline-block;
              padding: 15px 40px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 25px;
              margin: 20px 0;
              font-weight: 600;
            }
            .info-box {
              background: #f8f9fa;
              border-radius: 10px;
              padding: 20px;
              margin: 20px 0;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Selamat Datang!</h1>
              <p>${tenantName}</p>
            </div>
            <div class="content">
              <p>Halo ${name},</p>
              <p>Selamat! Akun Anda telah berhasil diverifikasi. Anda sekarang dapat mengakses dashboard SuperKafe dan mulai mengelola bisnis kafe Anda.</p>
              
              <div class="info-box">
                <h3>📋 Informasi Akun Anda:</h3>
                <p><strong>Tenant:</strong> ${tenantName}</p>
                <p><strong>Slug:</strong> ${tenantSlug}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Role:</strong> Administrator</p>
              </div>

              <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Login Sekarang</a>
              </div>

              <h3>🚀 Langkah Selanjutnya:</h3>
              <ol>
                <li>Login ke dashboard admin</li>
                <li>Lengkapi profil toko Anda</li>
                <li>Tambahkan menu dan produk</li>
                <li>Mulai menerima pesanan!</li>
              </ol>

              <p>Jika Anda memiliki pertanyaan, jangan ragu untuk menghubungi tim support kami.</p>
            </div>
            <div class="footer">
              <p>© 2025 SuperKafe by LockApp. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('[EMAIL] Welcome email sent:', {
      messageId: info.messageId,
      email: email
    });

    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error) {
    console.error('[EMAIL ERROR] Failed to send welcome email:', {
      error: error.message,
      email: email
    });

    // Don't throw error for welcome email, just log it
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendWelcomeEmail
};
