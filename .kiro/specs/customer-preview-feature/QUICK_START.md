# 🚀 Customer Preview Feature - Quick Start Guide

## Cara Menggunakan (Admin)

### 1. Buka Preview
1. Login sebagai Admin/Owner
2. Lihat sidebar kiri
3. Scroll ke bawah, cari menu "👁️ Lihat Tampilan Customer"
4. Klik menu tersebut
5. Tab baru akan terbuka dengan tampilan customer

### 2. Review Menu
- Lihat semua menu yang aktif
- Cek harga, gambar, dan deskripsi
- Pastikan status (Sold Out, Non-Active) benar
- Test search dan filter kategori

### 3. Kembali ke Admin
- Klik tombol "🔙 Kembali ke Dashboard" di pojok kanan atas
- Atau close tab secara manual
- Admin panel Anda tetap terbuka (tidak reload)

## Fitur Preview Mode

### Visual Indicators
- **Badge "👁️ Mode Preview"** - Menunjukkan Anda dalam mode preview
- **Tombol "Kembali ke Dashboard"** - Quick access kembali ke admin

### Yang Bisa Dilihat
✅ Semua menu aktif
✅ Harga dan diskon
✅ Gambar menu
✅ Kategori dan filter
✅ Banner promo
✅ Status menu (Sold Out, dll)

### Yang Tidak Bisa Dilakukan
❌ Menambah ke cart (preview only)
❌ Checkout order
❌ Edit menu (gunakan Menu Management)

## Tips & Tricks

### 1. Validasi Sebelum Publikasi
- Buka preview setelah update menu
- Pastikan harga sudah benar
- Cek gambar tidak broken
- Test di mobile device juga

### 2. Share dengan Team
- Copy URL dari address bar
- Share ke team untuk review
- Mereka bisa lihat tanpa login admin

### 3. Test Responsiveness
- Resize browser window
- Test di mobile device
- Pastikan semua terlihat baik

## Troubleshooting

### Preview tidak muncul?
**Solusi:**
1. Pastikan Anda login sebagai Admin/Owner
2. Refresh halaman admin
3. Clear cache browser
4. Re-login jika perlu

### Menu tidak muncul di preview?
**Solusi:**
1. Cek status menu di Menu Management
2. Pastikan menu status = "ACTIVE"
3. Refresh preview page
4. Cek koneksi internet

### Tombol "Kembali" tidak berfungsi?
**Solusi:**
1. Close tab secara manual
2. Buka admin panel di tab lain
3. Atau ketik URL admin manual: `/{slug}/admin/dashboard`

## FAQ

**Q: Apakah customer bisa lihat badge "Mode Preview"?**
A: Tidak. Badge hanya muncul untuk admin yang login.

**Q: Apakah preview real-time?**
A: Ya. Data yang ditampilkan adalah data terbaru dari database.

**Q: Bisa edit menu dari preview?**
A: Belum. Gunakan Menu Management untuk edit. (Future enhancement)

**Q: Apakah aman share URL preview?**
A: Ya. URL preview menggunakan tenant slug yang public. Tapi admin features hanya muncul untuk admin yang login.

## Keyboard Shortcuts (Future)

- `Ctrl + P` - Open preview (planned)
- `Esc` - Close preview (planned)
- `Ctrl + E` - Quick edit (planned)

## Next Steps

1. ✅ Test fitur preview
2. ✅ Validasi menu Anda
3. ✅ Share dengan team
4. ✅ Deploy ke production
5. ✅ Build APK

---

**Need Help?** Check full documentation: `.kiro/specs/customer-preview-feature/implementation.md`
