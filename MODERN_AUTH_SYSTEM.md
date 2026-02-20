# 🚀 SuperKafe Modern Authentication System

## 📋 Overview

Sistem autentikasi SuperKafe telah dimodernisasi dengan fitur-fitur canggih untuk mendukung:
- **Global Login**: Login dengan email tanpa perlu input tenant slug
- **Shared Tablet**: Satu tablet untuk banyak staff dengan PIN authentication
- **Device Binding**: Tablet terdaftar otomatis ke tenant tertentu
- **Auto-Lock**: Keamanan otomatis setelah 5 menit idle
- **Admin Override**: Otorisasi cepat tanpa logout

## ✨ Fitur Utama

### 1. Global Login (Email-Based)
- User hanya perlu input email dan password
- Sistem otomatis mencari email di semua tenant databases
- Auto-detect tenant dan redirect ke dashboard yang sesuai
- Glassmorphism design yang modern dan elegan

### 2. Shared Tablet System
- Satu tablet bisa digunakan oleh banyak staff
- Staff selection screen dengan foto profil
- PIN authentication (4-6 digit) untuk keamanan
- Visual numpad untuk input PIN
- Device binding ke tenant tertentu

### 3. Device Binding
- Setelah admin login pertama kali, device ter-bind ke tenant
- Staff bisa langsung pilih nama mereka tanpa input tenant slug
- Persistent storage menggunakan localStorage
- Admin bisa unbind device jika diperlukan

### 4. Auto-Lock Security
- Otomatis lock setelah 5 menit tidak ada aktivitas
- Warning 30 detik sebelum auto-lock
- Hanya berlaku untuk non-admin roles
- Redirect ke PIN input screen (bukan logout complete)

### 5. Admin Override
- Admin bisa otorisasi aksi sensitif dengan PIN
- Tidak perlu logout dari akun staff yang sedang aktif
- Modal popup untuk input PIN admin
- Cocok untuk delete transaksi, void order, dll

## 🏗️ Arsitektur

### Backend Structure

```
backend/
├── controllers/
│   ├── GlobalAuthController.js    # NEW: Global auth logic
│   └── AuthController.js          # Legacy auth (tetap ada)
├── routes/
│   ├── globalAuthRoutes.js        # NEW: Modern auth routes
│   └── authRoutes.js              # Legacy routes
└── models/
    └── Employee.js                # Updated: pin field (hashed)
```

### Frontend Structure

```
frontend/src/
├── pages/auth/
│   ├── GlobalLogin.jsx            # NEW: Modern login (no tenant slug)
│   ├── DeviceLogin.jsx            # NEW: Shared tablet screen
│   ├── TenantLogin.jsx            # Legacy (masih ada untuk backward compat)
│   └── OTPVerification.jsx        # Email verification
├── components/
│   ├── Numpad.jsx                 # NEW: Visual PIN input
│   └── AdminOverrideModal.jsx     # NEW: Admin authorization
└── context/
    └── IdleContext.jsx            # NEW: Auto-lock system
```

## 🔐 Security Features

### PIN Security
- PIN di-hash dengan bcrypt (salt rounds: 10)
- Tidak pernah disimpan dalam plain text
- Validasi format: 4-6 digit angka
- Rate limiting untuk prevent brute force

### Session Management
- JWT token dengan expiry 24 jam
- Auto-lock untuk non-admin setelah 5 menit idle
- Device binding dengan localStorage
- Secure logout dengan token cleanup

### Admin Authorization
- PIN admin terpisah dari staff PIN
- Verifikasi tanpa logout dari session aktif
- Audit log untuk admin override actions
- Multi-admin support (cek semua admin PINs)

## 📡 API Endpoints

### Global Authentication

#### 1. Global Login
```http
POST /api/auth/global-login
Content-Type: application/json

{
  "email": "admin@warkop.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "token": "jwt_token_here",
  "tenantSlug": "warkop-pusat",
  "tenantName": "Warkop Pusat",
  "user": {
    "id": "emp_001",
    "name": "Admin",
    "email": "admin@warkop.com",
    "role": "admin",
    "image": null,
    "role_access": ["POS", "Kitchen", "Menu"]
  }
}
```

#### 2. Login with PIN
```http
POST /api/auth/login-pin
Content-Type: application/json

{
  "tenantSlug": "warkop-pusat",
  "employeeId": "emp_002",
  "pin": "123456"
}

Response:
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "emp_002",
    "name": "Kasir 1",
    "role": "kasir",
    "image": "/uploads/kasir1.jpg",
    "role_access": ["POS"]
  }
}
```

