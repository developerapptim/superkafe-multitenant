# Fix: TenantId Required Error

## 🐛 Masalah

Setup Wizard gagal dengan error:
```
Setting validation failed: tenantId: Path `tenantId` is required
```

## 🔍 Root Cause

Model `Setting`, `Category`, `MenuItem`, dan `Employee` menggunakan `tenantScopingPlugin` yang memerlukan field `tenantId` wajib diisi. Namun saat seeding data di `SetupController.js`, field `tenantId` tidak diisi, menyebabkan validasi error dan rollback database.

## ✅ Solusi

### 1. SetupController.js - Seeding Settings

**Sebelum:**
```javascript
const defaultSettings = [
  { key: 'store_name', value: cafeName, description: 'Nama toko/warkop' },
  // ... settings lainnya
];
```

**Sesudah:**
```javascript
const defaultSettings = [
  { key: 'store_name', value: cafeName, description: 'Nama toko/warkop', tenantId: newTenant._id },
  // ... settings lainnya dengan tenantId
];
```

### 2. seedAdminUser.js - Seeding Admin User

**Sebelum:**
```javascript
const seedAdminUser = async (tenantDB, cafeName, adminData) => {
  const newAdmin = {
    id: employeeId,
    username: adminData.username,
    // ... fields lainnya
  };
  // tenantId tidak ada
}
```

**Sesudah:**
```javascript
const seedAdminUser = async (tenantDB, cafeName, adminData, tenantId) => {
  const newAdmin = {
    id: employeeId,
    username: adminData.username,
    // ... fields lainnya
    tenantId: tenantId // Tambahkan tenantId
  };
}
```

**Update pemanggilan:**
```javascript
// Di SetupController.js
await seedAdminUser(tenantDB, cafeName, adminData, newTenant._id);
```

### 3. seedDefaultMenu.js

Sudah benar! File ini sudah menambahkan `tenantId` dengan benar:
```javascript
const categories = await CategoryModel.insertMany(
  defaultCategories.map(cat => ({
    ...cat,
    tenantId: tenantId, // ✅ Sudah ada
    createdAt: new Date()
  }))
);
```

### 4. seedTenant.js - Legacy Script

**Sebelum:**
```javascript
const adminData = {
  id: employeeId,
  username: 'admin',
  // ... fields lainnya
};
```

**Sesudah:**
```javascript
const adminData = {
  id: employeeId,
  username: 'admin',
  // ... fields lainnya
  tenantId: tenant._id // Tambahkan tenantId
};
```

## 📋 File yang Diperbaiki

1. ✅ `backend/controllers/SetupController.js` - Tambah tenantId di settings
2. ✅ `backend/utils/seedAdminUser.js` - Tambah parameter dan field tenantId
3. ✅ `backend/scripts/seedTenant.js` - Tambah tenantId di admin data
4. ✅ `backend/utils/seedDefaultMenu.js` - Sudah benar (tidak perlu diubah)

## 🧪 Testing

### Test Setup Wizard

1. Registrasi user baru
2. Verifikasi OTP
3. Isi Setup Wizard:
   - Nama kafe: "Test Cafe"
   - Slug: "test-cafe"
4. Submit

**Expected Result:**
- ✅ Setup berhasil tanpa error
- ✅ Redirect ke dashboard
- ✅ Dashboard menampilkan menu default
- ✅ Tidak ada error "tenantId is required"

### Verify Database

```javascript
// Cek Settings
db.settings.find({ tenantId: { $exists: false } })
// Expected: 0 documents

// Cek Categories
db.categories.find({ tenantId: { $exists: false } })
// Expected: 0 documents

// Cek MenuItems
db.menuitems.find({ tenantId: { $exists: false } })
// Expected: 0 documents

// Cek Employees
db.employees.find({ tenantId: { $exists: false } })
// Expected: 0 documents
```

## 🔐 TenantScopingPlugin

Plugin ini otomatis menambahkan field `tenantId` sebagai required ke semua model yang menggunakannya:

```javascript
// backend/plugins/tenantScopingPlugin.js
schema.add({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true, // ⚠️ REQUIRED!
    index: true
  }
});
```

**Model yang menggunakan plugin ini:**
- Setting
- Category
- MenuItem
- Employee
- Table
- Order
- Customer
- Attendance
- Shift
- Dan model lainnya...

## ⚠️ Catatan Penting

1. **Semua data yang dibuat di tenant database HARUS memiliki tenantId**
2. **TenantId harus diisi saat create, tidak bisa diupdate setelahnya**
3. **Jika ada seeding baru, pastikan selalu tambahkan tenantId**
4. **Plugin akan otomatis filter query berdasarkan tenantId**

## 📚 Related Files

- `backend/plugins/tenantScopingPlugin.js` - Plugin yang menambahkan tenantId
- `backend/models/Setting.js` - Model yang menggunakan plugin
- `backend/models/Employee.js` - Model yang menggunakan plugin
- `backend/models/Category.js` - Model yang menggunakan plugin
- `backend/models/MenuItem.js` - Model yang menggunakan plugin

## ✅ Checklist

- [x] Fix SetupController.js - settings seeding
- [x] Fix seedAdminUser.js - admin user seeding
- [x] Fix seedTenant.js - legacy script
- [x] Verify seedDefaultMenu.js - sudah benar
- [x] Update dokumentasi
- [ ] Test setup wizard end-to-end
- [ ] Verify database tidak ada data tanpa tenantId
- [ ] Test migrasi menu
- [ ] Deploy ke production

---

**Fixed:** 2024-02-23
**Status:** ✅ Ready for Testing
