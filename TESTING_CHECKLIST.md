# Testing Checklist: Alur Registrasi & Seeding Menu

## 📋 Overview

Checklist ini untuk memastikan semua fitur baru berfungsi dengan baik sebelum deploy ke production.

## ✅ Pre-Testing Setup

- [ ] MongoDB sudah running
- [ ] Backend server running di port 5001
- [ ] Frontend server running di port 5002
- [ ] File `.env` sudah dikonfigurasi dengan benar
- [ ] SMTP email sudah dikonfigurasi (untuk OTP)
- [ ] Database backup sudah dibuat

## 🧪 Test Cases

### 1. Registrasi dengan Email & Password

#### Test Case 1.1: Registrasi Sukses
- [ ] Buka `/auth/register`
- [ ] Isi nama: "Test User"
- [ ] Isi email: "test@example.com"
- [ ] Isi password: "test123456"
- [ ] Isi konfirmasi password: "test123456"
- [ ] Klik "Daftar Sekarang"
- [ ] **Expected:** Toast sukses muncul
- [ ] **Expected:** Redirect ke `/auth/verify-otp`
- [ ] **Expected:** Email OTP terkirim

#### Test Case 1.2: Registrasi dengan Email yang Sudah Ada
- [ ] Buka `/auth/register`
- [ ] Isi dengan email yang sudah terdaftar
- [ ] Klik "Daftar Sekarang"
- [ ] **Expected:** Error "Email sudah terdaftar"

#### Test Case 1.3: Validasi Password Tidak Cocok
- [ ] Buka `/auth/register`
- [ ] Isi password: "test123"
- [ ] Isi konfirmasi password: "test456"
- [ ] **Expected:** Error "Password tidak cocok"
- [ ] **Expected:** Tombol daftar disabled

#### Test Case 1.4: Validasi Email Invalid
- [ ] Buka `/auth/register`
- [ ] Isi email: "invalid-email"
- [ ] Klik "Daftar Sekarang"
- [ ] **Expected:** Error "Format email tidak valid"

#### Test Case 1.5: Validasi Password Kurang dari 6 Karakter
- [ ] Buka `/auth/register`
- [ ] Isi password: "12345"
- [ ] Klik "Daftar Sekarang"
- [ ] **Expected:** Error "Password minimal 6 karakter"

### 2. Registrasi dengan Google OAuth

#### Test Case 2.1: Google Sign-Up Sukses (User Baru)
- [ ] Buka `/auth/register`
- [ ] Klik "Daftar dengan Google"
- [ ] Pilih akun Google
- [ ] **Expected:** Toast "Akun berhasil dibuat dengan Google!"
- [ ] **Expected:** Redirect ke `/setup-cafe`
- [ ] **Expected:** Token tersimpan di localStorage

#### Test Case 2.2: Google Sign-Up (User Sudah Ada)
- [ ] Buka `/auth/register`
- [ ] Klik "Daftar dengan Google"
- [ ] Pilih akun Google yang sudah terdaftar
- [ ] **Expected:** Toast "Login dengan Google berhasil!"
- [ ] **Expected:** Redirect sesuai status setup

### 3. Verifikasi OTP

#### Test Case 3.1: Verifikasi OTP Sukses
- [ ] Setelah registrasi, di halaman `/auth/verify-otp`
- [ ] Masukkan kode OTP yang benar (dari email)
- [ ] Klik "Verifikasi"
- [ ] **Expected:** Toast "Email berhasil diverifikasi!"
- [ ] **Expected:** Token tersimpan di localStorage
- [ ] **Expected:** Redirect ke `/setup-cafe`

#### Test Case 3.2: Verifikasi OTP Salah
- [ ] Di halaman `/auth/verify-otp`
- [ ] Masukkan kode OTP yang salah
- [ ] Klik "Verifikasi"
- [ ] **Expected:** Error "Kode OTP tidak valid"

