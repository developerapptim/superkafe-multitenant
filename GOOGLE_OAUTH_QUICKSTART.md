# 🚀 Google OAuth Quick Start Guide
## SuperKafe - Testing & Implementation

---

## ⚡ Quick Setup (5 Menit)

### 1. Backend Configuration

**File: `backend/.env`**
```env
# ✅ Sudah dikonfigurasi
GOOGLE_CLIENT_ID=706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
FRONTEND_URL=https://superkafe.com
FRONTEND_URL_DEV=http://localhost:5174
```

### 2. Frontend Configuration

**File: `frontend/.env`**
```env
# ✅ Sudah dikonfigurasi
VITE_API_URL=https://superkafe.com/api
VITE_GOOGLE_CLIENT_ID=706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com
```

### 3. Restart Services

```bash
# Backend
cd backend
npm start

# Frontend
cd frontend
npm run dev
```

---

## 🧪 Testing Scenarios

### Test 1: Auto-Register (Email Baru)

**Menggunakan Postman/cURL:**

```bash
curl -X POST https://superkafe.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "PASTE_YOUR_GOOGLE_ID_TOKEN_HERE",
    "tenantSlug": "demo"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Akun berhasil dibuat dengan Google. Selamat datang!",
  "isNewUser": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "EMP-1234567890",
    "email": "newuser@gmail.com",
    "name": "New User",
    "image": "https://lh3.googleusercontent.com/a/...",
    "role": "admin",
    "isVerified": true,
    "authProvider": "google"
  }
}
```

**Verification:**
```bash
# Cek database
mongo superkafe_demo
db.employees.findOne({ email: "newuser@gmail.com" })

# Expected fields:
# - googleId: "1234567890"
# - name: "New User" (dari Google)
# - image: "https://..." (dari Google)
# - authProvider: "google"
# - isVerified: true
# - password: null
```

### Test 2: Auto-Login (Email Existing)

**Menggunakan Postman/cURL:**

```bash
curl -X POST https://superkafe.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "PASTE_YOUR_GOOGLE_ID_TOKEN_HERE",
    "tenantSlug": "demo"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login dengan Google berhasil",
  "isNewUser": false,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "EMP-1234567890",
    "email": "existinguser@gmail.com",
    "name": "Existing User",
    "image": "https://lh3.googleusercontent.com/b/...",
    "role": "admin",
    "isVerified": true,
    "authProvider": "google"
  }
}
```

### Test 3: Redirect Flow

**Browser Testing:**

1. Buka browser: `https://superkafe.com/login`
2. Klik tombol "Login via Google"
3. Pilih akun Google
4. Observe redirect ke: `https://superkafe.com/auth/callback?token=...&tenant=demo&isNewUser=false`
5. Frontend harus:
   - Simpan token ke localStorage
   - Redirect ke dashboard
   - Display user info dengan foto profil

---

## 🎯 Cara Mendapatkan Google ID Token

### Method 1: Google OAuth Playground

1. Buka: https://developers.google.com/oauthplayground/
2. Pilih "Google OAuth2 API v2"
3. Select scopes:
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
4. Click "Authorize APIs"
5. Login dengan akun Google
6. Click "Exchange authorization code for tokens"
7. Copy `id_token` dari response

### Method 2: Frontend Console

```javascript
// Di browser console (setelah Google Sign-In)
google.accounts.id.initialize({
  client_id: '706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com',
  callback: (response) => {
    console.log('ID Token:', response.credential);
    // Copy token ini untuk testing
  }
});
```

---

## 📋 Checklist Testing

### Backend Testing

- [ ] Server berjalan di port 5001
- [ ] Environment variables loaded
- [ ] MongoDB connection active
- [ ] Route `/api/auth/google` accessible
- [ ] Route `/api/auth/google/callback` accessible

**Test Command:**
```bash
# Health check
curl https://superkafe.com/api/test

# Google auth endpoint
curl -X POST https://superkafe.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"test","tenantSlug":"demo"}'
# Expected: 401 (token tidak valid) - ini normal
```

### Frontend Testing

