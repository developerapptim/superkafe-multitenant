# 🚀 Unified Onboarding Flow - Implementation Guide

## 📋 Overview

Perubahan besar pada alur pendaftaran untuk membuat onboarding **secepat kilat**.

### Old Flow (Slow)
```
Register → Isi 6 field → Buat tenant → Buat database → Login
```

### New Flow (Lightning Fast ⚡)
```
Register → Email & Password saja → Login → Setup Wizard → Buat tenant
```

---

## 🎯 Goals

1. **Speed**: Registrasi hanya butuh email & password
2. **Simplicity**: Minimal friction di awal
3. **Atomic**: Tenant creation hanya terjadi setelah setup selesai
4. **Recovery**: User bisa kembali ke setup wizard jika belum selesai

---

## 🏗️ Architecture

### Database Structure

**Main Database (`superkafe_v2`)**:
- `users` collection - User yang belum/sudah punya tenant
- `tenants` collection - Tenant metadata

**Tenant Database (`superkafe_[slug]`)**:
- `employees` collection - User yang sudah jadi admin tenant
- `settings`, `orders`, dll - Data tenant

### User Lifecycle

```
1. Register/Login
   ↓
   User created in main DB
   hasCompletedSetup: false
   
2. Setup Wizard
   ↓
   Tenant created
   Employee created in tenant DB
   User updated: hasCompletedSetup: true
   
3. Dashboard
   ↓
   User can access tenant features
```

---

## 📁 New Files Created

### Backend

1. **`backend/models/User.js`**
   - User model (pre-tenant)
   - Fields: email, password, name, googleId, hasCompletedSetup, tenantSlug

2. **`backend/controllers/UnifiedAuthController.js`**
   - `register()` - Register tanpa tenant
   - `login()` - Login tanpa tenant slug
   - `googleAuth()` - Google OAuth tanpa tenant
   - `verifyOTP()` - Email verification

3. **`backend/controllers/SetupController.js`**
   - `setupTenant()` - Atomic tenant creation
   - `checkSlug()` - Check slug availability

4. **`backend/routes/unifiedAuthRoutes.js`**
   - POST `/api/auth/register`
   - POST `/api/auth/login`
   - POST `/api/auth/google`
   - POST `/api/auth/verify-otp`

5. **`backend/routes/setupRoutes.js`**
   - POST `/api/setup/tenant` (requires JWT)
   - GET `/api/setup/check-slug/:slug`

### Frontend (To Be Created)

1. **`frontend/src/pages/auth/SimpleRegister.jsx`**
   - Minimal form: email, password, name
   - Google button

2. **`frontend/src/pages/auth/SimpleLogin.jsx`**
   - Minimal form: email, password
   - Google button

3. **`frontend/src/pages/setup/SetupWizard.jsx`**
   - Form: cafeName, slug, adminName
   - Slug availability check
   - Submit → Create tenant

---

## 🔄 Flow Details

### 1. Registration Flow

**Endpoint**: `POST /api/auth/register`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Registrasi berhasil! Silakan cek email Anda untuk kode verifikasi.",
  "data": {
    "email": "user@example.com",
    "name": "John Doe",
    "requiresVerification": true,
    "hasCompletedSetup": false
  }
}
```

**What Happens**:
1. Create user in `users` collection
2. Hash password
3. Generate OTP
4. Send OTP email
5. Return success (no tenant created yet)

### 2. OTP Verification Flow

**Endpoint**: `POST /api/auth/verify-otp`

**Request**:
```json
{
  "email": "user@example.com",
  "otpCode": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Email berhasil diverifikasi!",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "hasCompletedSetup": false,
    "tenantSlug": null
  }
}
```

**What Happens**:
1. Verify OTP code
2. Mark user as verified
3. Generate JWT token
4. Return token + user data

### 3. Login Flow

**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Login berhasil",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "hasCompletedSetup": false,
    "tenantSlug": null
  }
}
```

