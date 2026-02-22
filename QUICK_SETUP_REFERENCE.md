# Quick Setup Reference

## 🚀 Alur Registrasi Baru (Fixed)

```
Registrasi → Verifikasi OTP → Setup Wizard → Dashboard dengan Menu Default
```

## 📝 Registrasi User Baru

### Via Email & Password
```bash
POST /api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

### Via Google OAuth
```bash
POST /api/auth/google
{
  "idToken": "google-id-token",
  "email": "john@example.com",
  "name": "John Doe",
  "picture": "https://..."
}
```

## ✅ Verifikasi Email

```bash
POST /api/auth/verify-otp
{
  "email": "john@example.com",
  "otpCode": "123456"
}
```

## 🏪 Setup Tenant (Buat Kafe)

```bash
POST /api/setup/tenant
Headers: { Authorization: "Bearer <token>" }
{
  "cafeName": "Warkop Kopi Kenangan",
  "slug": "kopi-kenangan",
  "adminName": "John Doe"
}
```

## 📦 Apa yang Dibuat Otomatis?

✅ Database tenant baru (`superkafe_<slug>`)
✅ Settings default (nama toko, timezone, dll)
✅ Admin user dengan role admin
✅ 4 Kategori default (Kopi, Non Kopi, Makanan, Snack)
✅ 11 Menu default (siap pakai)
✅ JWT token baru dengan tenant info

## 🔄 Migrasi Menu dari Database Lama

```bash
# Dari database default (superkafe_v2)
node backend/scripts/migrateMenuToTenant.js sulkopi

# Dari database custom
node backend/scripts/migrateMenuToTenant.js sulkopi superkafe_old
```

## 🎯 Menu Default yang Dibuat

| Kategori | Menu | Harga |
|----------|------|-------|
| ☕ Kopi | Espresso | Rp 15.000 |
| ☕ Kopi | Americano | Rp 18.000 |
| ☕ Kopi | Cappuccino | Rp 22.000 |
| ☕ Kopi | Cafe Latte | Rp 25.000 |
| 🥤 Non Kopi | Teh Manis | Rp 8.000 |
| 🥤 Non Kopi | Jus Jeruk | Rp 15.000 |
| 🥤 Non Kopi | Chocolate | Rp 20.000 |
| 🍔 Makanan | Sandwich | Rp 25.000 |
| 🍔 Makanan | Nasi Goreng | Rp 20.000 |
| 🍪 Snack | French Fries | Rp 15.000 |
| 🍪 Snack | Cookies | Rp 10.000 |

## 🔐 JWT Token Structure

### Sebelum Setup
```json
{
  "userId": "user-id",
  "email": "john@example.com",
  "hasCompletedSetup": false
}
```

### Setelah Setup
```json
{
  "id": "employee-id",
  "email": "john@example.com",
  "role": "admin",
  "tenant": "kopi-kenangan",
  "tenantId": "tenant-id",
  "tenantDbName": "superkafe_kopi_kenangan"
}
```

## 🛠️ Testing Commands

```bash
# Cek tenant info
curl -H "x-tenant-id: kopi-kenangan" http://localhost:5001/api/test/tenant-info

# Cek ketersediaan slug
curl http://localhost:5001/api/setup/check-slug/kopi-kenangan

# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

## ⚠️ Reserved Slugs (Tidak Boleh Digunakan)

```
admin, api, auth, setup, login, register, dashboard, 
pos, kitchen, menu, employee, finance, report, settings,
customer, order, table, reservation, payment, analytics
```

## 📁 File Penting

```
backend/
├── controllers/
│   ├── UnifiedAuthController.js    # Registrasi & login
│   └── SetupController.js          # Setup tenant
├── utils/
│   ├── seedDefaultMenu.js          # Seed menu default
│   └── seedAdminUser.js            # Seed admin user
└── scripts/
    └── migrateMenuToTenant.js      # Migrasi menu

frontend/
└── src/
    └── pages/
        ├── auth/
        │   ├── SimpleRegister.jsx  # Form registrasi
        │   └── OTPVerification.jsx # Verifikasi OTP
        └── SetupWizard.jsx         # Setup wizard
```

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Dashboard kosong | Cek log backend, pastikan seeding berhasil |
| Slug sudah digunakan | Gunakan slug lain yang lebih unik |
| OTP tidak terkirim | Cek SMTP config di .env, cek folder spam |
| Tenant tidak ditemukan | Pastikan setup wizard sudah selesai |
| Menu tidak muncul | Cek tenantId di data, refresh browser |

## 📚 Dokumentasi Lengkap

- `TENANT_SETUP_GUIDE.md` - Panduan lengkap setup tenant
- `backend/scripts/README_MIGRATION.md` - Panduan migrasi menu
- `backend/scripts/README_SEEDING.md` - Panduan seeding data

---

**Quick Reference** | Dibuat: 2024
