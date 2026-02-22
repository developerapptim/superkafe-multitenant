# Panduan Cepat: Setup Tenant & Migrasi Menu

## 🎯 Masalah yang Sudah Diperbaiki

✅ Alur registrasi sekarang jelas: Daftar → Verifikasi → Setup → Dashboard
✅ Dashboard tidak lagi kosong setelah setup
✅ Menu default otomatis dibuat (11 menu siap pakai)
✅ Bisa migrasi menu dari database lama

## 🚀 Cara Daftar Akun Baru

### Langkah 1: Registrasi
1. Buka website → Klik "Daftar"
2. Isi nama, email, dan password
3. Atau klik "Daftar dengan Google"

### Langkah 2: Verifikasi Email
1. Cek email Anda (termasuk folder spam)
2. Masukkan kode OTP 6 digit
3. Klik "Verifikasi"

### Langkah 3: Setup Kafe
1. Isi nama kafe (contoh: "Warkop Kopi Kenangan")
2. URL slug otomatis dibuat (contoh: "warkop-kopi-kenangan")
3. Isi nama admin (opsional)
4. Klik "Buat Kafe Saya"

### Langkah 4: Selesai!
Dashboard Anda sudah terisi dengan menu default:
- ☕ 4 Kategori (Kopi, Non Kopi, Makanan, Snack)
- 🍽️ 11 Menu siap pakai
- 🎉 Langsung bisa mulai jualan!

## 📦 Menu Default yang Dibuat

### Kategori Kopi ☕
- Espresso - Rp 15.000
- Americano - Rp 18.000
- Cappuccino - Rp 22.000
- Cafe Latte - Rp 25.000

### Kategori Non Kopi 🥤
- Teh Manis - Rp 8.000
- Jus Jeruk - Rp 15.000
- Chocolate - Rp 20.000

### Kategori Makanan 🍔
- Sandwich - Rp 25.000
- Nasi Goreng - Rp 20.000

### Kategori Snack 🍪
- French Fries - Rp 15.000
- Cookies - Rp 10.000

## 🔄 Cara Migrasi Menu dari Database Lama

Jika Anda sudah punya data menu di database lama dan ingin menyalinnya:

### Langkah 1: Buka Terminal/Command Prompt

```bash
cd /path/to/project
```

### Langkah 2: Jalankan Skrip Migrasi

```bash
node backend/scripts/migrateMenuToTenant.js <slug-kafe-anda>
```

Contoh:
```bash
node backend/scripts/migrateMenuToTenant.js sulkopi
```

### Langkah 3: Tunggu Proses Selesai

Anda akan melihat output seperti ini:
```
[MIGRATE] ✓ 5 kategori dimigrasikan
[MIGRATE] ✓ 25 menu dimigrasikan
[MIGRATE] ✓ Migrasi selesai!
```

### Langkah 4: Refresh Dashboard

Buka dashboard dan refresh browser. Menu lama Anda akan muncul!

## ❓ Pertanyaan Umum (FAQ)

### Q: Dashboard masih kosong setelah setup?
**A:** Coba langkah berikut:
1. Refresh browser (Ctrl+F5)
2. Clear cache browser
3. Logout dan login kembali
4. Cek log backend untuk error

### Q: Slug yang saya mau sudah digunakan?
**A:** Coba slug lain yang lebih unik:
- Tambahkan nama kota: `kopi-kenangan-jakarta`
- Tambahkan angka: `kopi-kenangan-2`
- Gunakan nama yang lebih spesifik

### Q: Tidak menerima email OTP?
**A:** Coba langkah berikut:
1. Cek folder spam/junk
2. Tunggu 1-2 menit
3. Klik "Kirim ulang kode" (tunggu 60 detik)
4. Pastikan email yang diinput benar