**Frontend Logic**:
```javascript
if (!user.hasCompletedSetup) {
  // Redirect to /setup-cafe
  navigate('/setup-cafe');
} else {
  // Redirect to dashboard
  navigate('/admin/dashboard');
}
```

### 4. Google OAuth Flow

**Endpoint**: `POST /api/auth/google`

**Request**:
```json
{
  "idToken": "google_id_token",
  "email": "user@gmail.com",
  "name": "John Doe",
  "picture": "https://..."
}
```

**Response**:
```json
{
  "success": true,
  "message": "Akun berhasil dibuat dengan Google!",
  "isNewUser": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "email": "user@gmail.com",
    "name": "John Doe",
    "image": "https://...",
    "authProvider": "google",
    "hasCompletedSetup": false,
    "tenantSlug": null
  }
}
```

**Frontend Logic**: Same as login - redirect based on `hasCompletedSetup`

### 5. Setup Wizard Flow

**Endpoint**: `POST /api/setup/tenant`

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Request**:
```json
{
  "cafeName": "Warkop Pusat",
  "slug": "warkop-pusat",
  "adminName": "John Doe"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Setup tenant berhasil! Selamat datang di SuperKafe!",
  "token": "new_jwt_token_with_tenant_info",
  "user": {
    "id": "EMP-123",
    "username": "user",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "role_access": ["POS", "Kitchen", ...]
  },
  "tenant": {
    "id": "tenant_id",
    "name": "Warkop Pusat",
    "slug": "warkop-pusat",
    "status": "trial",
    "trialExpiresAt": "2024-03-01T00:00:00.000Z",
    "trialDaysRemaining": 10
  }
}
```

**What Happens (Atomic)**:
1. Validate slug availability
2. Create tenant in `tenants` collection
3. Create tenant database
4. Seed settings
5. Create admin employee in tenant DB
6. Update user: `hasCompletedSetup = true`
7. Generate new JWT with tenant info
8. Return success

**If Error**: Rollback tenant creation

### 6. Slug Check Flow

**Endpoint**: `GET /api/setup/check-slug/:slug`

**Response**:
```json
{
  "success": true,
  "available": true,
  "message": "Slug tersedia"
}
```

---

## 🎨 Frontend Implementation

### Simple Register Page

```jsx
// frontend/src/pages/auth/SimpleRegister.jsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

const SimpleRegister = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/register', formData);
      
      if (response.data.success) {
        toast.success('Registrasi berhasil! Cek email Anda.');
        
        // Redirect to OTP verification
        navigate('/auth/verify-otp', {
          state: { email: formData.email }
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    // Google OAuth logic (same as before)
    // After success, check hasCompletedSetup
    // If false, redirect to /setup-cafe
  };

  return (
    <div>
      <h1>Daftar Akun</h1>
      
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nama Lengkap"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
        
        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          required
        />
        
        <input
          type="password"
          placeholder="Password (min 6 karakter)"
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          required
          minLength={6}
        />
        
        <button type="submit" disabled={loading}>
          {loading ? 'Memproses...' : 'Daftar'}
        </button>
      </form>

      <div className="divider">atau</div>

      <button onClick={handleGoogleSignUp}>
        <GoogleIcon /> Daftar dengan Google
      </button>
    </div>
  );
};
```

### Setup Wizard Page

