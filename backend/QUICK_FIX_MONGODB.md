# Quick Fix: MongoDB Connection Error

## Masalah Anda
```
❌ MongoDB connection error: connect ECONNREFUSED 127.0.0.1:27018
```

## Penyebab
MongoDB tidak berjalan di sistem Anda.

## Solusi Tercepat

### 🚀 Opsi 1: Gunakan MongoDB Atlas (Cloud - GRATIS, 5 menit setup)

**Paling mudah, tidak perlu install apapun!**

1. **Buat Account MongoDB Atlas**
   - Buka: https://www.mongodb.com/cloud/atlas/register
   - Daftar dengan Google/Email (GRATIS)

2. **Create Free Cluster**
   - Pilih "Shared" (Free tier - 512MB)
   - Region: Singapore atau Jakarta
   - Klik "Create Cluster" (tunggu 3-5 menit)

3. **Setup Database User**
   - Klik "Database Access" (sidebar kiri)
   - "Add New Database User"
   - Username: `superkafe_admin`
   - Password: `superkafe123` (atau buat sendiri)
   - Role: "Atlas admin"
   - Klik "Add User"

4. **Setup Network Access**
   - Klik "Network Access" (sidebar kiri)
   - "Add IP Address"
   - Klik "Allow Access from Anywhere"
   - Klik "Confirm"

5. **Get Connection String**
   - Klik "Database" (sidebar kiri)
   - Klik tombol "Connect" pada cluster Anda
   - Pilih "Connect your application"
   - Copy connection string, contoh:
   ```
   mongodb+srv://superkafe_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

6. **Update File `.env` di Backend**
   ```env
   # Ganti baris MONGODB_URI dengan:
   MONGODB_URI=mongodb+srv://superkafe_admin:superkafe123@cluster0.xxxxx.mongodb.net/superkafe_v2?retryWrites=true&w=majority
   ```
   
   **PENTING:** Ganti `<password>` dengan password yang Anda buat, dan `cluster0.xxxxx` dengan cluster URL Anda!

7. **Start Backend**
   ```powershell
   cd backend
   npm start
   ```

✅ **Done!** Backend akan connect ke MongoDB Atlas.

---

### 🐳 Opsi 2: Install Docker Desktop (10 menit)

**Jika ingin MongoDB lokal tanpa install MongoDB langsung**

1. **Download Docker Desktop**
   - https://www.docker.com/products/docker-desktop/
   - Install dan restart komputer

2. **Jalankan MongoDB Container**
   ```powershell
   docker run -d --name mongodb-superkafe -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=root -e MONGO_INITDB_ROOT_PASSWORD=developerapptim1 mongo:latest
   ```

3. **Update `.env`**
   ```env
   MONGODB_URI=mongodb://root:developerapptim1@127.0.0.1:27017/superkafe_v2?authSource=admin
   ```

4. **Start Backend**
   ```powershell
   cd backend
   npm start
   ```

---

### 💻 Opsi 3: Install MongoDB Community (20 menit)

**Jika ingin MongoDB permanen di sistem**

1. **Download MongoDB**
   - https://www.mongodb.com/try/download/community
   - Pilih Windows, MSI package

2. **Install**
   - Jalankan installer
   - Pilih "Complete"
   - Centang "Install MongoDB as a Service"
   - Centang "Install MongoDB Compass"

3. **Start MongoDB Service**
   ```powershell
   # Via PowerShell (Run as Administrator)
   Start-Service MongoDB
   
   # Atau via GUI:
   # Win + R > services.msc > Cari "MongoDB Server" > Start
   ```

4. **Update `.env`**
   ```env
   # Untuk development tanpa auth
   MONGODB_URI=mongodb://127.0.0.1:27017/superkafe_v2
   
   # Atau dengan auth (setelah setup user)
   MONGODB_URI=mongodb://root:developerapptim1@127.0.0.1:27017/superkafe_v2?authSource=admin
   ```

5. **Start Backend**
   ```powershell
   cd backend
   npm start
   ```

---

## Rekomendasi

| Opsi | Kecepatan | Kemudahan | Cocok Untuk |
|------|-----------|-----------|-------------|
| **MongoDB Atlas** | ⚡ 5 menit | ⭐⭐⭐⭐⭐ | Testing cepat, tidak mau install |
| **Docker** | ⚡ 10 menit | ⭐⭐⭐⭐ | Development, sudah familiar Docker |
| **Install Lokal** | 🐢 20 menit | ⭐⭐⭐ | Production-like, MongoDB permanen |

**Saran saya: Gunakan MongoDB Atlas dulu untuk testing cepat!**

---

## Verifikasi Backend Berhasil

Setelah backend start, Anda akan melihat:
```
✅ Server running on port 5001
✅ MongoDB connected successfully
✅ [DUITKU] Initialized in sandbox mode
```

Test di browser: http://localhost:5001/api/health

---

## Troubleshooting

### Error: "Bad auth: Authentication failed"
```env
# Pastikan username/password benar di connection string
# Atau gunakan tanpa auth untuk development:
MONGODB_URI=mongodb://127.0.0.1:27017/superkafe_v2
```

### Error: "Network timeout"
- Cek internet connection (untuk Atlas)
- Cek firewall/antivirus
- Pastikan IP sudah di-whitelist di Atlas

### Error: "Port 27017 already in use"
```powershell
# Cek process yang pakai port
netstat -ano | findstr :27017

# Kill process (ganti <PID>)
taskkill /PID <PID> /F
```

---

## Need Help?

Jika masih error, screenshot error message dan tanyakan ke saya!
