# Legacy User Migration Guide

## Masalah

User lama yang dibuat sebelum sistem multitenant tidak memiliki:
- `tenantId` (menyebabkan error di ProtectedRoute)
- `role` (menyebabkan role authorization failed)

## Solusi

Ada 2 cara untuk menangani legacy users:

### 1. Auto-Fix saat Login (Otomatis) ✅

AuthController sudah diupdate untuk otomatis:
- Membuat tenant default berdasarkan nama user
- Assign role 'admin' jika kosong
- Update user data saat login pertama kali

**Tidak perlu action manual!** User lama akan otomatis ter-migrate saat login.

### 2. Batch Migration Script (Manual)

Jika ingin migrate semua user sekaligus tanpa menunggu mereka login:

```bash
cd backend
node scripts/migrateLegacyUsers.js
```

Script akan:
1. Mencari semua Employee tanpa tenantId atau role
2. Membuat tenant default untuk setiap user
3. Assign role 'admin'
4. Update database

## Output Example

```
🔄 Connecting to MongoDB...
✅ Connected to MongoDB

📊 Found 3 legacy users to migrate

👤 Processing: John Doe (john@example.com)
  ✅ Created tenant: John Doe (slug: john-doe)
  ✅ Updated user: tenantId=true, role=admin

👤 Processing: Jane Smith (jane@example.com)
  ✅ Created tenant: Jane Smith (slug: jane-smith)
  ✅ Updated user: tenantId=true, role=admin

============================================================
📊 Migration Summary:
  ✅ Successfully migrated: 3
  ❌ Errors: 0
  📝 Total processed: 3
============================================================
```

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

## Verifikasi

Setelah migrasi, cek di database:

```javascript
// Check user
db.employees.find({ tenantId: { $exists: true }, role: "admin" })

// Check tenants
db.tenants.find({ status: "trial" })
```

## Troubleshooting

### Error: "Slug already exists"
Script otomatis menambah counter. Tidak perlu action manual.

### Error: "Cannot create tenant"
Pastikan MongoDB connection string benar di `.env`:
```
MONGODB_URI=mongodb://localhost:27017/warkop
```

### User masih tidak bisa login
1. Cek apakah user memiliki `status: 'active'`
2. Cek apakah tenantId sudah terisi
3. Cek apakah role sudah terisi
4. Lihat log backend untuk detail error

## Notes

- Script aman dijalankan multiple kali (idempotent)
- Tidak akan membuat duplikat tenant
- Tidak akan overwrite data yang sudah ada
- Auto-fix di AuthController berjalan otomatis tanpa perlu script
