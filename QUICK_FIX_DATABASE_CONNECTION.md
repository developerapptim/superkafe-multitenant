# Quick Fix: Database Connection Issue

## Problem
Error 404 "Tenant tidak ditemukan atau tidak aktif" pada semua API endpoints.

## Root Cause
Backend `.env` file menggunakan database yang salah:
- ❌ Current: `MONGODB_URI=.../ superkafe_v2?authSource=admin`
- ✅ Correct: `MONGODB_URI=.../superkafe_main?authSource=admin`

## Architecture Clarification
SuperKafe menggunakan **Multi-Database Architecture**:

```
superkafe_main (Main DB)
├── tenants collection (metadata semua tenant)
└── users collection (user accounts)

superkafe_negoes (Tenant DB)
├── employees
├── menuitems
├── orders
└── ... (all tenant data)

superkafe_aldykafe (Tenant DB)
├── employees
├── menuitems
└── ...
```

## Solution

### Step 1: Update .env File
File: `backend/.env`

```env
# BEFORE (WRONG)
MONGODB_URI=mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin

# AFTER (CORRECT)
MONGODB_URI=mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_main?authSource=admin
```

### Step 2: Restart Backend Server
```bash
# Stop current server (Ctrl+C)

# Start backend
cd backend
npm start
```

### Step 3: Clear Browser Cache & Login Again
1. Open browser DevTools (F12)
2. Application tab → Clear storage
3. Or manually:
   ```javascript
   localStorage.clear();
   ```
4. Refresh page
5. Login again

### Step 4: Verify Fix
1. Check backend console for:
   ```
   [DB] MongoDB Main Database Connected: 127.0.0.1
   [TENANT] Resolved successfully { tenant: 'negoes', dbName: 'superkafe_negoes', ... }
   ```

2. Check browser console for:
   ```
   [API] Request headers: { x-tenant-slug: 'negoes', ... }
   ```

3. Menu should load successfully

## How It Works

### 1. Login Flow
```
User Login
  ↓
Backend connects to superkafe_main
  ↓
Find tenant in superkafe_main.tenants
  ↓
Find employee in superkafe_{slug}.employees
  ↓
Generate JWT with tenantSlug + tenantDbName
  ↓
Return token to frontend
```

### 2. API Request Flow
```
Frontend sends request with x-tenant-slug header
  ↓
Backend tenantResolver middleware
  ↓
Find tenant in superkafe_main.tenants
  ↓
Get tenant.dbName (e.g., "superkafe_negoes")
  ↓
Connect to tenant database
  ↓
Execute query on tenant DB
  ↓
Return data
```

## Verification Commands

### Check Main Database
```bash
node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_main?authSource=admin').then(async () => { const tenants = await mongoose.connection.db.collection('tenants').find().toArray(); console.log('Tenants:', tenants.map(t => t.slug)); process.exit(); });"
```

Expected output:
```
Tenants: [ 'warkop-pusat', 'zona-mapan', 'kenangan', 'sulkopi', 'negoes', 'aldykafe', 'suleee' ]
```

### Check Tenant Database
```bash
node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_negoes?authSource=admin').then(async () => { const collections = await mongoose.connection.db.listCollections().toArray(); console.log('Collections:', collections.map(c => c.name)); process.exit(); });"
```

Expected output:
```
Collections: [ 'employees', 'menuitems', 'categories', 'orders', ... ]
```

## Common Issues

### Issue 1: Still getting 404 after restart
**Solution**: 
- Clear browser localStorage
- Login again to get new JWT token
- Check backend logs for connection errors

### Issue 2: "Cannot connect to database"
**Solution**:
- Verify MongoDB is running
- Check credentials in .env
- Test connection with MongoDB Compass

### Issue 3: Wrong tenant data appears
**Solution**:
- Check JWT token contains correct tenantSlug
- Verify x-tenant-slug header is sent
- Check backend logs for tenant resolution

## Summary
Backend harus connect ke `superkafe_main` untuk mendapatkan metadata tenant, kemudian secara dinamis connect ke `superkafe_{slug}` untuk data tenant. JWT token membawa `tenantSlug` yang digunakan frontend untuk set header, dan `tenantDbName` yang digunakan backend untuk connect ke database tenant yang benar.