```jsx
// frontend/src/pages/setup/SetupWizard.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';

const SetupWizard = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    cafeName: '',
    slug: '',
    adminName: ''
  });
  const [slugAvailable, setSlugAvailable] = useState(null);
  const [loading, setLoading] = useState(false);

  // Auto-generate slug from cafeName
  useEffect(() => {
    if (formData.cafeName) {
      const autoSlug = formData.cafeName
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      
      setFormData(prev => ({ ...prev, slug: autoSlug }));
    }
  }, [formData.cafeName]);

  // Check slug availability
  const checkSlug = async () => {
    if (!formData.slug) return;

    try {
      const response = await api.get(`/setup/check-slug/${formData.slug}`);
      setSlugAvailable(response.data.available);
    } catch (error) {
      console.error('Failed to check slug:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/setup/tenant', formData);
      
      if (response.data.success) {
        // Save new token (with tenant info)
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('tenant_slug', response.data.tenant.slug);
        
        toast.success('Setup berhasil! Selamat datang!');
        
        // Redirect to dashboard
        navigate('/admin/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Setup gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Setup Kafe Anda</h1>
      <p>Langkah terakhir sebelum memulai!</p>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nama Kafe (contoh: Warkop Pusat)"
          value={formData.cafeName}
          onChange={(e) => setFormData({...formData, cafeName: e.target.value})}
          required
        />

        <input
          type="text"
          placeholder="Alamat Link (contoh: warkop-pusat)"
          value={formData.slug}
          onChange={(e) => setFormData({...formData, slug: e.target.value})}
          onBlur={checkSlug}
          required
        />
        
        {slugAvailable === false && (
          <p className="error">Slug sudah digunakan</p>
        )}
        {slugAvailable === true && (
          <p className="success">Slug tersedia!</p>
        )}

        <input
          type="text"
          placeholder="Nama Admin (opsional)"
          value={formData.adminName}
          onChange={(e) => setFormData({...formData, adminName: e.target.value})}
        />

        <button type="submit" disabled={loading || slugAvailable === false}>
          {loading ? 'Memproses...' : 'Selesaikan Setup'}
        </button>
      </form>
    </div>
  );
};
```

---

## 🔒 Security & Validation

### JWT Token Structure

**After Registration/Login (No Tenant)**:
```json
{
  "userId": "user_id",
  "email": "user@example.com",
  "hasCompletedSetup": false,
  "tenantSlug": null,
  "exp": 1234567890
}
```

**After Setup (With Tenant)**:
```json
{
  "id": "EMP-123",
  "email": "user@example.com",
  "role": "admin",
  "tenant": "warkop-pusat",
  "tenantDbName": "superkafe_warkop_pusat",
  "userId": "user_id",
  "exp": 1234567890
}
```

### Middleware Protection

```javascript
// Routes that require completed setup
app.use('/api/orders', checkJwt, requireCompletedSetup, orderRoutes);
app.use('/api/menu', checkJwt, requireCompletedSetup, menuRoutes);

// Routes that don't require setup
app.use('/api/setup', checkJwt, setupRoutes); // Only needs auth
```

---

## 🧪 Testing Checklist

### 1. Manual Registration
- [ ] Register with email & password
- [ ] Receive OTP email
- [ ] Verify OTP
- [ ] Redirect to setup wizard
- [ ] Complete setup
- [ ] Redirect to dashboard

### 2. Google Registration
- [ ] Click "Daftar dengan Google"
- [ ] Select Google account
- [ ] Redirect to setup wizard
- [ ] Complete setup
- [ ] Redirect to dashboard

### 3. Incomplete Setup Recovery
- [ ] Register/Login
- [ ] Close browser before setup
- [ ] Login again
- [ ] Should redirect to setup wizard
- [ ] Complete setup
- [ ] Should work normally

### 4. Slug Validation
- [ ] Try duplicate slug → Error
- [ ] Try invalid characters → Error
- [ ] Try valid slug → Success

### 5. Atomic Operation
- [ ] Setup fails midway
- [ ] Tenant should be rolled back
- [ ] User can retry setup

---

## 📊 Migration Plan

### For Existing Users

**Option 1: Keep Old Flow**
- Keep old `/api/tenants/register` endpoint
- Add new `/api/auth/register` endpoint
- Both work in parallel

**Option 2: Migrate Existing**
- Create script to migrate existing tenants
- Create User records for existing employees
- Mark as `hasCompletedSetup: true`

---

## ✅ Benefits

1. **Faster Onboarding**: 3 fields vs 6 fields
2. **Better UX**: Progressive disclosure
3. **Atomic Operations**: No partial tenant creation
4. **Recovery**: User can complete setup later
5. **Cleaner Code**: Separation of concerns

---

**Status**: ✅ Backend Implementation Complete
**Next**: Frontend Implementation
**Ready for**: Testing & Deployment
