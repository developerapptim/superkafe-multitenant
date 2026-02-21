# 🔐 Google OAuth Implementation Guide
## SuperKafe Multi-Tenant System

---

## 📋 Overview

Implementasi Google OAuth dengan fitur **Auto-Register/Auto-Login** untuk sistem multi-tenant SuperKafe.

### ✨ Fitur Utama

1. **Auto-Register**: Jika email Google belum terdaftar, sistem otomatis membuat akun baru
2. **Auto-Login**: Jika email sudah terdaftar, langsung login tanpa password
3. **Data Default**: Nama dan Foto Profil diambil dari akun Google
4. **Multi-Tenant Support**: Setiap tenant memiliki database terpisah
5. **Secure Token**: JWT token dengan expiry 7 hari

---

## 🔑 Kredensial Google OAuth

```env
GOOGLE_CLIENT_ID=706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

### Authorized Redirect URIs

**Production:**
- `https://superkafe.com/api/auth/google/callback`

**Development:**
- `http://localhost:5001/api/auth/google/callback`
- `http://localhost:5174`

---

## 🏗️ Arsitektur

### Backend Files

```
backend/
├── controllers/
│   └── GoogleAuthController.js    # Logic auto-register/login
├── routes/
│   └── googleAuthRoutes.js        # Routes untuk Google auth
├── models/
│   ├── Employee.js                # User model dengan Google fields
│   └── Tenant.js                  # Tenant model
└── .env                           # Environment variables
```

### Database Schema

**Employee Model** (per tenant):
```javascript
{
  id: String,              // EMP-timestamp
  email: String,           // Email dari Google
  name: String,            // ✅ Nama dari Google
  image: String,           // ✅ Foto Profil dari Google
  googleId: String,        // Google User ID (sub)
  authProvider: String,    // 'google' atau 'local'
  role: String,            // 'admin', 'kasir', dll
  isVerified: Boolean,     // true untuk Google auth
  password: String         // null untuk Google auth
}
```

---

## 🔄 Alur Auth Logic

### 1. Token-Based Flow (Recommended)

```
Frontend                    Backend                     Google
   |                          |                           |
   |-- POST /api/auth/google -|                           |
   |    { idToken, tenant }   |                           |
   |                          |-- Verify Token ---------->|
   |                          |<-- User Data -------------|
   |                          |                           |
   |                          |-- Check Email in DB       |
   |                          |                           |
   |                          |   Email Found?            |
   |                          |   ├─ YES: Auto-Login      |
   |                          |   └─ NO: Auto-Register    |
   |                          |                           |
   |<-- JWT Token + User -----|                           |
   |                          |                           |
   |-- Redirect to Dashboard  |                           |
```

### 2. Redirect Flow (Alternative)

```
Frontend                    Backend                     Google
   |                          |                           |
   |-- Redirect to Google ----|-------------------------->|
   |                          |                           |
   |<-- Authorization Code ---|---------------------------|
   |                          |                           |
   |-- GET /callback?code=... |                           |
   |                          |-- Exchange Code --------->|
   |                          |<-- Access Token ----------|
   |                          |                           |
   |                          |-- Auto-Register/Login     |
   |                          |                           |
   |<-- Redirect with Token --|                           |
```

---

## 📡 API Endpoints

### 1. POST `/api/auth/google`

**Token-Based Authentication** (Recommended)

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
  "tenantSlug": "demo"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Login dengan Google berhasil",
  "isNewUser": false,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "EMP-1234567890",
    "username": "john.doe",
    "email": "john.doe@gmail.com",
    "name": "John Doe",
    "image": "https://lh3.googleusercontent.com/a/...",
    "role": "admin",
    "role_access": ["POS", "Kitchen", "Meja", "Keuangan", "Laporan", "Menu", "Pegawai", "Pengaturan"],
    "isVerified": true,
    "authProvider": "google"
  },
  "tenant": {
    "slug": "demo",
    "name": "Demo Cafe",
    "status": "trial"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Google token tidak valid"
}
```

### 2. GET `/api/auth/google/callback`

**OAuth Redirect Handler**

**Query Parameters:**
- `code`: Authorization code dari Google
- `state`: Base64 encoded tenant info

**Behavior:**
- Redirect ke: `https://superkafe.com/auth/callback?token=...&tenant=...&isNewUser=true`
- Error redirect: `https://superkafe.com/login?error=auth_failed`

