# Setup Wizard Fix - Quick Deployment Guide

## Problem
Setup wizard gagal dengan error 500 karena E11000 duplicate key error pada field `dbName` di Tenant model.

## Root Cause
Dalam Unified Nexus Architecture, semua tenant menggunakan database yang sama (`superkafe_v2`). Namun, Tenant model memiliki constraint `unique: true` pada field `dbName`, yang mencegah pembuatan tenant kedua karena semua tenant memiliki `dbName` yang sama.

## Solution
1. Remove `unique: true` constraint dari Tenant model
2. Drop existing unique index dari MongoDB collection

## Deployment Steps

### Step 1: Deploy Code Changes
Code sudah diupdate:
- ✅ `backend/models/Tenant.js` - Removed `unique: true` from dbName field
- ✅ `backend/scripts/dropDbNameIndex.js` - Migration script created

### Step 2: Run Migration Script
Setelah deploy code, jalankan migration script untuk drop index yang sudah ada:

```bash
# Pastikan di root directory project
cd backend

# Run migration script
node scripts/dropDbNameIndex.js
```

Expected output:
```
[MIGRATION] Starting dbName index removal...
[MIGRATION] Connected to database: superkafe_v2
[MIGRATION] Current indexes: [...]
[MIGRATION] Found dbName unique index: dbName_1
[MIGRATION] ✅ Successfully dropped dbName unique index
[MIGRATION] Updated indexes: [...]
[MIGRATION] Migration completed successfully
```

### Step 3: Verify Fix
1. Login sebagai user baru (atau user yang belum punya tenant)
2. Akses `/setup-cafe`
3. Isi form setup wizard
4. Submit form
5. Verify: Setup berhasil tanpa error 500
6. Verify: Tenant baru berhasil dibuat
7. Create tenant kedua untuk memastikan multiple tenants bisa coexist

### Step 4: Monitor Logs
Check backend logs untuk memastikan tidak ada E11000 errors:
```bash
# Check for E11000 errors
grep "E11000" backend/logs/*.log

# Should return nothing (no errors)
```

## Rollback (if needed)
Jika ada masalah, rollback dengan:
1. Restore previous Tenant model (add back `unique: true`)
2. Recreate unique index:
```javascript
db.tenants.createIndex({ dbName: 1 }, { unique: true })
```

## Testing Checklist
- [ ] Migration script runs successfully
- [ ] dbName unique index dropped
- [ ] First tenant creation works
- [ ] Second tenant creation works (no E11000 error)
- [ ] Both tenants can access their data
- [ ] No cross-tenant data leakage
- [ ] Setup wizard redirects correctly
- [ ] JWT token contains correct tenant info

## Files Changed
- `backend/models/Tenant.js` - Removed unique constraint
- `backend/scripts/dropDbNameIndex.js` - New migration script
- `.kiro/specs/setup-wizard-500-error-fix/bugfix.md` - Updated documentation

## Notes
- Migration script is idempotent (safe to run multiple times)
- If index doesn't exist, script will just log a message and exit successfully
- All existing tenants will continue to work normally
- This fix is required for Unified Nexus Architecture to work properly

## Support
If you encounter any issues:
1. Check backend logs for detailed error messages
2. Verify MongoDB connection is working
3. Ensure migration script completed successfully
4. Check that Tenant model was updated correctly
