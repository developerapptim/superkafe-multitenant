# Legacy User Migration Guide

## Masalah

User lama yang dibuat sebelum sistem multitenant tidak memiliki:
- `tenantId` (menyebabkan error di ProtectedRoute)
- `role` (menyebabkan role authorization failed)

Error yang muncul:
```
[TENANT PLUGIN] No tenant context available for query
Role authorization failed
```

## Solusi

Ada 3 cara untuk menangani legacy users:

### 1. Auto-Fix saat Login (Otomatis) ✅ RECOMMENDED

AuthController sudah diupdate untuk otomatis:
- Membuat tenant default berdasarkan nama user
- Assign role 'admin' jika kosong
- Update user data saat login pertama kali

**Tidak perlu action manual!** User lama akan otomatis ter-migrate saat login.

### 2. Migration via API Endpoint (Production-Ready) ✅

Untuk production environment atau jika MongoDB tidak accessible langsung:

#### Check Legacy Users
```bash
curl -X GET "https://superkafe.com/api/migration/check-legacy-users" \
  -H "x-api-key: warkop_secret_123"
```

Response:
```json
{
  "success": true,
  "count": 3,
  "users": [
    {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "hasRole": false,
      "hasTenantId": false
    }
  ]
}
```

#### Run Migration
```bash
curl -X POST "https://superkafe.com/api/migration/legacy-users" \
  -H "x-api-key: warkop_secret_123" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "message": "Legacy user migration completed",
  "migrated": 3,
  "errors": 0,
  "total": 3,
  "results": [
    {
      "userId": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "tenantSlug": "john-doe",
      "role": "admin",
      "status": "success"
    }
  ]
}
```

### 3. Batch Migration Script (Local Development)

Jika ingin migrate semua user sekaligus di local environment:

```bash
cd backend
node scripts/migrateLegacyUsers.js
```

Script akan:
1. Mencari semua Employee tanpa tenantId atau role
2. Membuat tenant default untuk setiap user
3. Assign role 'admin'
4. Update database

## Frontend Configuration

Frontend sudah dikonfigurasi untuk mengirim tenant context di setiap request:

**File: `frontend/src/services/api.js`**

```javascript
// Request interceptor otomatis menambahkan headers:
// - x-tenant-slug: dari JWT token
// - x-tenant-id: dari JWT token (fallback)
// - Authorization: Bearer token
```

Headers yang dikirim:
```
x-api-key: warkop_secret_123
x-tenant-slug: john-doe
x-tenant-id: 507f1f77bcf86cd799439011
Authorization: Bearer eyJhbGc...
```

## Verifikasi Setelah Migrasi

### 1. Check User di Database
```javascript
db.employees.find({ 
  tenantId: { $exists: true }, 
  role: "admin" 
})
```

### 2. Check Tenants
```javascript
db.tenants.find({ status: "trial" })
```

### 3. Test Login
1. Login dengan user lama
2. Check browser console untuk JWT payload
3. Pastikan ada `tenantId` dan `tenantSlug`

### 4. Check Network Headers
Di browser DevTools > Network:
- Pilih request API
- Check Request Headers
- Pastikan ada `x-tenant-slug` dan `x-tenant-id`

## Tenant Slug Generation

Slug dibuat dari nama user dengan aturan:
- Lowercase
- Spasi diganti dengan hyphen (-)
- Special characters dihapus
- Jika duplikat, ditambah counter (-1, -2, dst)

Contoh:
- "John Doe" → `john-doe`
- "Café Owner" → `cafe-owner`
- "Admin" (duplikat) → `admin-1`, `admin-2`

## Default Values

- **Role**: `admin` (full access)
- **Tenant Status**: `trial` (10 hari trial period)
- **Tenant Name**: Nama user atau username

## Troubleshooting

### Error: "No tenant context available"

**Penyebab**: User belum memiliki tenantId

**Solusi**:
1. Jalankan migration via API endpoint
2. Atau logout dan login ulang (auto-fix)

### Error: "Role authorization failed"

**Penyebab**: User tidak memiliki role

**Solusi**:
1. Jalankan migration via API endpoint
2. Atau logout dan login ulang (auto-fix)

### Error: "Slug already exists"

Script otomatis menambah counter. Tidak perlu action manual.

### Migration API returns 401

Pastikan menggunakan API key yang benar:
```bash
x-api-key: warkop_secret_123
```

### User masih tidak bisa login setelah migrasi

1. Clear browser localStorage
2. Logout dan login ulang
3. Check browser console untuk error
4. Verify JWT token contains tenantId and tenantSlug

## Production Deployment Checklist

- [ ] Run migration check endpoint
- [ ] Review legacy users list
- [ ] Run migration endpoint
- [ ] Verify all users migrated successfully
- [ ] Test login with migrated users
- [ ] Monitor backend logs for tenant context errors
- [ ] Clear user sessions (optional: force re-login)

## Notes

- Migration API aman dijalankan multiple kali (idempotent)
- Tidak akan membuat duplikat tenant
- Tidak akan overwrite data yang sudah ada
- Auto-fix di AuthController berjalan otomatis tanpa perlu script
- Frontend otomatis mengirim tenant headers setelah login
