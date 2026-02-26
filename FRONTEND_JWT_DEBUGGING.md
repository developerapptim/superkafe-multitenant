# Frontend JWT & Tenant Context Debugging Guide

## Perubahan yang Sudah Dilakukan

### 1. ProtectedRoute.jsx
- ✅ Sekarang membaca `role` langsung dari JWT token (bukan dari localStorage)
- ✅ Membaca `tenantSlug` dari JWT token
- ✅ Validasi tenant context sebelum render
- ✅ Logging lengkap untuk debugging

### 2. api.js (Axios Interceptor)
- ✅ Otomatis extract `tenantSlug` dan `tenantId` dari JWT
- ✅ Kirim sebagai header `x-tenant-slug` dan `x-tenant-id`
- ✅ Support legacy format (`tenant` field)
- ✅ Logging untuk debugging

## Cara Debugging di Browser

### Step 1: Check JWT Token

Buka browser console dan jalankan:

```javascript
// Get token from localStorage
const token = localStorage.getItem('token');
console.log('Token:', token);

// Decode token
function decodeJWT(token) {
    const parts = token.split('.');
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
}

const decoded = decodeJWT(token);
console.log('Decoded Token:', decoded);

// Check specific fields
console.log('Role:', decoded.role);
console.log('Tenant Slug:', decoded.tenantSlug);
console.log('Tenant ID:', decoded.tenantId);
```

**Expected Output:**
```javascript
{
  id: "5