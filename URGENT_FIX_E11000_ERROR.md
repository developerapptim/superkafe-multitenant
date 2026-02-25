# URGENT FIX: E11000 Duplicate Key Error

## Problem
Setup wizard gagal dengan error:
```
E11000 duplicate key error collection: superkafe_main.tenants index: dbName_1 dup key: { dbName: "superkafe_v2" }
```

## Root Causes Identified

### 1. Wrong Database in .env
`.env` file menggunakan database yang salah:
- ❌ **Current**: `MONGODB_URI=.../superkafe_negoes?authSource=admin`
- ✅ **Correct**: `MONGODB_URI=.../superkafe_v2?authSource=admin`

### 2. Unique Index Still Exists
Unique index `dbName_1` masih ada di MongoDB collection `tenants`, yang mencegah multiple tenants dengan `dbName` yang sama.

### 3. Multiple Databases with Same Index
Index mungkin ada di beberapa database:
- `superkafe_v2` (correct database)
- `superkafe_main` (old/incorrect)
- `superkafe_negoes` (old/incorrect)

## Solution Steps

### Step 1: Update .env File
✅ **ALREADY DONE** - `.env` sudah diupdate ke `superkafe_v2`

Verify:
```bash
cat backend/.env | grep MONGODB_URI
# Should show: MONGODB_URI=mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin
```

### Step 2: Restart Backend Server
```bash
# Stop backend
pm2 stop superkafe-backend
# OR
pkill -f "node.*server.js"

# Start backend
cd backend
npm start
# OR
pm2 start superkafe-backend
```

### Step 3: Drop Unique Index from All Databases
Run migration script yang akan check dan drop index dari semua database:

```bash
cd backend
node scripts/dropDbNameIndexAllDatabases.js
```

Expected output:
```
[MIGRATION] Starting dbName index removal from all databases...
[MIGRATION] Checking database: superkafe_v2
[MIGRATION] Found dbName unique index in superkafe_v2: dbName_1
[MIGRATION] ✅ Successfully dropped dbName unique index from superkafe_v2
[MIGRATION] Checking database: superkafe_main
[MIGRATION] Found dbName unique index in superkafe_main: dbName_1
[MIGRATION] ✅ Successfully dropped dbName unique index from superkafe_main
[MIGRATION] Checking database: superkafe_negoes
[MIGRATION] ℹ️  No dbName unique index in superkafe_negoes

[MIGRATION] ========== SUMMARY ==========
✅ superkafe_v2: dropped (dbName_1)
✅ superkafe_main: dropped (dbName_1)
ℹ️ superkafe_negoes: not_found

[MIGRATION] Migration completed
[MIGRATION] Indexes dropped: 2
[MIGRATION] Errors: 0
[MIGRATION] ✅ All databases processed successfully
```

### Step 4: Verify Index Removal
Connect to MongoDB and verify:

```bash
# Connect to MongoDB
mongo mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin

# Check indexes
> db.tenants.getIndexes()

# Should NOT see dbName_1 unique index
# Should only see:
# - _id_ (default)
# - slug_1 (unique, case-insensitive)
```

### Step 5: Test Tenant Creation

#### Test 1: Create First Tenant
1. Open browser: `https://superkafe.com/setup-cafe`
2. Login dengan user baru
3. Fill form:
   - Nama Kafe: `Test Kafe 1`
   - Slug: `testkafe1`
   - Admin Name: `Admin Test`
4. Click "Buat Kafe Saya"
5. ✅ Should redirect to dashboard without error

#### Test 2: Create Second Tenant
1. Logout
2. Login dengan user baru lainnya
3. Open: `https://superkafe.com/setup-cafe`
4. Fill form:
   - Nama Kafe: `Test Kafe 2`
   - Slug: `testkafe2`
   - Admin Name: `Admin Test 2`
5. Click "Buat Kafe Saya"
6. ✅ Should redirect to dashboard without E11000 error

### Step 6: Verify Database
```bash
mongo mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin

# Check tenants
> db.tenants.find().pretty()

# Should see both tenants:
# - testkafe1 with dbName: "superkafe_v2"
# - testkafe2 with dbName: "superkafe_v2"
```

## Verification Checklist

- [ ] `.env` file updated to use `superkafe_v2`
- [ ] Backend server restarted
- [ ] Migration script ran successfully
- [ ] No dbName_1 unique index in any database
- [ ] First tenant creation successful
- [ ] Second tenant creation successful (no E11000 error)
- [ ] Both tenants visible in database
- [ ] Both tenants have same dbName: "superkafe_v2"
- [ ] Each tenant has unique slug
- [ ] No cross-tenant data leakage

## Troubleshooting

### If Migration Script Fails
```bash
# Check MongoDB connection
mongo mongodb://root:developerapptim1@127.0.0.1:27018/admin

# List all databases
> show dbs

# Check if tenants collection exists
> use superkafe_v2
> show collections
> db.tenants.getIndexes()
```

### If Still Getting E11000 Error
1. Check backend logs for exact error message
2. Verify which database is mentioned in error
3. Manually drop index:
   ```bash
   mongo mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin
   > db.tenants.dropIndex("dbName_1")
   ```
4. Restart backend server
5. Try tenant creation again

### If Wrong Database Name in Error
If error shows `superkafe_main` or `superkafe_negoes`:
1. Backend might be caching old connection
2. Restart backend server completely
3. Check `.env` file is correct
4. Verify no other `.env` files in parent directories

## Files Modified

1. ✅ `backend/.env` - Updated MONGODB_URI to superkafe_v2
2. ✅ `backend/models/Tenant.js` - Removed unique constraint
3. ✅ `backend/scripts/dropDbNameIndexAllDatabases.js` - New migration script
4. ✅ `URGENT_FIX_E11000_ERROR.md` - This guide

## Summary

Masalah E11000 disebabkan oleh:
1. Database name salah di `.env` (superkafe_negoes → superkafe_v2)
2. Unique index masih ada di database
3. Tenant model memiliki unique constraint pada dbName

Solusi:
1. Update `.env` ke database yang benar
2. Drop unique index dari semua database
3. Restart backend server
4. Test tenant creation

Setelah fix ini, multiple tenants bisa dibuat tanpa error karena:
- Semua tenant menggunakan database yang sama (superkafe_v2)
- Tidak ada unique constraint pada dbName
- Tenant isolation via tenantId field, bukan separate databases
