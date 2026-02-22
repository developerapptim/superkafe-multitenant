# Panduan Setup Tenant & Migrasi Menu

## 📋 Ringkasan

Dokumen ini menjelaskan alur registrasi baru yang sudah diperbaiki dan cara migrasi data menu ke tenant baru.

## 🔄 Alur Registrasi Baru (Fixed)

### 1. Registrasi User

**Endpoint:** `POST /api/auth/register`

User mendaftar dengan email dan password (atau Google OAuth). Sistem akan:
- Membuat user baru di database utama
- **TIDAK** langsung membuat tenant
- Mengirim OTP ke email untuk verifikasi

```javascript
// Request
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}

// Response
{
  "success": true,
  "message": "Registrasi berhasil! Silakan cek email Anda untuk kode verifikasi.",
  "data": {
    "email": "john@example.com",
    "name": "John Doe",
    "requiresVerification": true,
    "hasCompletedSetup": false
  }
}
```

### 2. Verifikasi Email (OTP)

**Endpoint:** `POST /api/auth/verify-otp`

User memasukkan kode OTP 6 digit yang diterima via email:

```javascript
// Request
{
  "email": "john@example.com",
  "otpCode": "123456"
}

// Response
{
  "success": true,
  "message": "Email berhasil diverifikasi!",
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "email": "john@example.com",
    "name": "John Doe",
    "hasCompletedSetup": false
  }
}
```

Setelah verifikasi, user akan diarahkan ke **Setup Wizard** (`/setup-cafe`).

### 3. Setup Wizard (Buat Tenant)

**Endpoint:** `POST /api/setup/tenant`

User mengisi informasi kafe di Setup Wizard:

```javascript
// Request (dengan JWT token di header)
{
  "cafeName": "Warkop Kopi Kenangan",
  "slug": "kopi-kenangan",
  "adminName": "John Doe" // optional
}

// Response
{
  "success": true,
  "message": "Setup tenant berhasil! Selamat datang di SuperKafe!",
  "token": "new-jwt-token-with-tenant-info",
  "user": {
    "id": "employee-id",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "admin"
  },
  "tenant": {
    "id": "tenant-id",
    "name": "Warkop Kopi Kenangan",
    "slug": "kopi-kenangan",
    "status": "trial",
    "trialExpiresAt": "2024-03-15T00:00:00.000Z",
    "trialDaysRemaining": 10
  }
}
```

### 4. Apa yang Terjadi di Backend Saat Setup?

Ketika user submit Setup Wizard, sistem akan:

1. **Validasi slug** - Cek apakah slug tersedia dan tidak reserved
2. **Buat tenant baru** di database utama
3. **Inisialisasi database tenant** dengan nama `superkafe_<slug>`
4. **Seed settings default** (nama toko, timezone, dll)
5. **Buat admin user** di database tenant (dari data user yang login)
6. **Seed kategori & menu default** agar dashboard tidak kosong
7. **Update user** di database utama (tandai setup selesai)
8. **Generate JWT baru** dengan informasi tenant
9. **Redirect ke dashboard** tenant-specific

## 📦 Seeding Menu Default

Saat setup tenant, sistem otomatis membuat:

### Kategori Default
- ☕ Kopi
- 🥤 Non Kopi
- 🍔 Makanan
- 🍪 Snack

### Menu Default (11 item)
- Espresso (Rp 15.000)
- Americano (Rp 18.000)
- Cappuccino (Rp 22.000)
- Cafe Latte (Rp 25.000)
- Teh Manis (Rp 8.000)
- Jus Jeruk (Rp 15.000)
- Chocolate (Rp 20.000)
- Sandwich (Rp 25.000)
- Nasi Goreng (Rp 20.000)
- French Fries (Rp 15.000)
- Cookies (Rp 10.000)

Semua menu ini sudah memiliki `tenantId` yang benar dan akan langsung muncul di dashboard.

## 🔧 Migrasi Menu dari Database Lama

Jika Anda sudah memiliki data menu di database lama dan ingin menyalinnya ke tenant baru, gunakan skrip migrasi:

### Cara Menggunakan Skrip Migrasi

```bash
# Format
node backend/scripts/migrateMenuToTenant.js <tenant-slug> [source-db-name]

# Contoh 1: Migrasi dari database default (superkafe_v2)
node backend/scripts/migrateMenuToTenant.js sulkopi

# Contoh 2: Migrasi dari database custom
node backend/scripts/migrateMenuToTenant.js sulkopi superkafe_old
```

### Apa yang Dilakukan Skrip?

