# Quick Start: Backend di Localhost dengan MongoDB di VPS

## Situasi Anda
- ✅ MongoDB di VPS: `76.13.196.116`
- ✅ MongoDB Compass connect via SSH tunnel ke port `27018`
- ✅ Connection string: `mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin`

## 🚀 Cara Start Backend (2 Langkah)

### Langkah 1: Buat SSH Tunnel

**Buka PowerShell pertama:**
```powershell
cd backend
.\connect-vps-mongodb.ps1
```

Anda akan diminta password SSH VPS. Masukkan password, lalu **biarkan window ini tetap terbuka!**

Output yang benar:
```
========================================
  SSH Tunnel to VPS MongoDB
========================================

✓ SSH found: OpenSSH_...
✓ Configuration loaded from MongoDB Compass settings
  VPS IP: 76.13.196.116

Configuration:
  VPS IP       : 76.13.196.116
  VPS User     : root
  SSH Port     : 22
  MongoDB Port : 27017
  Local Port   : 27018

Connecting to VPS...
Press Ctrl+C to stop the tunnel

[Tunnel aktif - jangan tutup window ini!]
```

---

### Langkah 2: Start Backend

**Buka PowerShell kedua (window baru):**
```powershell
cd backend
npm start
```

Output yang benar:
```
✅ Server running on port 5001
✅ MongoDB connected successfully
✅ [DUITKU] Initialized in sandbox mode
✅ Static uploads folder: D:\...\backend\public\uploads
```

**Done!** Backend sekarang berjalan di http://localhost:5001

---

## 🔧 Troubleshooting

### Error: "ssh: command not found"

Install OpenSSH:
```powershell
# Run as Administrator
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

Atau download: https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse

---

### Error: "Permission denied (publickey)"

Script akan minta password SSH VPS. Masukkan password yang sama dengan yang Anda gunakan di Compass.

**Jika menggunakan SSH key:**
```powershell
# Edit script, tambahkan path ke SSH key
ssh -L 27018:localhost:27017 -i C:\path\to\your\key.pem root@76.13.196.116 -N
```

---

### Error: "Port 27018 already in use"

MongoDB Compass atau tunnel lama masih berjalan.

**Solusi 1: Tutup Compass**
- Tutup MongoDB Compass
- Jalankan script lagi

**Solusi 2: Kill process yang pakai port 27018**
```powershell
# Cek process
netstat -ano | findstr :27018

# Kill process (ganti <PID>)
taskkill /PID <PID> /F
```

---

### Error: "MongoDB connection error" di Backend

**Cek 1: Apakah SSH tunnel masih berjalan?**
- Lihat PowerShell pertama
- Jika sudah tertutup, jalankan lagi

**Cek 2: Test koneksi MongoDB**
```powershell
# Test dengan mongosh (jika terinstall)
mongosh "mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin"
```

**Cek 3: Verifikasi credentials**
- Username: `root`
- Password: `developerapptim1`
- Auth Database: `admin`

Jika salah, update `backend/.env`

---

## 💡 Tips

### Auto-start dengan 1 Command

Buat file `backend/start-dev.ps1`:
```powershell
# Start SSH tunnel in background
Write-Host "Starting SSH tunnel..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; .\connect-vps-mongodb.ps1"

# Wait for tunnel
Write-Host "Waiting for tunnel to establish..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Start backend
Write-Host "Starting backend..." -ForegroundColor Green
npm start
```

Lalu jalankan:
```powershell
.\start-dev.ps1
```

---

### Gunakan SSH Config (Opsional)

Buat file `~/.ssh/config`:
```
Host superkafe-vps
    HostName 76.13.196.116
    User root
    Port 22
    LocalForward 27018 localhost:27017
```

Lalu connect dengan:
```powershell
ssh superkafe-vps -N
```

---

## 📋 Checklist

- [ ] Buka PowerShell pertama
- [ ] Jalankan `.\connect-vps-mongodb.ps1`
- [ ] Masukkan password SSH VPS
- [ ] Biarkan window pertama tetap terbuka
- [ ] Buka PowerShell kedua
- [ ] Jalankan `npm start`
- [ ] Backend berhasil connect ke MongoDB
- [ ] Test: http://localhost:5001/api/health

---

## 🎯 Workflow Development

**Setiap kali mau development:**

1. **Start SSH Tunnel** (PowerShell 1)
   ```powershell
   cd backend
   .\connect-vps-mongodb.ps1
   ```

2. **Start Backend** (PowerShell 2)
   ```powershell
   cd backend
   npm run dev  # atau npm start
   ```

3. **Start Frontend** (PowerShell 3)
   ```powershell
   cd frontend
   npm run dev
   ```

**Selesai development:**
- Tutup semua PowerShell window
- Atau tekan `Ctrl+C` di masing-masing window

---

## ⚠️ Penting!

1. **Jangan tutup window SSH tunnel** selama development
2. **Jangan commit password** ke Git (sudah ada di .gitignore)
3. **Gunakan VPN** jika koneksi tidak stabil
4. **Backup database** secara berkala

---

## Need Help?

Jika masih error, screenshot:
1. Output dari `.\connect-vps-mongodb.ps1`
2. Error message dari `npm start`
3. Kirim ke saya untuk troubleshooting
