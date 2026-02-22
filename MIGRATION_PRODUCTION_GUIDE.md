# Production Migration Guide

## Masalah Saat Ini

User lama mengalami error:
```
[TENANT PLUGIN] No tenant context available for query
Role authorization failed
```

Penyebab: User tidak memiliki `tenantId` dan `role` di database.

## Solusi: Jalankan Migrasi via API

### Step 1: Check Legacy Users

Cek berapa banyak user yang perlu di-migrate:

```bash
curl -X GET "https://superkafe.com/api/migration/check-legacy-users" \
  -H "x-api-key: superkafemultitenant_testkey_9f8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c"
```

**Expected Response:**
```json
{
  "success": true,
  "count": 5,
  "users": [
    {
      "id": "...",
      "name": "Sulasrat",
      "email": "sulasrat@gmail.com",
      "hasRole": false,
      "hasTenantId": false
    }
  ]
}
```

### Step 2: Run Migration

Jalankan migrasi untuk semua legacy users:

```bash
curl -X POST "https://superkafe.com/api/migration/legacy-users" \
  -H "x-api-key: superkafemultitenant_testkey_9f8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Legacy user migration completed",
  "migrated": 5,
  "errors": 0,
  "total": 5,
  "results": [
    {
      "userId": "...",
      "name": "Sulasrat",
      "email": "sulasrat@gmail.com",
      "tenantSlug": "sulasrat",
      "role": "admin",
      "status": "success"
    }
  ]
}
```

### Step 3: Logout dan Login Ulang

Setelah migrasi berhasil:

1. **Logout** dari aplikasi
2. **Clear browser cache** (optional tapi recommended)
3. **Login ulang** dengan credentials yang sama
4. JWT token baru akan include `tenantId` dan `tenantSlug`
5. Semua request akan otomatis include tenant headers

### Step 4: Verifikasi

Check browser DevTools > Network:
- Pilih any API request
- Check Request Headers
- Pastikan ada:
  ```
  x-tenant-slug: sulasrat
  x-tenant-id: 507f1f77bcf86cd799439011
  Authorization: Bearer eyJhbGc...
  ```

## Troubleshooting

### Error 401: Unauthorized

API key salah. Gunakan API key dari `.env`:
```
API_KEY=superkafemultitenant_testkey_9f8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c
```

### Error 404: Route not found

Backend belum di-deploy dengan perubahan terbaru. Deploy dulu:
```bash
git push origin main
```

### Masih error setelah migrasi

1. Clear localStorage di browser:
   ```javascript
   localStorage.clear()
   ```

2. Logout dan login ulang

3. Check backend logs untuk detail error

### Migration API tidak tersedia

Jika endpoint `/api/migration/*` tidak tersedia, berarti backend belum di-update. 

**Solusi alternatif**: Auto-fix akan berjalan saat login. Cukup:
1. Logout
2. Login ulang
3. AuthController akan otomatis create tenant dan assign role

## What Happens After Migration

1. **Tenant Created**: Setiap user mendapat tenant sendiri dengan slug dari nama mereka
2. **Role Assigned**: Semua user legacy mendapat role `admin`
3. **JWT Updated**: Token baru include `tenantId` dan `tenantSlug`
4. **Headers Auto-sent**: Frontend otomatis kirim `x-tenant-slug` di setiap request
5. **Plugin Works**: Tenant scoping plugin bisa filter data by tenant
6. **No More Errors**: Error "No tenant context" hilang

## Production Deployment Checklist

- [x] Migration API endpoint created
- [x] Frontend updated to send tenant headers
- [x] AuthController auto-fix implemented
- [x] TenantResolver supports both x-tenant-slug and x-tenant-id
- [ ] Deploy backend to production
- [ ] Run migration via API
- [ ] Test login with legacy user
- [ ] Verify tenant headers in requests
- [ ] Monitor backend logs

## Notes

- Migration aman dijalankan multiple kali (idempotent)
- Tidak akan overwrite data yang sudah ada
- Tenant slug generated dari nama user
- Default role: `admin`
- Default tenant status: `trial` (10 hari)
