# MongoDB Setup Guide untuk Windows

## Masalah
Backend gagal start karena MongoDB tidak berjalan:
```
MongoDB connection error: MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27018
```

## Solusi

### Opsi 1: Install MongoDB Community Edition (Recommended)

#### 1. Download MongoDB
- Kunjungi: https://www.mongodb.com/try/download/community
- Pilih versi: MongoDB Community Server (Latest)
- Platform: Windows
- Package: MSI

#### 2. Install MongoDB
```powershell
# Jalankan installer yang sudah didownload
# Pilih "Complete" installation
# Centang "Install MongoDB as a Service"
# Centang "Install MongoDB Compass" (GUI tool)
```

#### 3. Verifikasi Instalasi
```powershell
# Cek MongoDB service
Get-Service -Name MongoDB

# Cek MongoDB version
mongod --version
```

#### 4. Start MongoDB Service
```powershell
# Start service
Start-Service MongoDB

# Atau via Services.msc
# 1. Tekan Win + R
# 2. Ketik: services.msc
# 3. Cari "MongoDB Server"
# 4. Klik kanan > Start
```

#### 5. Update Backend .env
Setelah MongoDB berjalan, update file `backend/.env`:

```env
# Untuk MongoDB tanpa authentication (development)
MONGODB_URI=mongodb://127.0.0.1:27017/superkafe_v2

# Atau jika sudah setup authentication
MONGODB_URI=mongodb://root:developerapptim1@127.0.0.1:27017/superkafe_v2?authSource=admin
```

**Note:** Default MongoDB port adalah **27017**, bukan 27018.

#### 6. Setup MongoDB User (Optional tapi Recommended)
```javascript
// Buka MongoDB Shell
mongosh

// Switch ke admin database
use admin

// Create root user
db.createUser({
  user: "root",
  pwd: "developerapptim1",
  roles: ["root"]
})

// Exit
exit
```

---

### Opsi 2: Gunakan MongoDB Atlas (Cloud - Free Tier)

Jika tidak ingin install MongoDB lokal, gunakan MongoDB Atlas:

#### 1. Buat Account
- Kunjungi: https://www.mongodb.com/cloud/atlas/register
- Daftar gratis (Free Tier 512MB)

#### 2. Create Cluster
- Pilih "Shared" (Free)
- Pilih region terdekat (Singapore/Jakarta)
- Cluster Name: superkafe-dev

#### 3. Setup Database Access
- Database Access > Add New Database User
- Username: `superkafe_user`
- Password: (generate atau buat sendiri)
- Database User Privileges: Read and write to any database

#### 4. Setup Network Access
- Network Access > Add IP Address
- Pilih "Allow Access from Anywhere" (0.0.0.0/0)
- Atau tambahkan IP spesifik Anda

#### 5. Get Connection String
- Clusters > Connect > Connect your application
- Copy connection string, contoh:
```
mongodb+srv://superkafe_user:<password>@superkafe-dev.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

#### 6. Update Backend .env
```env
MONGODB_URI=mongodb+srv://superkafe_user:YOUR_PASSWORD@superkafe-dev.xxxxx.mongodb.net/superkafe_v2?retryWrites=true&w=majority
```

---

### Opsi 3: Gunakan Docker (Paling Mudah)

Jika sudah install Docker Desktop:

#### 1. Jalankan MongoDB Container
```powershell
# Pull dan run MongoDB
docker run -d `
  --name mongodb-superkafe `
  -p 27017:27017 `
  -e MONGO_INITDB_ROOT_USERNAME=root `
  -e MONGO_INITDB_ROOT_PASSWORD=developerapptim1 `
  -v mongodb_data:/data/db `
  mongo:latest
```

#### 2. Verifikasi Container
```powershell
docker ps
```

#### 3. Update Backend .env
```env
MONGODB_URI=mongodb://root:developerapptim1@127.0.0.1:27017/superkafe_v2?authSource=admin
```

#### 4. Stop/Start Container
```powershell
# Stop
docker stop mongodb-superkafe

# Start
docker start mongodb-superkafe

# Remove (jika ingin hapus)
docker rm -f mongodb-superkafe
```

---

## Quick Start (Setelah MongoDB Berjalan)

```powershell
# 1. Masuk ke folder backend
cd backend

# 2. Install dependencies (jika belum)
npm install

# 3. Start backend
npm start

# Atau dengan nodemon (auto-reload)
npm run dev
```

## Troubleshooting

### Error: Authentication Failed
```env
# Gunakan connection string tanpa auth untuk development
MONGODB_URI=mongodb://127.0.0.1:27017/superkafe_v2
```

### Error: Port 27017 Already in Use
```powershell
# Cek process yang menggunakan port
netstat -ano | findstr :27017

# Kill process (ganti PID dengan hasil di atas)
taskkill /PID <PID> /F
```

### Error: Cannot Connect to MongoDB
```powershell
# Cek MongoDB service status
Get-Service -Name MongoDB

# Restart service
Restart-Service MongoDB
```

## Verifikasi Backend Berjalan

Setelah backend start, Anda akan melihat:
```
✅ Server running on port 5001
✅ MongoDB connected successfully
✅ [DUITKU] Initialized in sandbox mode
✅ Static uploads folder: D:\...\backend\public\uploads
```

Buka browser: http://localhost:5001/api/health

## Next Steps

Setelah backend berjalan:
1. Seed data tenant pertama: `npm run seed:tenant`
2. Test API: http://localhost:5001/api/health
3. Start frontend: `cd ../frontend && npm run dev`

## Rekomendasi

Untuk development lokal, saya rekomendasikan:
- **Opsi 3 (Docker)** - Paling mudah, tidak perlu install MongoDB
- **Opsi 1 (Install Lokal)** - Jika ingin MongoDB permanen di sistem
- **Opsi 2 (Atlas)** - Jika tidak ingin install apapun, tapi butuh internet

Pilih yang paling sesuai dengan setup Anda!
