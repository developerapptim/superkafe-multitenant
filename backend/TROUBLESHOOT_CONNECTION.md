# Troubleshooting: MongoDB Connection Error

## Situasi Anda
- ✅ SSH tunnel berjalan (window 1)
- ❌ Backend error: `ECONNREFUSED 127.0.0.1:27018`

## Kemungkinan Penyebab

### 1. SSH Tunnel Belum Sepenuhnya Establish
Backend start terlalu cepat sebelum tunnel siap.

**Solusi:**
```powershell
# Window 1: Start tunnel
.\connect-vps-mongodb.ps1

# TUNGGU 10-15 DETIK

# Window 2: Baru start backend
npm start
```

---

### 2. Port MongoDB di VPS Bukan 27017
MongoDB Compass connect ke `127.0.0.1:27018`, kemungkinan MongoDB di VPS juga di port 27018.

**Cek di MongoDB Compass:**
1. Klik connection "127.0.0.1:27018"
2. Klik "Edit"
3. Lihat tab "Advanced" atau "SSH Tunnel"
4. Cek "SSH Tunnel Port Forwarding"

**Jika MongoDB di VPS port 27018, ubah tunnel:**
```powershell
# Ganti command tunnel menjadi:
ssh -L 27018:localhost:27018 -N root@76.13.196.116
```

---

### 3. Verifikasi Tunnel Aktif

**Cek apakah port 27018 listening:**
```powershell
# Buka PowerShell baru (window 3)
netstat -an | findstr :27018
```

**Output yang benar:**
```
TCP    127.0.0.1:27018        0.0.0.0:0              LISTENING
```

**Jika tidak ada output:**
- Tunnel belum establish
- Atau SSH connection gagal

---

### 4. Test Koneksi MongoDB via Tunnel

**Jika punya mongosh (MongoDB Shell):**
```powershell
mongosh "mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin"
```

**Jika berhasil:**
```
Current Mongosh Log ID: ...
Connecting to: mongodb://127.0.0.1:27018/...
Using MongoDB: 6.2.6
```

**Jika gagal:**
- Tunnel tidak jalan
- Atau credentials salah

---

## 🎯 Solusi Step-by-Step

### Opsi 1: Manual dengan Delay

**Window 1 (SSH Tunnel):**
```powershell
cd backend
ssh -L 27018:localhost:27017 -N root@76.13.196.116
```
Masukkan password, **biarkan jalan**.

**Window 2 (Verifikasi):**
```powershell
# Tunggu 10 detik, lalu cek:
netstat -an | findstr :27018
```

Jika muncul `LISTENING`, lanjut ke window 3.

**Window 3 (Backend):**
```powershell
cd backend
npm start
```

---

### Opsi 2: Gunakan Script Auto

```powershell
cd backend
.\start-with-tunnel.ps1
```

Script ini akan:
1. Start tunnel di background
2. Tunggu 10 detik
3. Verifikasi tunnel aktif
4. Start backend

---

### Opsi 3: Cek Port MongoDB di VPS

Jika Opsi 1 & 2 gagal, kemungkinan MongoDB di VPS bukan di port 27017.

**Test dengan script diagnostic:**
```powershell
cd backend
.\tunnel-fix.ps1
```

Script akan test 2 kemungkinan:
- Test 1: MongoDB di VPS port 27017
- Test 2: MongoDB di VPS port 27018

---

## 🔍 Diagnostic Commands

### Cek SSH Connection
```powershell
ssh root@76.13.196.116 "echo 'SSH OK'"
```
Jika berhasil, akan print "SSH OK".

### Cek MongoDB di VPS
```powershell
ssh root@76.13.196.116 "systemctl status mongod"
```
Atau:
```powershell
ssh root@76.13.196.116 "ps aux | grep mongod"
```

### Cek Port MongoDB di VPS
```powershell
ssh root@76.13.196.116 "netstat -tulpn | grep mongod"
```
Akan tampilkan port MongoDB, contoh:
```
tcp  0  0  127.0.0.1:27017  0.0.0.0:*  LISTEN  1234/mongod
```

---

## 📋 Checklist Troubleshooting

- [ ] SSH tunnel berjalan (window 1 tidak error)
- [ ] Port 27018 listening (`netstat -an | findstr :27018`)
- [ ] Tunggu 10-15 detik setelah start tunnel
- [ ] Backend start di window terpisah
- [ ] Credentials di `.env` benar
- [ ] MongoDB di VPS berjalan
- [ ] Port MongoDB di VPS sesuai (27017 atau 27018)

---

## 💡 Tips

### Jika Masih Gagal

1. **Screenshot error lengkap** dari backend
2. **Jalankan diagnostic:**
   ```powershell
   # Cek port MongoDB di VPS
   ssh root@76.13.196.116 "netstat -tulpn | grep mongod"
   ```
3. **Kirim hasil ke saya** untuk troubleshooting lebih lanjut

### Alternative: Direct Connection (Temporary)

Jika SSH tunnel terus bermasalah, coba direct connection:

**Di VPS, allow remote connection:**
```bash
# Edit MongoDB config
sudo nano /etc/mongod.conf

# Ubah bindIp
net:
  bindIp: 0.0.0.0

# Restart
sudo systemctl restart mongod
```

**Update `.env`:**
```env
MONGODB_URI=mongodb://root:developerapptim1@76.13.196.116:27017/superkafe_v2?authSource=admin
```

⚠️ **WARNING:** Ini kurang aman! Gunakan hanya untuk testing.

---

## Need Help?

Jika masih error, berikan info:
1. Screenshot error backend
2. Output dari `netstat -an | findstr :27018`
3. Output dari `ssh root@76.13.196.116 "netstat -tulpn | grep mongod"`
