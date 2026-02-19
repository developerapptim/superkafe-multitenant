# Tenant Seeding Guide

## 📋 Overview

Script `seedTenant.js` digunakan untuk membuat tenant baru secara manual dan otomatis membuat user admin default untuk tenant tersebut.

## 🚀 Usage

### Basic Usage
```bash
node backend/scripts/seedTenant.js <slug> [name]
```

### Examples

**1. Dengan nama otomatis (dari slug):**
```bash
node backend/scripts/seedTenant.js zona-mapan
# Akan membuat tenant dengan:
# - slug: zona-mapan
# - name: Zona Mapan (auto-generated)
# - dbName: superkafe_zona_mapan
```

**2. Dengan nama custom:**
```bash
node backend/scripts/seedTenant.js zona-mapan "Zona Mapan Coffee Shop"
# Akan membuat tenant dengan:
# - slug: zona-mapan
# - name: Zona Mapan Coffee Shop
# - dbName: superkafe_zona_mapan
```

**3. Multiple tenants:**
```bash
node backend/scripts/seedTenant.js warkop-pusat "Warkop Pusat"
node backend/scripts/seedTenant.js warkop-jakarta "Warkop Jakarta"
node backend/scripts/seedTenant.js warkop-bandung "Warkop Bandung"
```

## 📦 What Gets Created

### 1. Tenant Entry (Database Utama)
```javascript
{
  name: "Zona Mapan Coffee Shop",
  slug: "zona-mapan",
  dbName: "superkafe_zona_mapan",
  isActive: true,
  createdAt: "2025-01-XX...",
  updatedAt: "2025-01-XX..."
}
```

### 2. Tenant Database
Database baru dengan nama `superkafe_[slug_underscore]` akan dibuat dengan collections:
- `settings` - Konfigurasi tenant
- `employees` - User admin default

### 3. Settings (Key-Value Pairs)
```javascript
[
  { key: 'store_name', value: 'Zona Mapan Coffee Shop' },
  { key: 'store_address', value: '' },
  { key: 'store_phone', value: '' },
  { key: 'currency', value: 'IDR' },
  { key: 'timezone', value: 'Asia/Jakarta' },
  { key: 'tax_rate', value: 0 },
  { key: 'service_charge', value: 0 },
  { key: 'loyalty_settings', value: {...} },
  { key: 'notification_sound', value: '/sounds/notif.mp3' },
  { key: 'units', value: ['pcs', 'kg', 'liter', 'porsi'] },
  { key: 'initialized', value: true },
  { key: 'initialized_at', value: '2025-01-XX...' }
]
```

### 4. Admin User (Employee)
```javascript
{
  id: "EMP-1234567890",
  username: "admin",
  password: "[hashed]", // bcrypt hash dari "admin123"
  name: "Administrator",
  role: "admin",
  role_access: ['POS', 'Kitchen', 'Meja', 'Keuangan', 'Laporan', 'Menu', 'Pegawai', 'Pengaturan'],
  status: "active",
  isActive: true
}
```

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

## 🔐 Login After Seeding

### Via Frontend
1. Buka `http://localhost:5002/auth/login`
2. Isi form:
   - Tenant Slug: `zona-mapan`
   - Username: `admin`
   - Password: `admin123`
3. Klik "Masuk"

### Via API
```bash
curl -X POST http://localhost:5001/api/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: zona-mapan" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

## 🔄 Update Existing Tenant

Jika tenant dengan slug yang sama sudah ada, script akan:
1. Update data tenant di database utama
2. Skip seeding settings (tidak overwrite)
3. Skip seeding admin user (tidak overwrite)

```bash
# Update tenant yang sudah ada
node backend/scripts/seedTenant.js zona-mapan "Zona Mapan Coffee (Updated)"
```

## 🧹 Cleanup Failed Tenant

Jika seeding gagal dan ingin membersihkan:

```bash
node backend/scripts/cleanupFailedTenant.js zona-mapan
```

## 🔧 Integration dengan TenantController

Seeding user admin juga otomatis dipanggil saat registrasi tenant via API:

```javascript
// POST /api/tenants/register
{
  "name": "Zona Mapan Coffee",
  "slug": "zona-mapan"
}
```

Controller akan otomatis:
1. Membuat entry tenant
2. Membuat database tenant
3. Seeding settings
4. Seeding admin user (via seedAdminUser utility)

## 📝 Utility Function

File `backend/utils/seedAdminUser.js` berisi fungsi reusable untuk seeding admin:

```javascript
const { seedAdminUser } = require('../utils/seedAdminUser');

// Usage
const adminResult = await seedAdminUser(tenantDB, tenantName);

// Returns
{
  success: true,
  existed: false, // true jika admin sudah ada
  admin: {
    id: "EMP-xxx",
    username: "admin",
    name: "Administrator",
    role: "admin"
  },
  credentials: {
    username: "admin",
    password: "admin123" // plain password untuk ditampilkan
  }
}
```

## ⚠️ Security Notes

1. **Change Default Password**: Segera ubah password default setelah login pertama kali
2. **Password Hashing**: Password di-hash menggunakan bcrypt dengan salt rounds 10
3. **Admin Access**: User admin memiliki akses penuh ke semua fitur

## 🐛 Troubleshooting

### Error: "Slug tenant wajib disertakan"
```bash
# Pastikan menyertakan slug sebagai argument
node backend/scripts/seedTenant.js zona-mapan
```

### Error: "MongoDB connection error"
```bash
# Pastikan MongoDB running
# Cek .env file untuk MONGODB_URI
```

### Error: "Tenant sudah ada"
```bash
# Ini bukan error, tenant akan diupdate
# Jika ingin membuat ulang, hapus dulu:
node backend/scripts/cleanupFailedTenant.js zona-mapan
```

### Admin user tidak bisa login
```bash
# Cek apakah admin user sudah dibuat
mongo
> use superkafe_zona_mapan
> db.employees.findOne({username: "admin"})

# Jika tidak ada, jalankan ulang seeding
node backend/scripts/seedTenant.js zona-mapan
```

## 📊 Verification

### Check Tenant in Main DB
```bash
mongo
> use superkafe_v2
> db.tenants.find({slug: "zona-mapan"})
```

### Check Tenant Database
```bash
mongo
> use superkafe_zona_mapan
> show collections
> db.settings.find()
> db.employees.findOne({username: "admin"})
```

### Test API
```bash
# Test tenant resolver
curl -H "x-tenant-id: zona-mapan" \
  http://localhost:5001/api/test/tenant-info

# Test login
curl -X POST http://localhost:5001/api/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: zona-mapan" \
  -d '{"username":"admin","password":"admin123"}'
```

## 🎯 Best Practices

1. **Naming Convention**: Gunakan kebab-case untuk slug (zona-mapan, warkop-jakarta)
2. **Descriptive Names**: Berikan nama yang jelas untuk tenant
3. **Test First**: Test di development sebelum production
4. **Backup**: Backup database sebelum seeding di production
5. **Change Password**: Ubah password default segera setelah login

## 📞 Support

Jika ada masalah dengan seeding, cek:
1. MongoDB connection
2. .env configuration
3. Model schemas (Employee, Setting, Tenant)
4. Logs di console untuk error details