#### Test Case 3.3: Verifikasi OTP Expired
- [ ] Tunggu 10 menit setelah registrasi
- [ ] Masukkan kode OTP lama
- [ ] Klik "Verifikasi"
- [ ] **Expected:** Error "Kode OTP sudah kadaluarsa"

#### Test Case 3.4: Resend OTP
- [ ] Di halaman `/auth/verify-otp`
- [ ] Klik "Kirim ulang kode"
- [ ] **Expected:** Toast "Kode OTP baru telah dikirim"
- [ ] **Expected:** Countdown 60 detik dimulai
- [ ] **Expected:** Email OTP baru terkirim
- [ ] **Expected:** Input OTP di-reset

#### Test Case 3.5: Paste OTP
- [ ] Copy kode OTP dari email
- [ ] Paste di input OTP pertama
- [ ] **Expected:** Semua 6 input terisi otomatis
- [ ] **Expected:** Focus ke input terakhir

### 4. Setup Wizard

#### Test Case 4.1: Setup Tenant Sukses
- [ ] Setelah verifikasi, di halaman `/setup-cafe`
- [ ] Isi nama kafe: "Warkop Test"
- [ ] Slug auto-generate: "warkop-test"
- [ ] Isi nama admin: "Admin Test"
- [ ] Klik "Buat Kafe Saya"
- [ ] **Expected:** Toast "Setup tenant berhasil!"
- [ ] **Expected:** Token baru tersimpan (dengan tenant info)
- [ ] **Expected:** Redirect ke `/<slug>/admin/dashboard`
- [ ] **Expected:** Dashboard menampilkan menu default

#### Test Case 4.2: Slug Availability Check
- [ ] Di halaman `/setup-cafe`
- [ ] Ketik nama kafe
- [ ] **Expected:** Slug auto-generate
- [ ] **Expected:** Icon loading muncul
- [ ] **Expected:** Icon check hijau jika tersedia
- [ ] **Expected:** Icon X merah jika tidak tersedia

#### Test Case 4.3: Slug Sudah Digunakan
- [ ] Di halaman `/setup-cafe`
- [ ] Isi slug yang sudah ada
- [ ] Klik "Buat Kafe Saya"
- [ ] **Expected:** Error "Slug sudah digunakan"

#### Test Case 4.4: Slug Reserved Keyword
- [ ] Di halaman `/setup-cafe`
- [ ] Isi slug: "admin"
- [ ] **Expected:** Error "Slug tidak tersedia"
- [ ] **Expected:** Tombol disabled

#### Test Case 4.5: Slug Format Invalid
- [ ] Di halaman `/setup-cafe`
- [ ] Isi slug dengan karakter special: "test@cafe"
- [ ] **Expected:** Karakter special otomatis dihapus
- [ ] **Expected:** Hanya huruf, angka, dan dash yang diterima

### 5. Seeding Menu Default

#### Test Case 5.1: Kategori Default Dibuat
- [ ] Setelah setup selesai
- [ ] Buka menu "Menu" di dashboard
- [ ] **Expected:** 4 kategori muncul:
  - [ ] ☕ Kopi
  - [ ] 🥤 Non Kopi
  - [ ] 🍔 Makanan
  - [ ] 🍪 Snack

#### Test Case 5.2: Menu Default Dibuat
- [ ] Di halaman menu
- [ ] **Expected:** 11 menu muncul:
  - [ ] Espresso (Rp 15.000)
  - [ ] Americano (Rp 18.000)
  - [ ] Cappuccino (Rp 22.000)
  - [ ] Cafe Latte (Rp 25.000)
  - [ ] Teh Manis (Rp 8.000)
  - [ ] Jus Jeruk (Rp 15.000)
  - [ ] Chocolate (Rp 20.000)
  - [ ] Sandwich (Rp 25.000)
  - [ ] Nasi Goreng (Rp 20.000)
  - [ ] French Fries (Rp 15.000)
  - [ ] Cookies (Rp 10.000)