#### 3. Get Staff List
```http
GET /api/auth/staff-list/:tenantSlug

Response:
{
  "success": true,
  "data": [
    {
      "id": "emp_002",
      "name": "Kasir 1",
      "role": "kasir",
      "image": "/uploads/kasir1.jpg"
    },
    {
      "id": "emp_003",
      "name": "Waiter 1",
      "role": "waiter",
      "image": null
    }
  ],
  "tenantName": "Warkop Pusat"
}
```

#### 4. Verify Admin PIN
```http
POST /api/auth/verify-admin-pin
Content-Type: application/json

{
  "tenantSlug": "warkop-pusat",
  "pin": "999999"
}

Response:
{
  "success": true,
  "message": "PIN admin terverifikasi",
  "adminName": "Admin"
}
```

#### 5. Set/Update PIN
```http
POST /api/auth/set-pin
Authorization: Bearer {token}
Content-Type: application/json

{
  "employeeId": "emp_002",
  "pin": "123456",
  "tenantSlug": "warkop-pusat"
}

Response:
{
  "success": true,
  "message": "PIN berhasil diatur"
}
```

## 🎯 User Flows

### Flow 1: Admin First Login (Device Binding)

```
1. Admin buka app di tablet baru
   ↓
2. Redirect ke /auth/login (GlobalLogin)
   ↓
3. Input email & password
   ↓
4. Backend: Cari email di semua tenant databases
   ↓
5. Found! Return tenant info + token
   ↓
6. Frontend: Save tenant_slug ke localStorage (DEVICE BINDING)
   ↓
7. Redirect ke /admin/dashboard
```

### Flow 2: Staff Login (Shared Tablet)

```
1. Staff buka app di tablet yang sudah ter-bind
   ↓
2. Check localStorage: tenant_slug exists?
   ↓
3. YES → Redirect ke /auth/device-login
   ↓
4. Tampilkan staff selection screen
   ↓
5. Staff pilih nama mereka
   ↓
6. Tampilkan numpad untuk input PIN
   ↓
7. Verify PIN di backend
   ↓
8. Success → Redirect ke /admin/dashboard
```

### Flow 3: Auto-Lock

```
1. Staff login dan bekerja di POS
   ↓
2. Idle detection: No activity for 4.5 minutes
   ↓
3. Show warning toast: "Auto-lock dalam 30 detik"
   ↓
4. Still no activity after 5 minutes
   ↓
5. Clear token (but keep tenant_slug)
   ↓
6. Redirect ke /auth/device-login
   ↓
7. Staff input PIN lagi untuk continue
```

### Flow 4: Admin Override

```
1. Kasir ingin delete transaksi (restricted action)
   ↓
2. System detect: Need admin authorization
   ↓
3. Show AdminOverrideModal
   ↓
4. Admin input PIN mereka
   ↓
5. Backend verify admin PIN
   ↓
6. Success → Allow action
   ↓
7. Log admin override action
   ↓
8. Kasir tetap login (no logout)
```

## 🛠️ Setup & Configuration

### 1. Backend Setup

Tidak perlu install dependencies tambahan, semua sudah ada.

### 2. Database Migration

Update existing employees dengan PIN:

```javascript
// Script untuk set PIN untuk existing employees
const bcrypt = require('bcryptjs');

async function setPINForEmployee(employeeId, pin) {
  const hashedPIN = await bcrypt.hash(pin, 10);
  
  await Employee.findOneAndUpdate(
    { id: employeeId },
    { pin: hashedPIN }
  );
}

// Example usage
await setPINForEmployee('emp_001', '999999'); // Admin PIN
await setPINForEmployee('emp_002', '123456'); // Kasir PIN
```

### 3. Frontend Configuration

Tidak perlu konfigurasi tambahan, semua sudah terintegrasi.

### 4. Testing

#### Test Global Login:
```bash
curl -X POST http://localhost:5001/api/auth/global-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@warkop.com",
    "password": "password123"
  }'
```

#### Test PIN Login:
```bash
curl -X POST http://localhost:5001/api/auth/login-pin \
  -H "Content-Type: application/json" \
  -d '{
    "tenantSlug": "warkop-pusat",
    "employeeId": "emp_002",
    "pin": "123456"
  }'
```

## 📱 Mobile Integration (Capacitor)

### Device Binding dengan Preferences

```javascript
import { Preferences } from '@capacitor/preferences';

// Save tenant binding
await Preferences.set({
  key: 'tenant_slug',
  value: 'warkop-pusat'
});

// Get tenant binding
const { value } = await Preferences.get({ key: 'tenant_slug' });

// Remove binding (unbind device)
await Preferences.remove({ key: 'tenant_slug' });
```