---

## 🎯 Narasi Auto-Register/Login

### Scenario 1: Email Belum Terdaftar (Auto-Register)

```javascript
// User: john.doe@gmail.com (belum ada di database)

1. User klik "Login via Google"
2. Google mengirim data:
   {
     sub: "1234567890",
     email: "john.doe@gmail.com",
     name: "John Doe",
     picture: "https://lh3.googleusercontent.com/a/..."
   }

3. Backend cek database: Email tidak ditemukan
4. Backend AUTO-REGISTER:
   - Buat akun baru
   - Set nama: "John Doe" (dari Google)
   - Set foto: URL dari Google
   - Set role: "admin" (user pertama)
   - Set isVerified: true
   - Set password: null

5. Generate JWT token
6. Response: "Akun berhasil dibuat dengan Google. Selamat datang!"
7. Redirect ke Dashboard
```

### Scenario 2: Email Sudah Terdaftar (Auto-Login)

```javascript
// User: jane.smith@gmail.com (sudah ada di database)

1. User klik "Login via Google"
2. Google mengirim data:
   {
     sub: "0987654321",
     email: "jane.smith@gmail.com",
     name: "Jane Smith",
     picture: "https://lh3.googleusercontent.com/b/..."
   }

3. Backend cek database: Email ditemukan
4. Backend AUTO-LOGIN:
   - Update googleId jika belum ada
   - Update foto profil jika belum ada/default
   - Set authProvider: "google"
   - Set isVerified: true

5. Generate JWT token
6. Response: "Login dengan Google berhasil"
7. Redirect ke Dashboard
```

---

## 🔒 Security Features

### 1. Token Verification
- Setiap ID Token diverifikasi dengan Google API
- Audience check untuk mencegah token replay
- Expiry validation otomatis

### 2. JWT Security
```javascript
{
  id: user.id,
  email: user.email,
  role: user.role,
  tenant: tenantSlug,
  tenantDbName: tenant.dbName,
  exp: 7 days
}
```

### 3. HTTPS Enforcement
- Production menggunakan HTTPS
- Secure cookie flags untuk token
- CORS configuration yang ketat

### 4. Multi-Tenant Isolation
- Setiap tenant memiliki database terpisah
- JWT token mencakup tenant info
- Middleware `tenantResolver` untuk isolasi data

---

## 🧪 Testing Guide

### 1. Test Auto-Register (Email Baru)

**Menggunakan cURL:**
```bash
curl -X POST https://superkafe.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "YOUR_GOOGLE_ID_TOKEN",
    "tenantSlug": "demo"
  }'
```

**Expected Result:**
- Status: 200 OK
- `isNewUser: true`
- User baru dibuat di database
- Token JWT dikembalikan

### 2. Test Auto-Login (Email Existing)

**Menggunakan cURL:**
```bash
curl -X POST https://superkafe.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "YOUR_GOOGLE_ID_TOKEN",
    "tenantSlug": "demo"
  }'
```

**Expected Result:**
- Status: 200 OK
- `isNewUser: false`
- User existing di-update
- Token JWT dikembalikan

### 3. Test Redirect Flow

**Browser:**
1. Buka: `https://superkafe.com/login`
2. Klik tombol "Login via Google"
3. Pilih akun Google
4. Redirect ke: `https://superkafe.com/auth/callback?token=...`
5. Frontend simpan token dan redirect ke dashboard

---

## 🚀 Deployment Checklist

### Backend (.env)

```env
# ✅ Google OAuth
GOOGLE_CLIENT_ID=706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# ✅ URLs
FRONTEND_URL=https://superkafe.com
FRONTEND_URL_DEV=http://localhost:5174
BACKEND_URL=https://superkafe.com

# ✅ JWT
JWT_SECRET=your-secure-secret-key

# ✅ Database
MONGODB_URI=mongodb://...
```

### Google Cloud Console

1. ✅ Client ID & Secret sudah dikonfigurasi
2. ✅ Authorized JavaScript origins:
   - `https://superkafe.com`
   - `http://localhost:5174`
