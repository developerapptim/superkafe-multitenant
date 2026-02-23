# Connect Backend ke MongoDB di VPS

## Situasi Anda
- ✅ MongoDB sudah berjalan di VPS
- ✅ MongoDB Compass bisa connect ke VPS (via `127.0.0.1:27018`)
- ❌ Backend di localhost tidak bisa connect

## Masalah
`127.0.0.1` di `.env` artinya localhost (komputer Anda), bukan VPS!

MongoDB Compass kemungkinan menggunakan **SSH Tunnel** untuk connect ke VPS.

---

## 🎯 Solusi: Setup SSH Tunnel untuk Backend

### Cara 1: Gunakan Script PowerShell (Recommended)

#### 1. Edit Script
Buka file `backend/connect-vps-mongodb.ps1` dan edit:

```powershell
$VPS_IP = "103.xxx.xxx.xxx"    # Ganti dengan IP VPS Anda
$VPS_USER = "root"              # Username SSH VPS
$VPS_SSH_PORT = 22              # Port SSH (default: 22)
$MONGODB_PORT = 27017           # Port MongoDB di VPS
$LOCAL_PORT = 27018             # Port lokal (sama dengan Compass)
```

#### 2. Jalankan Script
```powershell
# Buka PowerShell di folder backend
cd backend

# Jalankan script
.\connect-vps-mongodb.ps1
```

Script akan membuat SSH tunnel dan tetap berjalan. **Jangan tutup window ini!**

#### 3. Buka Terminal Baru, Start Backend
```powershell
# Terminal baru
cd backend
npm start
```

#### 4. Backend akan connect via tunnel
```
✅ MongoDB connected successfully
```

---

### Cara 2: Manual SSH Tunnel

Jika script tidak work, gunakan command manual:

```powershell
# Ganti YOUR_VPS_IP dengan IP VPS Anda
ssh -L 27018:localhost:27017 root@YOUR_VPS_IP -N
```

**Penjelasan:**
- `-L 27018:localhost:27017` = Forward port lokal 27018 ke port 27017 di VPS
- `-N` = Tidak execute command, hanya tunnel
- `root@YOUR_VPS_IP` = SSH user dan IP VPS

**Biarkan terminal ini tetap terbuka!**

Lalu di terminal baru:
```powershell
cd backend
npm start
```

---

### Cara 3: Direct Connection (Tanpa Tunnel)

Jika MongoDB di VPS sudah expose ke public (port terbuka):

#### 1. Update `.env`
```env
# Ganti YOUR_VPS_IP dengan IP VPS Anda
MONGODB_URI=mongodb://root:developerapptim1@YOUR_VPS_IP:27017/superkafe_v2?authSource=admin
```

#### 2. Pastikan Firewall VPS Allow Port MongoDB
```bash
# Di VPS, allow port MongoDB
sudo ufw allow 27017/tcp

# Atau jika pakai iptables
sudo iptables -A INPUT -p tcp --dport 27017 -j ACCEPT
```

#### 3. Pastikan MongoDB Bind ke 0.0.0.0
```bash
# Di VPS, edit config MongoDB
sudo nano /etc/mongod.conf

# Ubah bindIp
net:
  port: 27017
  bindIp: 0.0.0.0  # Allow remote connections

# Restart MongoDB
sudo systemctl restart mongod
```

⚠️ **WARNING:** Cara ini kurang aman untuk production! Gunakan SSH tunnel atau VPN.

---

## 🔍 Troubleshooting

### Error: "ssh: command not found"

Install OpenSSH di Windows:
```powershell
# Via PowerShell (Run as Administrator)
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

Atau download dari: https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse

---

### Error: "Permission denied (publickey)"

Anda perlu password atau SSH key untuk connect ke VPS.

**Dengan Password:**
```powershell
ssh -L 27018:localhost:27017 root@YOUR_VPS_IP -N
# Akan minta password VPS
```

**Dengan SSH Key:**
```powershell
ssh -L 27018:localhost:27017 -i path/to/your/key.pem root@YOUR_VPS_IP -N
```

---

### Error: "Port 27018 already in use"

Ada process lain yang pakai port 27018 (mungkin Compass atau tunnel lama).

**Cek process:**
```powershell
netstat -ano | findstr :27018
```

**Kill process:**
```powershell
# Ganti <PID> dengan PID dari hasil di atas
taskkill /PID <PID> /F
```

**Atau gunakan port lain:**
```powershell
# Gunakan port 27019 misalnya
ssh -L 27019:localhost:27017 root@YOUR_VPS_IP -N
```

Lalu update `.env`:
```env
MONGODB_URI=mongodb://root:developerapptim1@127.0.0.1:27019/superkafe_v2?authSource=admin
```

---

### Error: "Authentication failed"

Username/password salah. Cek credentials di MongoDB Compass Anda.

**Di Compass, klik connection > Edit > Lihat:**
- Username
- Password
- Authentication Database (biasanya `admin`)

Update `.env` sesuai credentials tersebut.

---

## 📋 Checklist

- [ ] Edit `connect-vps-mongodb.ps1` dengan IP VPS Anda
- [ ] Jalankan script SSH tunnel (biarkan tetap berjalan)
- [ ] Buka terminal baru
- [ ] `cd backend && npm start`
- [ ] Backend berhasil connect ke MongoDB

---

## 🎯 Rekomendasi

Untuk development lokal yang connect ke VPS:

1. **Gunakan SSH Tunnel** (Cara 1 atau 2) - Paling aman
2. **Jangan expose MongoDB ke public** - Security risk
3. **Gunakan VPN** jika tim besar - Lebih aman dari SSH tunnel

---

## 💡 Tips

### Auto-start SSH Tunnel

Buat file `backend/start-dev.ps1`:
```powershell
# Start SSH tunnel in background
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; .\connect-vps-mongodb.ps1"

# Wait for tunnel to establish
Start-Sleep -Seconds 3

# Start backend
npm start
```

Jalankan:
```powershell
.\start-dev.ps1
```

---

## Need Help?

Jika masih error, berikan info:
1. IP VPS Anda (atau domain)
2. Port MongoDB di VPS
3. Screenshot error message
4. Apakah Compass connect via SSH tunnel atau direct?
