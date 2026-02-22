# Panduan Migrasi Data Menu ke Tenant

## 📋 Deskripsi

Skrip `migrateMenuToTenant.js` digunakan untuk menyalin data kategori dan menu dari database lama ke database tenant baru. Skrip ini akan otomatis menambahkan `tenantId` ke setiap data yang dimigrasikan.

## 🚀 Cara Penggunaan

### Syntax Dasar

```bash
node backend/scripts/migrateMenuToTenant.js <tenant-slug> [source-db-name]
```

### Parameter

- `<tenant-slug>` (Required): Slug tenant tujuan (contoh: `sulkopi`, `kopi-kenangan`)
- `[source-db-name]` (Optional): Nama database sumber. Default: `superkafe_v2`

### Contoh Penggunaan

#### 1. Migrasi dari Database Default

```bash
node backend/scripts/migrateMenuToTenant.js sulkopi
```

Akan menyalin data dari `superkafe_v2` ke `superkafe_sulkopi`

#### 2. Migrasi dari Database Custom

```bash
node backend/scripts/migrateMenuToTenant.js sulkopi superkafe_old
```

Akan menyalin data dari `superkafe_old` ke `superkafe_sulkopi`

#### 3. Migrasi untuk Tenant dengan Slug Panjang

```bash
node backend/scripts/migrateMenuToTenant.js zona-mapan-coffee
```

Akan menyalin data ke `superkafe_zona_mapan_coffee`

## 📊 Output Skrip

### Output Sukses

```
[MIGRATE] Memulai proses migrasi menu...
[MIGRATE] Target Tenant: sulkopi
[MIGRATE] Source Database: superkafe_v2
[MIGRATE] ✓ Koneksi database berhasil
[MIGRATE] ✓ Tenant ditemukan: Sulkopi Coffee

[MIGRATE] Migrasi kategori...
[MIGRATE] Ditemukan 5 kategori
[MIGRATE] ✓ 5 kategori dimigrasikan

[MIGRATE] Migrasi menu...
[MIGRATE] Ditemukan 25 menu
[MIGRATE] ✓ 25 menu dimigrasikan

[MIGRATE] ✓ Migrasi selesai!
Total: 5 kategori, 25 menu
```

### Output Error - Tenant Tidak Ditemukan

```
[MIGRATE] Error: Tenant 'sulkopi' tidak ditemukan
```

**Solusi:** Pastikan tenant sudah dibuat melalui Setup Wizard terlebih dahulu.

### Output - Data Sudah Ada

```
[MIGRATE] Migrasi kategori...
[MIGRATE] Ditemukan 5 kategori
[MIGRATE] ✓ 0 kategori dimigrasikan (semua sudah ada)

[MIGRATE] Migrasi menu...
[MIGRATE] Ditemukan 25 menu
[MIGRATE] ✓ 0 menu dimigrasikan (semua sudah ada)
```

Skrip akan skip data yang sudah ada untuk menghindari duplikasi.

## 🔍 Apa yang Dimigrasikan?

### Kategori

Semua field dari model `Category`:
- `id` - ID unik kategori
- `name` - Nama kategori
- `emoji` - Emoji kategori
- `order` - Urutan tampilan
- `tenantId` - **Ditambahkan otomatis**
- `createdAt` - Tanggal dibuat

### Menu Items

Semua field dari model `MenuItem`:
- `id` - ID unik menu
- `name` - Nama menu
- `description` - Deskripsi menu
- `price` - Harga menu
- `category` - Kategori (legacy)
- `categoryId` - ID kategori
- `imageUrl` - URL gambar
- `is_active` - Status aktif
- `use_stock_check` - Cek stok
- `order` - Urutan tampilan
- `label` - Label (best-seller, signature, new)
- `base_price` - Harga coret
- `is_bundle` - Paket bundling
- `bundle_items` - Item dalam bundle
- `tenantId` - **Ditambahkan otomatis**

