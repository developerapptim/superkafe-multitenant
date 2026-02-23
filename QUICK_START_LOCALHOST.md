# 🚀 Quick Start: Jalankan Backend di Localhost

## Situasi
- MongoDB ada di VPS: `76.13.196.116`
- MongoDB Compass connect via SSH tunnel
- Backend perlu SSH tunnel yang sama

## ✅ Solusi 2 Langkah

### 1️⃣ Start SSH Tunnel (PowerShell Pertama)

```powershell
cd backend
.\connect-vps-mongodb.ps1
```

**Masukkan password SSH VPS** ketika diminta.

**Biarkan window ini tetap terbuka!** ⚠️

---

### 2️⃣ Start Backend (PowerShell Kedua - Window Baru)

```powershell
cd backend
npm start
```

**Done!** Backend berjalan di http://localhost:5001

---

## 📋 Verifikasi

Backend berhasil jika muncul:
```
✅ Server running on port 5001
✅ MongoDB connected successfully
✅ [DUITKU] Initialized in sandbox mode
```

Test API: http://localhost:5001/api/health

---

## 🔧 Troubleshooting

### "ssh: command not found"
```powershell
# Install OpenSSH (Run as Administrator)
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

### "Port 27018 already in use"
Tutup MongoDB Compass atau kill process:
```powershell
netstat -ano | findstr :27018
taskkill /PID <PID> /F
```

### "Permission denied"
Masukkan password SSH VPS yang benar (sama dengan Compass).

---

## 📚 Dokumentasi Lengkap

- **`backend/START_BACKEND_LOCALHOST.md`** - Panduan detail
- **`backend/connect-vps-mongodb.ps1`** - Script SSH tunnel
- **`backend/VPS_MONGODB_SETUP.md`** - Setup alternatif

---

## 💡 Tips

**Development workflow:**
1. Start SSH tunnel (PowerShell 1)
2. Start backend (PowerShell 2)
3. Start frontend (PowerShell 3): `cd frontend && npm run dev`

**Selesai development:** Tutup semua window atau tekan `Ctrl+C`

---

## ⚡ Next Steps

Setelah backend berjalan:
1. Test API: http://localhost:5001/api/health
2. Start frontend: `cd frontend && npm run dev`
3. Buka browser: http://localhost:5174

Happy coding! 🎉
