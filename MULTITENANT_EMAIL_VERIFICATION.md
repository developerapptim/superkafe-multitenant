# SuperKafe - Email Verification Implementation Guide

## 📋 Overview

Sistem email verification telah berhasil diimplementasikan pada platform SuperKafe multitenant. Setiap tenant baru yang mendaftar akan menerima kode OTP 6 digit melalui email dan harus memverifikasi email mereka sebelum dapat login.

## ✅ Fitur yang Telah Diimplementasikan

### Backend

1. **Email Service** (`backend/services/emailService.js`)
   - Generate OTP 6 digit
   - Kirim OTP email dengan template glassmorphism
   - Kirim welcome email setelah verifikasi berhasil
   - Menggunakan Nodemailer dengan SMTP

2. **Verification Controller** (`backend/controllers/VerificationController.js`)
   - `POST /api/verify/otp` - Verifikasi kode OTP
   - `POST /api/verify/resend-otp` - Kirim ulang kode OTP
   - Validasi OTP expiry (10 menit)
   - Auto-clear OTP setelah verifikasi berhasil

3. **Updated Models**
   - `Employee.js` - Tambah fields: `email`, `isVerified`, `otpCode`, `otpExpiry`, `googleId`, `authProvider`

4. **Updated Controllers**
   - `TenantController.js` - Generate OTP saat registrasi, kirim email, create admin dengan `isVerified: false`
   - `AuthController.js` - Check `isVerified` sebelum allow login, support login dengan email

5. **Routes**
   - `backend/routes/verificationRoutes.js` - Routes untuk OTP verification
   - Registered di `server.js`

### Frontend

1. **Updated Registration Form** (`frontend/src/pages/auth/TenantRegister.jsx`)
   - Tambah fields: Email, Password, Admin Name
   - Validasi email format
   - Validasi password minimal 6 karakter
   - Redirect ke halaman OTP verification setelah registrasi

2. **OTP Verification Page** (`frontend/src/pages/auth/OTPVerification.jsx`)
   - Input 6 digit OTP dengan auto-focus
   - Support paste OTP dari clipboard
   - Countdown timer untuk resend OTP (60 detik)
   - Glassmorphism design konsisten

3. **Updated Login** (`frontend/src/pages/auth/TenantLogin.jsx`)
   - Handle error `requiresVerification`
   - Auto-redirect ke OTP verification jika email belum diverifikasi
   - Support login dengan email atau username

4. **API Service** (`frontend/src/services/api.js`)
   - Tambah `verificationAPI` dengan methods: `verifyOTP`, `resendOTP`
   - Tambah `googleAuthAPI` untuk future Google OAuth integration

5. **Routing** (`frontend/src/App.jsx`)
   - Route `/auth/verify-otp` untuk halaman verifikasi OTP

## 🔧 Setup & Configuration

### 1. Install Dependencies

```bash
cd backend
npm install nodemailer google-auth-library
```

### 2. Configure Environment Variables

Edit `backend/.env`:

```env
# SMTP Configuration (Gmail Example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL (untuk link di email)
FRONTEND_URL=http://localhost:5002

# Google OAuth (Optional - untuk future implementation)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. Gmail App Password Setup

Jika menggunakan Gmail:

1. Buka Google Account Settings
2. Security → 2-Step Verification (aktifkan jika belum)
3. App Passwords → Generate new app password
4. Pilih "Mail" dan "Other (Custom name)"
5. Copy password yang di-generate
6. Paste ke `SMTP_PASS` di `.env`

## 📝 User Flow

### Registration Flow

1. User mengisi form registrasi:
   - Nama Kafe/Warkop
   - Slug Tenant (auto-generated dari nama)
   - Nama Admin (optional, default: "Administrator")
   - Email Admin
   - Password (minimal 6 karakter)

2. Backend:
   - Validasi input (email format, password length, slug uniqueness)
   - Create tenant entry di database utama
   - Create database tenant baru
   - Seed settings default
   - Generate OTP 6 digit
   - Create admin user dengan `isVerified: false`
   - Kirim OTP ke email
   - Return success response

3. Frontend:
   - Simpan `tenant_slug` dan `pending_email` ke localStorage
   - Redirect ke `/auth/verify-otp`

### Verification Flow

1. User menerima email dengan kode OTP
2. User input 6 digit OTP di halaman verifikasi
3. Backend:
   - Validasi OTP code
   - Check expiry (10 menit)
   - Update `isVerified: true`
   - Clear `otpCode` dan `otpExpiry`
   - Kirim welcome email
4. Frontend:
   - Clear `pending_email` dari localStorage
   - Redirect ke `/auth/login` dengan success message

### Login Flow

1. User input tenant_slug, username/email, password
2. Backend:
   - Find employee by username/email
   - Check `isVerified` status
   - If not verified: return error dengan `requiresVerification: true`
   - If verified: validate password, generate JWT token
3. Frontend:
   - If `requiresVerification`: redirect ke `/auth/verify-otp`
   - If success: save token, redirect ke dashboard

## 🔐 Security Features

1. **OTP Expiry**: Kode OTP berlaku 10 menit
2. **Password Hashing**: Semua password di-hash dengan bcrypt (salt rounds: 10)
3. **Email Validation**: Validasi format email di frontend dan backend
4. **Slug Validation**: Hanya lowercase, angka, dan dash
5. **Rate Limiting**: Resend OTP dibatasi dengan countdown 60 detik
6. **Auto-clear OTP**: OTP dihapus setelah verifikasi berhasil

## 📧 Email Templates

### OTP Email
- Subject: `Kode Verifikasi SuperKafe - {tenantName}`
- Design: Glassmorphism dengan gradient purple-blue
- Content: Kode OTP 6 digit, expiry warning, security tips

### Welcome Email
- Subject: `Selamat Datang di SuperKafe - {tenantName}`
- Content: Informasi akun, next steps, login link

## 🧪 Testing

### Manual Testing

1. **Test Registration**:
   ```
   POST http://localhost:5001/api/tenants/register
   Body: {
     "name": "Test Warkop",
     "slug": "test-warkop",
     "email": "test@example.com",
     "password": "password123",
     "adminName": "Test Admin"
   }
   ```

2. **Check Email**: Cek inbox untuk OTP code

3. **Test Verification**:
   ```
   POST http://localhost:5001/api/verify/otp
   Body: {
     "email": "test@example.com",
     "otpCode": "123456",
     "tenantSlug": "test-warkop"
   }
   ```

4. **Test Login**:
   ```
   POST http://localhost:5001/api/login
   Headers: { "x-tenant-id": "test-warkop" }
   Body: {
     "username": "test@example.com",
     "password": "password123"
   }
   ```

### Test Scenarios

- ✅ Registration dengan email valid
- ✅ OTP verification dengan kode benar
- ✅ OTP verification dengan kode salah
- ✅ OTP verification dengan kode expired
- ✅ Resend OTP
- ✅ Login sebelum verifikasi (should fail)
- ✅ Login setelah verifikasi (should success)
- ✅ Login dengan email
- ✅ Login dengan username

## 🚀 Next Steps (Future Enhancements)

### 1. Google OAuth Integration

File sudah disiapkan:
- `backend/controllers/GoogleAuthController.js`
- `backend/routes/googleAuthRoutes.js`
- `frontend/src/services/api.js` (googleAuthAPI)

Implementation steps:
1. Install `@react-oauth/google` di frontend
2. Setup Google OAuth credentials
3. Add Google login button di login page
4. Handle Google callback
5. Create/update user dengan `authProvider: 'google'`

### 2. Password Reset

Tambahkan fitur:
- Forgot password link di login page
- Generate reset token
- Send reset email
- Reset password form
- Update password dengan bcrypt

### 3. Email Verification Reminder

- Kirim reminder email jika user belum verifikasi setelah 24 jam
- Auto-delete unverified accounts setelah 7 hari

### 4. Two-Factor Authentication (2FA)

- Optional 2FA untuk admin accounts
- TOTP-based (Google Authenticator)
- Backup codes

## 📚 Documentation Files

- `backend/docs/EMAIL_VERIFICATION_GUIDE.md` - Detailed backend guide
- `backend/INSTALL_DEPENDENCIES.md` - Setup instructions
- `backend/.env.example` - Environment variables template
- `MULTITENANT_IMPLEMENTATION.md` - Multitenant architecture guide
- `frontend/MULTITENANT_GUIDE.md` - Frontend implementation guide

## 🐛 Troubleshooting

### Email tidak terkirim

1. Check SMTP credentials di `.env`
2. Check Gmail App Password (bukan password biasa)
3. Check firewall/antivirus blocking port 587
4. Check backend logs untuk error details

### OTP expired

- OTP berlaku 10 menit
- Gunakan "Kirim ulang kode" untuk generate OTP baru

### Login gagal setelah verifikasi

1. Check `isVerified` field di database
2. Check tenant_slug di localStorage
3. Check x-tenant-id header di request

## 📞 Support

Jika ada pertanyaan atau issue:
1. Check backend logs: `backend/server.js` console output
2. Check browser console untuk frontend errors
3. Check email service logs di `emailService.js`

---

**Status**: ✅ Fully Implemented and Ready for Testing

**Last Updated**: 2025-02-20

**Version**: 1.0.0