#### Test Case 5.3: Menu Memiliki TenantId yang Benar
- [ ] Cek database tenant
- [ ] Query: `db.menuitems.find()`
- [ ] **Expected:** Semua menu memiliki field `tenantId`
- [ ] **Expected:** `tenantId` sesuai dengan tenant yang dibuat

#### Test Case 5.4: Menu Bisa Digunakan di POS
- [ ] Buka halaman POS
- [ ] **Expected:** Semua kategori muncul
- [ ] **Expected:** Semua menu bisa dipilih
- [ ] **Expected:** Harga tampil dengan benar

### 6. Migrasi Menu dari Database Lama

#### Test Case 6.1: Migrasi Sukses
- [ ] Buat tenant baru via setup wizard
- [ ] Jalankan: `node backend/scripts/migrateMenuToTenant.js <slug>`
- [ ] **Expected:** Output "✓ X kategori dimigrasikan"
- [ ] **Expected:** Output "✓ Y menu dimigrasikan"
- [ ] **Expected:** Output "✓ Migrasi selesai!"

#### Test Case 6.2: Menu Lama Muncul di Dashboard
- [ ] Setelah migrasi
- [ ] Refresh dashboard
- [ ] **Expected:** Menu lama muncul
- [ ] **Expected:** Kategori lama muncul
- [ ] **Expected:** Harga sesuai dengan database lama

#### Test Case 6.3: Migrasi Tidak Duplikat
- [ ] Jalankan migrasi 2x untuk tenant yang sama
- [ ] **Expected:** Run kedua skip semua data
- [ ] **Expected:** Output "0 kategori dimigrasikan"
- [ ] **Expected:** Output "0 menu dimigrasikan"

#### Test Case 6.4: Migrasi dengan Source Database Custom
- [ ] Jalankan: `node backend/scripts/migrateMenuToTenant.js <slug> custom_db`
- [ ] **Expected:** Koneksi ke database custom
- [ ] **Expected:** Data dari database custom dimigrasikan

#### Test Case 6.5: Migrasi Tenant Tidak Ditemukan
- [ ] Jalankan: `node backend/scripts/migrateMenuToTenant.js invalid-slug`
- [ ] **Expected:** Error "Tenant 'invalid-slug' tidak ditemukan"
- [ ] **Expected:** Script exit dengan error code

### 7. JWT Token

#### Test Case 7.1: Token Sebelum Setup
- [ ] Setelah verifikasi OTP
- [ ] Decode JWT token dari localStorage
- [ ] **Expected:** Token berisi:
  - [ ] `userId`
  - [ ] `email`
  - [ ] `hasCompletedSetup: false`
  - [ ] `tenantSlug: null`

#### Test Case 7.2: Token Setelah Setup
- [ ] Setelah setup selesai
- [ ] Decode JWT token baru
- [ ] **Expected:** Token berisi:
  - [ ] `id` (employee id)
  - [ ] `email`
  - [ ] `role: "admin"`
  - [ ] `tenant` (slug)
  - [ ] `tenantId`
  - [ ] `tenantDbName`
  - [ ] `userId`

#### Test Case 7.3: Token Expired
- [ ] Tunggu token expired (7 hari)
- [ ] Coba akses dashboard
- [ ] **Expected:** Redirect ke login
- [ ] **Expected:** Error "Token expired"

### 8. Login Setelah Setup

#### Test Case 8.1: Login dengan Email & Password
- [ ] Logout dari dashboard
- [ ] Buka `/auth/login`
- [ ] Isi email dan password
- [ ] Klik "Masuk"
- [ ] **Expected:** Login sukses
- [ ] **Expected:** Redirect ke dashboard tenant
- [ ] **Expected:** Menu masih ada

#### Test Case 8.2: Login dengan Google
- [ ] Logout dari dashboard
- [ ] Buka `/auth/login`
- [ ] Klik "Masuk dengan Google"
- [ ] **Expected:** Login sukses
- [ ] **Expected:** Redirect ke dashboard tenant

