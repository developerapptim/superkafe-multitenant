# Frontend JWT Debugging Guide

## ✅ Perubahan yang Sudah Dilakukan

### 1. ProtectedRoute.jsx
- Membaca `role` langsung dari JWT token (source of truth)
- Membaca `tenantSlug` dari JWT token
- Validasi tenant context sebelum render
- Logging lengkap untuk debugging

### 2. api.js
- Auto-extract `tenantSlug` dan `tenantId` dari JWT
- Kirim sebagai header `x-tenant-slug` dan `x-tenant-id`
- Support legacy format
- Logging untuk debugging

## 🔍 Cara Debug di Browser Console

### Check JWT Token:
```javascript
const token = localStorage.getItem('token');
const parts = token.split('.');
const payload = JSON.parse(atob(parts[1]));
console.log('JWT Payload:', payload);
console.log('Role:', payload.role);
console.log('Tenant Slug:', payload.tenantSlug);
```

### Check Request Headers:
1. Buka DevTools > Network
2. Pilih any API request
3. Check Request Headers
4. Pastikan ada:
   - `x-tenant-slug: your-slug`
   - `x-tenant-id: your-id`
   - `Authorization: Bearer ...`

## 🐛 Troubleshooting

### Error: "userRole: undefined"
**Penyebab**: JWT token tidak memiliki field `role`

**Solusi**:
1. Logout dan login ulang
2. Backend akan auto-assign role `admin`
3. JWT baru akan include role

### Error: "No tenant context"
**Penyebab**: JWT token tidak memiliki `tenantSlug` atau `tenantId`

**Solusi**:
1. Logout dan login ulang
2. Backend akan auto-create tenant
3. JWT baru akan include tenant info

### Console Logs to Watch:
```
[ProtectedRoute] User info from JWT: { userId, userRole, userTenantSlug }
[API] Added x-tenant-slug: your-slug
[API] Added x-tenant-id: your-id
```

## ✅ Expected Behavior After Fix

1. Login berhasil
2. JWT token include: `role`, `tenantSlug`, `tenantId`
3. ProtectedRoute membaca role dari JWT
4. Setiap API request include tenant headers
5. Backend bisa resolve tenant context
6. No more "No tenant context" errors