- [ ] Frontend berjalan di port 5174 (dev) atau 80 (prod)
- [ ] Environment variables loaded
- [ ] Google Client ID configured
- [ ] Login page accessible
- [ ] Google Sign-In button rendered

**Test Command:**
```bash
# Check env
cd frontend
cat .env

# Start dev server
npm run dev
```

### Integration Testing

- [ ] Click "Login via Google" button
- [ ] Google popup muncul
- [ ] Pilih akun Google
- [ ] Redirect ke callback URL
- [ ] Token disimpan di localStorage
- [ ] User info ditampilkan
- [ ] Foto profil dari Google muncul
- [ ] Redirect ke dashboard berhasil

### Database Verification

```bash
# Connect to MongoDB
mongo superkafe_demo

# Check new user
db.employees.findOne({ authProvider: "google" })

# Expected fields:
# {
#   id: "EMP-...",
#   email: "user@gmail.com",
#   name: "User Name",           // ✅ Dari Google
#   image: "https://...",         // ✅ Dari Google
#   googleId: "1234567890",       // ✅ Google User ID
#   authProvider: "google",       // ✅ Provider
#   isVerified: true,             // ✅ Auto verified
#   password: null,               // ✅ No password
#   role: "admin",
#   status: "active"
# }
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Google token tidak valid"

**Symptoms:**
```json
{
  "success": false,
  "message": "Google token tidak valid"
}
```

**Solutions:**
1. Token expired (valid 1 jam) - generate token baru
2. Client ID tidak match - cek `.env`
3. Token dari aplikasi lain - pastikan menggunakan Client ID yang benar

**Fix:**
```bash
# Verify Client ID
cd backend
cat .env | grep GOOGLE_CLIENT_ID

# Should be:
# GOOGLE_CLIENT_ID=706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com
```

### Issue 2: "Tenant tidak ditemukan"

**Symptoms:**
```json
{
  "success": false,
  "message": "Tenant tidak ditemukan"
}
```

**Solutions:**
```bash
# Create tenant
mongo superkafe_v2
db.tenants.insertOne({
  name: "Demo Cafe",
  slug: "demo",
  dbName: "superkafe_demo",
  isActive: true,
  status: "trial",
  trialExpiresAt: new Date(Date.now() + 10*24*60*60*1000)
})
```

### Issue 3: CORS Error

**Symptoms:**
```
Access to fetch at 'https://superkafe.com/api/auth/google' from origin 'http://localhost:5174' 
has been blocked by CORS policy
```

**Solutions:**
```javascript
// backend/server.js
app.use(cors({
  origin: [
    'https://superkafe.com',
    'http://localhost:5174',
    'http://localhost:5002'
  ],
  credentials: true
}));
```

### Issue 4: Foto Profil Tidak Muncul

**Symptoms:**
- User berhasil login
- Nama muncul
- Foto profil tidak muncul (broken image)

**Solutions:**
```javascript
// Check user data
db.employees.findOne({ email: "user@gmail.com" }, { image: 1 })

// Expected:
// { image: "https://lh3.googleusercontent.com/a/..." }

// If empty or null, update manually:
db.employees.updateOne(
  { email: "user@gmail.com" },
  { $set: { image: "https://lh3.googleusercontent.com/a/..." } }
)
```

---

## 📊 Monitoring Logs

### Backend Logs

```bash
# Real-time logs
docker logs -f superkafe-backend

# Filter Google auth logs
docker logs superkafe-backend 2>&1 | grep "GOOGLE AUTH"
```

**Expected Logs:**

**Auto-Register:**
```
[GOOGLE AUTH] Token verified for: { email: 'new@gmail.com', name: 'New User', picture: 'https://...' }
[GOOGLE AUTH] 🆕 Auto-Register - Akun baru dibuat: { email: 'new@gmail.com', name: 'New User', picture: 'https://...', tenant: 'demo' }
```

**Auto-Login:**
```
[GOOGLE AUTH] Token verified for: { email: 'existing@gmail.com', name: 'Existing User', picture: 'https://...' }
[GOOGLE AUTH] ✅ Auto-Login - Email sudah terdaftar: { email: 'existing@gmail.com', name: 'Existing User', tenant: 'demo' }
```

**Error:**
```
[GOOGLE AUTH] Token verification failed: invalid_token
[GOOGLE AUTH ERROR] Gagal login dengan Google: { error: 'Token verification failed', stack: '...' }
```

---

## 🎨 Frontend Implementation Example

### React Component

```jsx
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import axios from 'axios';