### 9. Edge Cases

#### Test Case 9.1: Refresh di Tengah Proses
- [ ] Di halaman setup wizard
- [ ] Refresh browser (F5)
- [ ] **Expected:** Tetap di halaman setup
- [ ] **Expected:** Form data tidak hilang (jika ada)

#### Test Case 9.2: Back Button di Setup Wizard
- [ ] Di halaman setup wizard
- [ ] Klik back button browser
- [ ] **Expected:** Kembali ke halaman sebelumnya
- [ ] **Expected:** Tidak ada error

#### Test Case 9.3: Logout Sebelum Setup Selesai
- [ ] Setelah verifikasi OTP
- [ ] Logout
- [ ] Login kembali
- [ ] **Expected:** Redirect ke setup wizard
- [ ] **Expected:** Bisa melanjutkan setup

#### Test Case 9.4: Akses Dashboard Tanpa Setup
- [ ] Login dengan user yang belum setup
- [ ] Coba akses `/<slug>/admin/dashboard`
- [ ] **Expected:** Redirect ke setup wizard
- [ ] **Expected:** Error message yang jelas

#### Test Case 9.5: Multiple User Setup Bersamaan
- [ ] Buka 2 browser berbeda
- [ ] Registrasi 2 user berbeda
- [ ] Setup tenant dengan slug yang sama
- [ ] **Expected:** User pertama sukses
- [ ] **Expected:** User kedua error "Slug sudah digunakan"

### 10. Database Validation

#### Test Case 10.1: User Collection
- [ ] Cek database utama
- [ ] Query: `db.users.findOne({ email: "test@example.com" })`
- [ ] **Expected:** User ada
- [ ] **Expected:** Field `hasCompletedSetup: true`
- [ ] **Expected:** Field `tenantId` ada
- [ ] **Expected:** Field `tenantSlug` ada

#### Test Case 10.2: Tenant Collection
- [ ] Cek database utama
- [ ] Query: `db.tenants.findOne({ slug: "test-slug" })`
- [ ] **Expected:** Tenant ada
- [ ] **Expected:** Field `dbName` sesuai format
- [ ] **Expected:** Field `status: "trial"`
- [ ] **Expected:** Field `trialExpiresAt` ada

#### Test Case 10.3: Tenant Database Created
- [ ] Cek list databases
- [ ] **Expected:** Database `superkafe_<slug>` ada
- [ ] **Expected:** Collection `settings` ada
- [ ] **Expected:** Collection `employees` ada
- [ ] **Expected:** Collection `categories` ada
- [ ] **Expected:** Collection `menuitems` ada

#### Test Case 10.4: Settings Seeded
- [ ] Cek tenant database
- [ ] Query: `db.settings.find()`
- [ ] **Expected:** Minimal 10 settings ada
- [ ] **Expected:** Setting `store_name` sesuai input
- [ ] **Expected:** Setting `initialized: true`

#### Test Case 10.5: Admin User Created
- [ ] Cek tenant database
- [ ] Query: `db.employees.findOne({ role: "admin" })`
- [ ] **Expected:** Admin user ada
- [ ] **Expected:** Email sesuai user yang registrasi
- [ ] **Expected:** Role: "admin"
- [ ] **Expected:** role_access lengkap

## 📊 Test Results Summary

### Pass/Fail Count
- Total Test Cases: ____ / ____
- Passed: ____
- Failed: ____
- Skipped: ____

### Critical Issues Found
1. 
2. 
3. 

### Minor Issues Found
1. 
2. 
3. 

### Performance Notes
- Setup time: ____ seconds
- Seeding time: ____ seconds
- Migration time: ____ seconds

## ✅ Sign-Off

- [ ] All critical test cases passed
- [ ] All blocking issues resolved
- [ ] Documentation updated
- [ ] Ready for production deployment

**Tested By:** ________________
**Date:** ________________
**Environment:** ________________
**Version:** ________________

---

**Testing Checklist** | Last Updated: 2024