1. Koneksi ke database utama
2. Cari tenant berdasarkan slug
3. Koneksi ke database sumber (lama) dan database tenant (tujuan)
4. Copy semua kategori dengan menambahkan `tenantId`
5. Copy semua menu dengan menambahkan `tenantId`
6. Skip data yang sudah ada (tidak duplikat)

### Output Skrip

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

## 🎯 Alur Lengkap User Baru

```
1. User buka landing page (/)
   ↓
2. Klik "Daftar" → /auth/register
   ↓
3. Isi form registrasi (nama, email, password)
   atau klik "Daftar dengan Google"
   ↓
4. Sistem kirim OTP ke email
   ↓
5. User masukkan OTP → /auth/verify-otp
   ↓
6. Email terverifikasi ✓
   ↓
7. Redirect ke Setup Wizard → /setup-cafe
   ↓
8. User isi informasi kafe:
   - Nama kafe
   - URL slug (auto-generate dari nama)
   - Nama admin (optional)
   ↓
9. Submit → Sistem buat tenant + seed data
   ↓
10. Redirect ke dashboard → /<slug>/admin/dashboard
    ↓
11. Dashboard sudah ada menu default! 🎉
```

## 🔐 JWT Token Structure

### Sebelum Setup (User belum punya tenant)
```javascript
{
  "userId": "user-id",
  "email": "john@example.com",
  "hasCompletedSetup": false,
  "tenantSlug": null
}
```

### Setelah Setup (User sudah punya tenant)
```javascript
{
  "id": "employee-id",
  "email": "john@example.com",
  "role": "admin",
  "tenant": "kopi-kenangan",
  "tenantId": "tenant-id",
  "tenantDbName": "superkafe_kopi_kenangan",
  "userId": "user-id"
}
```

## 📝 Catatan Penting

1. **Slug Validation**: Slug tidak boleh menggunakan reserved keywords seperti `admin`, `api`, `auth`, `setup`, dll. Lihat `backend/utils/slugValidator.js` untuk daftar lengkap.

2. **Trial Period**: Setiap tenant baru mendapat trial 10 hari gratis.

3. **Database Naming**: Database tenant menggunakan format `superkafe_<slug>` dengan underscore menggantikan dash.

4. **Menu Default**: Menu default tidak menggunakan stock check (`use_stock_check: false`) agar langsung bisa digunakan.

5. **Admin User**: Admin user di tenant database dibuat dari data user yang login, dengan role `admin` dan akses penuh ke semua fitur.

## 🐛 Troubleshooting

### Dashboard Kosong Setelah Setup

Jika dashboard masih kosong setelah setup:

1. Cek apakah seeding berhasil di log backend
2. Cek database tenant apakah ada data di collection `categories` dan `menuitems`
3. Pastikan semua data memiliki field `tenantId` yang benar
4. Jika perlu, jalankan skrip migrasi manual

### Slug Sudah Digunakan

Jika mendapat error "Slug sudah digunakan":

1. Coba slug lain yang lebih unik
2. Tambahkan angka atau kata tambahan (contoh: `kopi-kenangan-2`)
3. Cek di database collection `tenants` untuk melihat slug yang sudah ada

### Email OTP Tidak Terkirim

Jika OTP tidak terkirim:

1. Cek konfigurasi email di `.env` (SMTP settings)
2. Cek log backend untuk error email
3. Cek folder spam di email
4. Gunakan tombol "Kirim ulang kode" setelah 60 detik

## 📚 File-file Terkait

- `backend/controllers/UnifiedAuthController.js` - Handle registrasi & login
- `backend/controllers/SetupController.js` - Handle setup tenant
- `backend/utils/seedDefaultMenu.js` - Seeding menu default
- `backend/utils/seedAdminUser.js` - Seeding admin user
- `backend/scripts/migrateMenuToTenant.js` - Migrasi menu dari database lama
- `frontend/src/pages/auth/SimpleRegister.jsx` - Form registrasi
- `frontend/src/pages/auth/OTPVerification.jsx` - Verifikasi OTP
- `frontend/src/pages/SetupWizard.jsx` - Setup wizard

## ✅ Checklist Testing

- [ ] Registrasi dengan email & password
- [ ] Registrasi dengan Google OAuth
- [ ] Verifikasi OTP
- [ ] Resend OTP
- [ ] Setup wizard dengan slug valid
- [ ] Setup wizard dengan slug invalid (reserved keyword)
- [ ] Setup wizard dengan slug yang sudah digunakan
- [ ] Dashboard menampilkan menu default setelah setup
- [ ] Migrasi menu dari database lama
- [ ] Login setelah setup selesai
- [ ] JWT token berisi informasi tenant yang benar

---

**Dibuat:** 2024
**Terakhir Update:** 2024