function LoginPage() {
  const [loading, setLoading] = useState(false);
  const tenantSlug = 'demo'; // Dari URL atau context

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/auth/google`,
        {
          idToken: credentialResponse.credential,
          tenantSlug: tenantSlug
        }
      );

      if (response.data.success) {
        // Simpan token
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // Show welcome message
        if (response.data.isNewUser) {
          alert('Selamat datang! Akun Anda berhasil dibuat.');
        } else {
          alert('Login berhasil!');
        }
        
        // Redirect ke dashboard
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    alert('Login dengan Google gagal. Silakan coba lagi.');
  };

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <div className="login-container">
        <h1>Login ke SuperKafe</h1>
        
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          useOneTap
          text="signin_with"
          shape="rectangular"
          theme="filled_blue"
          size="large"
          logo_alignment="left"
        />
        
        {loading && <p>Memproses login...</p>}
      </div>
    </GoogleOAuthProvider>
  );
}

export default LoginPage;
```

### Install Dependencies

```bash
cd frontend
npm install @react-oauth/google
```

---

## ✅ Production Deployment

### Pre-Deployment Checklist

- [ ] `.env` files configured (backend & frontend)
- [ ] Google Cloud Console credentials verified
- [ ] Redirect URIs updated di Google Console
- [ ] SSL certificate active (HTTPS)
- [ ] CORS configured untuk production domain
- [ ] Database backup created
- [ ] Monitoring & logging setup

### Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Update environment variables
cd backend
nano .env
# Verify GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET

cd ../frontend
nano .env
# Verify VITE_GOOGLE_CLIENT_ID

# 3. Rebuild & restart
docker-compose down
docker-compose build
docker-compose up -d

# 4. Verify services
docker ps
docker logs superkafe-backend
docker logs superkafe-frontend

# 5. Test endpoints
curl https://superkafe.com/api/test
curl -X POST https://superkafe.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"test","tenantSlug":"demo"}'
```

### Post-Deployment Testing

1. **Browser Test:**
   - Buka: https://superkafe.com/login
   - Klik "Login via Google"
   - Verify redirect & login berhasil

2. **Database Check:**
   ```bash
   mongo superkafe_demo
   db.employees.find({ authProvider: "google" }).pretty()
   ```

3. **Logs Monitoring:**
   ```bash
   docker logs -f superkafe-backend | grep "GOOGLE AUTH"
   ```

---

## 📞 Support & Troubleshooting

### Debug Mode

```javascript
// backend/controllers/GoogleAuthController.js
// Uncomment untuk debug detail

console.log('[DEBUG] Request body:', req.body);
console.log('[DEBUG] Google user data:', googleUser);
console.log('[DEBUG] Tenant data:', tenant);
console.log('[DEBUG] User data:', user);
```

### Health Check Endpoints

```bash
# Backend health
curl https://superkafe.com/api/test

# Database connection
curl https://superkafe.com/api/tenants

# Google auth endpoint
curl -X POST https://superkafe.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"invalid","tenantSlug":"demo"}'
# Expected: 401 Unauthorized
```

---

## 🎉 Success Criteria

### ✅ Implementation Complete When:

1. User baru bisa register via Google (auto-create account)
2. User existing bisa login via Google (auto-login)
3. Nama & foto profil diambil dari Google
4. JWT token generated dengan benar
5. Redirect ke dashboard berhasil
6. Multi-tenant isolation berfungsi
7. HTTPS & security configured
8. Logs & monitoring active

---

**Status**: ✅ Ready for Testing
**Last Updated**: 2024
**Version**: 1.0.0
