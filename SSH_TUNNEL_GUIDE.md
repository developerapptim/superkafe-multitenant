# Panduan SSH Tunnel ke MongoDB VPS

## Masalah
Backend tidak bisa connect ke MongoDB karena SSH tunnel ke VPS belum aktif atau terputus.

## Solusi Cepat

### 1. Edit Script SSH Tunnel

Edit file `backend/connect-vps-mongodb.ps1` dan sesuaikan konfigurasi VPS Anda:

```powershell
$VPS_HOST = "your-vps-ip-or-hostname"  # Ganti dengan IP/hostname VPS
$VPS_USER = "root"                      # Ganti dengan username SSH
$VPS_SSH_PORT = 22                      # Port SSH (biasanya 22)
```

### 2. Jalankan SSH Tunnel

Buka PowerShell baru dan jalankan:

```powershell
.\backend\connect-vps-mongodb.ps1
```

Atau manual dengan command:

```powershell
ssh -L 27018:127.0.0.1:27017 root@your-vps-ip -N
```

**Penjelasan:**
- `-L 27018:127.0.0.1:27017` = Forward local port 27018 ke MongoDB di VPS (port 27017)
- `-N` = Tidak execute command, hanya tunnel
- Biarkan window ini tetap terbuka

### 3. Verifikasi Tunnel Aktif

Di PowerShell lain, cek apakah port 27018 sudah listening:

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 27018
```

Harus menampilkan:
```
TcpTestSucceeded : True
```

### 4. Restart Backend Server

Setelah tunnel aktif, restart backend:

```bash
cd backend
npm start
```

Anda harus melihat:
```
✅ Connected to MongoDB (Local)
🚀 Server running on port 5001
```

## Troubleshooting

### SSH Tunnel Terputus
Jika tunnel terputus, jalankan ulang script atau command SSH.

### Port 27018 Sudah Digunakan
Cek process yang menggunakan port:
```powershell
Get-NetTCPConnection -LocalPort 27018 | Select-Object OwningProcess
Get-Process -Id <PID>
```

Kill process jika perlu:
```powershell
Stop-Process -Id <PID> -Force
```

### Authentication Failed
Pastikan:
- SSH key sudah terdaftar di VPS, atau
- Password SSH benar

### Connection Timeout
Pastikan:
- VPS IP/hostname benar
- Firewall VPS mengizinkan SSH (port 22)
- Internet connection stabil

## Tips Development

### Gunakan SSH Key (Tanpa Password)

1. Generate SSH key (jika belum punya):
   ```powershell
   ssh-keygen -t rsa -b 4096
   ```

2. Copy public key ke VPS:
   ```powershell
   type $env:USERPROFILE\.ssh\id_rsa.pub | ssh root@your-vps-ip "cat >> ~/.ssh/authorized_keys"
   ```

3. Test connection:
   ```powershell
   ssh root@your-vps-ip
   ```

### Auto-Reconnect Tunnel

Buat script yang auto-reconnect jika tunnel terputus:

```powershell
# auto-tunnel.ps1
while ($true) {
    Write-Host "🔗 Starting SSH tunnel..." -ForegroundColor Cyan
    ssh -L 27018:127.0.0.1:27017 root@your-vps-ip -N -o ServerAliveInterval=60 -o ServerAliveCountMax=3
    Write-Host "⚠️  Tunnel disconnected. Reconnecting in 5 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}
```

### Gunakan Screen/Tmux di VPS

Jika MongoDB di VPS sering restart, gunakan screen/tmux untuk keep alive:

```bash
# Di VPS
screen -S mongodb
mongod --config /etc/mongod.conf
# Tekan Ctrl+A, lalu D untuk detach
```

## Alternatif: Expose MongoDB Langsung (Tidak Disarankan)

Jika Anda ingin expose MongoDB langsung tanpa SSH tunnel (TIDAK AMAN untuk production):

1. Edit MongoDB config di VPS (`/etc/mongod.conf`):
   ```yaml
   net:
     port: 27017
     bindIp: 0.0.0.0  # HATI-HATI: Ini expose ke public!
   ```

2. Restart MongoDB:
   ```bash
   sudo systemctl restart mongod
   ```

3. Update `backend/.env`:
   ```
   MONGODB_URI=mongodb://root:password@your-vps-ip:27017/superkafe_negoes?authSource=admin
   ```

⚠️ **WARNING**: Ini sangat tidak aman! Gunakan hanya untuk testing. Untuk production, gunakan:
- SSH tunnel (recommended)
- VPN
- MongoDB Atlas
- Firewall rules yang ketat