### Auto-Lock Implementation

Sudah terimplementasi di `IdleContext.jsx`:
- Detect mouse, keyboard, touch events
- 5 menit timeout
- Warning 30 detik sebelumnya
- Auto-redirect ke device login

## 🎨 UI/UX Features

### Glassmorphism Design
- Backdrop blur effects
- Gradient backgrounds (purple-blue)
- Smooth animations dengan Framer Motion
- Responsive untuk mobile dan tablet

### Visual Numpad
- Large touch-friendly buttons
- PIN dots indicator
- Backspace dan clear functions
- Submit button dengan validation

### Staff Selection Grid
- Profile photos atau initials
- Name dan role display
- Hover effects
- Responsive grid layout

## 🔄 Backward Compatibility

### Legacy Routes Tetap Ada
- `/auth/tenant-login` - Old login dengan tenant slug
- `/login` - Legacy login route
- Existing auth flow tidak broken

### Migration Path
1. Deploy new system
2. Educate users tentang global login
3. Gradually migrate devices ke device binding
4. Monitor usage analytics
5. Eventually deprecate legacy routes

## 🚨 Troubleshooting

### Device tidak ter-bind
**Problem**: Staff tidak bisa akses device login  
**Solution**: Admin harus login dulu dengan email untuk bind device

### PIN tidak valid
**Problem**: Staff input PIN tapi gagal login  
**Solution**: 
1. Check PIN sudah di-set di database
2. Pastikan PIN di-hash dengan bcrypt
3. Verify format PIN (4-6 digit)

### Auto-lock terlalu cepat
**Problem**: Staff complain auto-lock terlalu sering  
**Solution**: Adjust `IDLE_TIMEOUT` di `IdleContext.jsx` (default 5 menit)

### Admin override tidak work
**Problem**: Admin PIN tidak terverifikasi  
**Solution**:
1. Pastikan admin punya PIN di database
2. Check role = 'admin'
3. Verify PIN di-hash dengan benar

## 📊 Analytics & Monitoring

### Metrics to Track
- Global login success rate
- PIN login success rate
- Auto-lock frequency
- Admin override usage
- Device binding count per tenant

### Logging
Semua auth actions sudah di-log:
```javascript
console.log('[GLOBAL AUTH] Login successful', {
  email: email,
  tenant: tenant.slug,
  role: employee.role,
  duration: `${Date.now() - startTime}ms`
});
```

## 🎯 Best Practices

### For Admins
1. Set strong PIN (6 digit)
2. Jangan share PIN dengan staff
3. Regularly review admin override logs
4. Unbind device jika tablet hilang/dicuri

### For Staff
1. Jangan share PIN dengan orang lain
2. Logout jika meninggalkan tablet
3. Report jika lupa PIN ke admin
4. Jangan save PIN di notes/memo

### For Developers
1. Always hash PINs dengan bcrypt
2. Validate PIN format di frontend dan backend
3. Implement rate limiting untuk prevent brute force
4. Log all authentication attempts
5. Regular security audits

## 🔮 Future Enhancements

### Planned Features
1. **Biometric Authentication**: Fingerprint/Face ID untuk PIN
2. **PIN Recovery**: Self-service PIN reset dengan email
3. **Multi-Device Support**: Sync across multiple tablets
4. **Advanced Analytics**: Dashboard untuk auth metrics
5. **Role-Based Auto-Lock**: Different timeout per role
6. **Offline Mode**: Cache credentials untuk offline auth

### Security Improvements
1. **2FA for Admin**: Optional two-factor authentication
2. **PIN Expiry**: Force PIN change every 90 days
3. **Brute Force Protection**: Lock account after 5 failed attempts
4. **Audit Trail**: Complete log of all auth events
5. **Encryption**: Encrypt sensitive data in localStorage

## 📚 Related Documentation

- `MULTITENANT_IMPLEMENTATION.md` - Multitenant architecture
- `EMAIL_VERIFICATION_SUMMARY.md` - Email verification system
- `AI_RULES.md` - Development guidelines
- `backend/docs/EMAIL_VERIFICATION_GUIDE.md` - Backend auth details

---

**Status**: ✅ Fully Implemented  
**Version**: 2.0.0  
**Last Updated**: 2025-02-20  
**Author**: Kiro AI Assistant

**Selamat! Sistem autentikasi modern SuperKafe siap digunakan! 🎉**