3. ✅ Authorized redirect URIs:
   - `https://superkafe.com/api/auth/google/callback`
   - `http://localhost:5001/api/auth/google/callback`

### Server Configuration

1. ✅ SSL Certificate aktif (HTTPS)
2. ✅ CORS configured untuk frontend domain
3. ✅ Cookie secure flag enabled
4. ✅ Rate limiting untuk auth endpoints

---

## 🐛 Troubleshooting

### Error: "Google token tidak valid"

**Penyebab:**
- ID Token expired
- Client ID tidak match
- Token dari aplikasi lain

**Solusi:**
```javascript
// Pastikan Client ID di frontend sama dengan backend
const client = new google.accounts.oauth2.initTokenClient({
  client_id: '706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com',
  scope: 'email profile',
  callback: handleCredentialResponse
});
```

### Error: "Tenant tidak ditemukan"

**Penyebab:**
- Tenant slug salah
- Tenant belum dibuat
- Tenant tidak aktif

**Solusi:**
```bash
# Cek tenant di database
mongo superkafe_v2
db.tenants.find({ slug: "demo" })

# Pastikan isActive: true
```

### Error: "Terjadi kesalahan saat login dengan Google"

**Penyebab:**
- Database connection error
- JWT secret tidak ada
- Server error

**Solusi:**
```bash
# Cek logs
docker logs superkafe-backend

# Cek environment variables
docker exec superkafe-backend env | grep GOOGLE
```

---

## 📚 Frontend Integration

### React Example (Token-Based)

```javascript
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

function LoginPage() {
  const tenantSlug = 'demo'; // Dari URL atau context

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const response = await fetch('https://superkafe.com/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: tokenResponse.credential,
            tenantSlug: tenantSlug
          })
        });

        const data = await response.json();
        
        if (data.success) {
          // Simpan token
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          
          // Redirect ke dashboard
          window.location.href = '/dashboard';
        }
      } catch (error) {
        console.error('Login failed:', error);
      }
    },
    onError: () => {
      console.error('Google login failed');
    }
  });

  return (
    <GoogleOAuthProvider clientId="706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com">
      <button onClick={handleGoogleLogin}>
        Login via Google
      </button>
    </GoogleOAuthProvider>
  );
}
```

---

## 📊 Monitoring & Logs

### Log Format

```javascript
// Auto-Register
[GOOGLE AUTH] 🆕 Auto-Register - Akun baru dibuat: {
  email: 'john.doe@gmail.com',
  name: 'John Doe',
  picture: 'https://...',
  tenant: 'demo'
}

// Auto-Login
[GOOGLE AUTH] ✅ Auto-Login - Email sudah terdaftar: {
  email: 'jane.smith@gmail.com',
  name: 'Jane Smith',
  tenant: 'demo'
}

// Error
[GOOGLE AUTH ERROR] Gagal login dengan Google: {
  error: 'Token verification failed',
  stack: '...'
}
```

### Metrics to Monitor

1. **Success Rate**: Login/Register berhasil vs gagal
2. **New Users**: Jumlah auto-register per hari
3. **Response Time**: Waktu verifikasi token Google
4. **Error Rate**: Frekuensi error per endpoint

---

## ✅ Implementation Complete

### What's Working

- ✅ Google OAuth token verification
- ✅ Auto-register untuk email baru
- ✅ Auto-login untuk email existing
- ✅ Nama & foto profil dari Google
- ✅ Multi-tenant support
- ✅ JWT token generation
- ✅ Secure HTTPS configuration
- ✅ Error handling & logging

### Next Steps (Optional)

1. **Frontend Integration**: Implementasi Google Sign-In button
2. **Email Notifications**: Kirim welcome email untuk user baru
3. **Analytics**: Track Google login usage
4. **Role Management**: UI untuk ubah role user Google
5. **Account Linking**: Link Google account ke existing local account

---

## 📞 Support

Jika ada pertanyaan atau issue:
1. Cek logs: `docker logs superkafe-backend`
2. Verify credentials di Google Cloud Console
3. Test dengan cURL untuk isolasi masalah
4. Periksa database untuk data user

---

**Last Updated**: 2024
**Version**: 1.0.0
**Status**: ✅ Production Ready