### Q: Bagaimana cara edit menu default?
**A:** 
1. Masuk ke menu "Menu" di dashboard
2. Klik menu yang ingin diedit
3. Ubah nama, harga, atau deskripsi
4. Klik "Simpan"

### Q: Bisa hapus menu default?
**A:** Ya, bisa! Menu default hanya template awal. Anda bebas edit, hapus, atau tambah menu baru sesuai kebutuhan.

### Q: Bagaimana cara tambah menu baru?
**A:**
1. Masuk ke menu "Menu" di dashboard
2. Klik tombol "+ Tambah Menu"
3. Isi detail menu (nama, harga, kategori, dll)
4. Upload gambar (opsional)
5. Klik "Simpan"

## 🛠️ Troubleshooting

### Error: "Slug sudah digunakan"
**Solusi:** Gunakan slug yang berbeda. Slug harus unik untuk setiap kafe.

### Error: "Email sudah terdaftar"
**Solusi:** Email sudah digunakan. Gunakan email lain atau login dengan email tersebut.

### Error: "Kode OTP tidak valid"
**Solusi:** 
- Pastikan kode yang diinput benar (6 digit)
- Kode OTP berlaku 10 menit
- Jika sudah expired, klik "Kirim ulang kode"

### Dashboard tidak menampilkan menu
**Solusi:**
1. Pastikan Anda sudah login
2. Pastikan URL benar: `/<slug-kafe>/admin/dashboard`
3. Clear browser cache
4. Coba browser lain

### Migrasi menu gagal
**Solusi:**
1. Pastikan MongoDB sudah running
2. Pastikan slug kafe benar
3. Cek file `.env` untuk koneksi database
4. Lihat error message di terminal

## 📱 Kontak Support

Jika masih mengalami masalah:
1. Cek dokumentasi lengkap di `TENANT_SETUP_GUIDE.md`
2. Cek log error di browser console (F12)
3. Cek log backend di terminal
4. Screenshot error dan kirim ke tim support

## 🎓 Tips & Trik

### Tip 1: Gunakan Slug yang Mudah Diingat
Slug akan menjadi URL kafe Anda. Contoh bagus:
- ✅ `kopi-kenangan`
- ✅ `warkop-sulawesi`
- ✅ `cafe-jakarta`

Hindari:
- ❌ `kafe123abc`
- ❌ `my-awesome-coffee-shop-2024`

### Tip 2: Sesuaikan Menu Default
Menu default hanya template. Sesuaikan dengan menu kafe Anda:
- Edit harga sesuai harga jual Anda
- Ganti nama menu jika perlu
- Tambah deskripsi yang menarik
- Upload foto menu yang bagus

### Tip 3: Backup Data Secara Berkala
Jangan lupa backup data menu Anda secara berkala untuk menghindari kehilangan data.

### Tip 4: Manfaatkan Fitur Label
Tandai menu favorit dengan label:
- 🏆 Best Seller
- ⭐ Signature
- 🆕 New

## 📚 Dokumentasi Lengkap

Untuk informasi lebih detail, baca:
- **Setup Guide Lengkap:** `TENANT_SETUP_GUIDE.md`
- **Panduan Migrasi:** `backend/scripts/README_MIGRATION.md`
- **Quick Reference:** `QUICK_SETUP_REFERENCE.md`

## ✅ Checklist Setelah Setup

- [ ] Dashboard sudah menampilkan menu
- [ ] Bisa tambah menu baru
- [ ] Bisa edit menu existing
- [ ] Bisa hapus menu
- [ ] Bisa tambah kategori baru
- [ ] URL kafe sudah benar (/<slug>/admin)
- [ ] Bisa logout dan login kembali
- [ ] Foto profil sudah diupload (opsional)

## 🎉 Selamat!

Kafe Anda sudah siap beroperasi! Mulai kelola menu, terima pesanan, dan kembangkan bisnis Anda dengan SuperKafe.

---

**Panduan Cepat** | Bahasa Indonesia | 2024
