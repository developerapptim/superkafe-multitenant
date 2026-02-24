# Fix MongoDB Connection Error (SSH Tunnel)

## Masalah
Backend tidak bisa connect ke MongoDB di `127.0.0.1:27018`. Error yang muncul:
```
MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27018
```

Ini terjadi karena **SSH tunnel ke VPS belum aktif atau terputus**.

## Solusi

### 1. Cek Status Tunnel

Jalankan script checker:
```powershell
.\check-mongodb-tunnel.ps1
```

### 2. Aktifkan SSH Tunnel

#### Opsi A: Gunakan Script (Recommended)

1. Edit `backend/connect-vps-mongodb.ps1`:
   ```powershell
   $VPS_HOST = "your-vps-ip"      # Ganti dengan IP VPS Anda
   $VPS_USER = "root"              # Ganti dengan username SSH
   ```

2. Jalankan script:
   ```powershell
   .\backend\connect-vps-mongodb.ps1
   ```

#### Opsi B: Manual Command

```powershell
ssh -L 27018:127.0.0.1:27017 root@your-vps-ip -N
```

**Penting:** Biarkan window SSH tunnel tetap terbuka!

### 3. Verifikasi Tunnel

Di PowerShell baru:
```powershell
.\check-mongodb-tunnel.ps1
```

Harus menampilkan: ✅ SSH Tunnel AKTIF

### 4. Restart Backend

```bash
cd backend
npm start
```

Harus melihat:
```
✅ Connected to MongoDB (Local)
🚀 Server running on port 5001
```

## Troubleshooting

### Port 27018 Sudah Digunakan
```powershell
Get-NetTCPConnection -LocalPort 27018
Stop-Process -Id <PID> -Force
```

### SSH Authentication Failed
- Pastikan SSH key sudah terdaftar di VPS
- Atau gunakan password SSH yang benar

### Tunnel Sering Terputus
Gunakan auto-reconnect script (lihat `SSH_TUNNEL_GUIDE.md`)

## Setelah Tunnel Aktif

Pastikan tenant "sulkopi" ada di database:
```bash
node backend/scripts/checkTenant.js sulkopi
```

Jika tidak ada, buat dengan:
```bash
node backend/scripts/seedTenant.js sulkopi
```

---

Untuk panduan lengkap, lihat: `SSH_TUNNEL_GUIDE.md`