## ⚠️ Catatan Penting

### 1. Tenant Harus Sudah Ada

Pastikan tenant sudah dibuat melalui Setup Wizard sebelum menjalankan skrip migrasi. Skrip akan error jika tenant tidak ditemukan.

### 2. Tidak Ada Duplikasi

Skrip akan otomatis skip data yang sudah ada berdasarkan field `id`. Aman untuk dijalankan berkali-kali.

### 3. TenantId Otomatis

Field `tenantId` akan ditambahkan otomatis ke semua data yang dimigrasikan. Ini penting untuk isolasi data antar tenant.

### 4. Database Connection

Pastikan:
- MongoDB sudah running
- Konfigurasi `MONGODB_URI` di `.env` sudah benar
- Database sumber dan tujuan bisa diakses

### 5. Backup Data

Disarankan untuk backup database sebelum menjalankan migrasi, terutama jika ini pertama kali.

## 🔧 Troubleshooting

### Error: "Tenant tidak ditemukan"

**Penyebab:** Tenant dengan slug tersebut belum dibuat.

**Solusi:**
1. Cek di database collection `tenants` apakah tenant ada
2. Pastikan slug yang diinput benar (case-sensitive)
3. Buat tenant melalui Setup Wizard terlebih dahulu

### Error: "Connection failed"

**Penyebab:** Tidak bisa koneksi ke MongoDB.

**Solusi:**
1. Pastikan MongoDB sudah running
2. Cek `MONGODB_URI` di file `.env`
3. Cek firewall/network settings

### Data Tidak Muncul di Dashboard

**Penyebab:** Data tidak memiliki `tenantId` yang benar.

**Solusi:**
1. Cek di database tenant apakah data ada
2. Cek field `tenantId` pada data
3. Pastikan JWT token berisi `tenantId` yang benar
4. Clear browser cache dan refresh

### Migrasi Lambat

**Penyebab:** Banyak data yang dimigrasikan.

**Solusi:**
- Normal, tunggu hingga selesai
- Jangan interrupt proses
- Monitor log untuk progress

## 📝 Contoh Skenario

### Skenario 1: Setup Tenant Baru dengan Data Lama

```bash
# 1. User registrasi dan setup tenant baru
# Frontend: /auth/register → /auth/verify-otp → /setup-cafe

# 2. Setelah setup selesai, jalankan migrasi
node backend/scripts/migrateMenuToTenant.js sulkopi

# 3. Refresh dashboard, menu lama akan muncul
```

### Skenario 2: Migrasi dari Database Backup

```bash
# 1. Restore database backup ke MongoDB
mongorestore --db superkafe_backup /path/to/backup

# 2. Jalankan migrasi dari database backup
node backend/scripts/migrateMenuToTenant.js sulkopi superkafe_backup

# 3. Data dari backup akan tersalin ke tenant baru
```

### Skenario 3: Migrasi Bertahap

```bash
# Migrasi tenant pertama
node backend/scripts/migrateMenuToTenant.js tenant1

# Migrasi tenant kedua
node backend/scripts/migrateMenuToTenant.js tenant2

# Migrasi tenant ketiga
node backend/scripts/migrateMenuToTenant.js tenant3
```

## 🔗 File Terkait

- `backend/scripts/migrateMenuToTenant.js` - Skrip migrasi
- `backend/models/Category.js` - Model kategori
- `backend/models/MenuItem.js` - Model menu
- `backend/models/Tenant.js` - Model tenant
- `backend/config/db.js` - Konfigurasi database

## 📞 Support

Jika mengalami masalah:
1. Cek log error di console
2. Cek dokumentasi di `TENANT_SETUP_GUIDE.md`
3. Cek konfigurasi database di `.env`
4. Pastikan semua dependencies sudah terinstall

---

**Dibuat:** 2024
**Terakhir Update:** 2024
