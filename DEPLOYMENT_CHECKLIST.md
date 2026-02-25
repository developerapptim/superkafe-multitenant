# Setup Wizard Fix - Deployment Checklist

## Pre-Deployment Verification
- [x] Code changes reviewed
- [x] Tenant model updated (unique constraint removed)
- [x] Migration script created
- [x] Documentation updated
- [x] No syntax errors in modified files

## Deployment Steps

### 1. Backup Database (RECOMMENDED)
```bash
# Backup tenants collection before migration
mongodump --uri="mongodb://localhost:27017/superkafe_v2" --collection=tenants --out=backup_$(date +%Y%m%d)
```

### 2. Deploy Code Changes
```bash
# Pull latest code
git pull origin main

# Install dependencies (if needed)
cd backend
npm install

# Restart backend server
pm2 restart superkafe-backend
# OR
npm run start
```

### 3. Run Migration Script
```bash
# From backend directory
cd backend
node scripts/dropDbNameIndex.js
```

**Expected Output:**
```
[MIGRATION] Starting dbName index removal...
[MIGRATION] Connected to database: superkafe_v2
[MIGRATION] Found dbName unique index: dbName_1
[MIGRATION] ✅ Successfully dropped dbName unique index
[MIGRATION] Migration completed successfully
```

### 4. Verify Migration
```bash
# Connect to MongoDB and check indexes
mongo superkafe_v2
> db.tenants.getIndexes()

# Should NOT see dbName_1 unique index
```

### 5. Test Tenant Creation

#### Test 1: Create First Tenant
- [ ] Login dengan user baru
- [ ] Akses `/setup-cafe`
- [ ] Isi form: Nama Kafe, Slug, Admin Name
- [ ] Submit form
- [ ] Verify: Redirect ke dashboard
- [ ] Verify: No error 500
- [ ] Verify: Tenant created in database

#### Test 2: Create Second Tenant
- [ ] Logout
- [ ] Login dengan user baru lainnya
- [ ] Akses `/setup-cafe`
- [ ] Isi form dengan data berbeda
- [ ] Submit form
- [ ] Verify: Redirect ke dashboard
- [ ] Verify: No E11000 error
- [ ] Verify: Second tenant created successfully

#### Test 3: Verify Tenant Isolation
- [ ] Login sebagai tenant 1
- [ ] Check menu items (should only see tenant 1 data)
- [ ] Logout
- [ ] Login sebagai tenant 2
- [ ] Check menu items (should only see tenant 2 data)
- [ ] Verify: No cross-tenant data leakage

### 6. Monitor Logs
```bash
# Check backend logs for errors
tail -f backend/logs/combined.log

# Look for:
# - No E11000 errors
# - Successful tenant creation logs
# - No unexpected errors
```

### 7. Database Verification
```bash
# Connect to MongoDB
mongo superkafe_v2

# Check tenants collection
> db.tenants.find().pretty()

# Verify:
# - Multiple tenants exist
# - All have same dbName: "superkafe_v2"
# - Each has unique slug
# - All have correct status and trial dates
```

## Post-Deployment Verification

### Backend Health Check
- [ ] Server running without errors
- [ ] Database connection stable
- [ ] No memory leaks
- [ ] Response times normal

### Frontend Functionality
- [ ] Login works
- [ ] Registration works
- [ ] Setup wizard works
- [ ] Dashboard loads correctly
- [ ] Menu management works
- [ ] No console errors

### Database Integrity
- [ ] All tenants accessible
- [ ] Data isolation maintained
- [ ] No orphaned records
- [ ] Indexes optimized

## Rollback Plan (If Needed)

### If Migration Fails:
```bash
# Restore from backup
mongorestore --uri="mongodb://localhost:27017/superkafe_v2" --collection=tenants backup_YYYYMMDD/superkafe_v2/tenants.bson

# Revert code changes
git revert <commit-hash>

# Restart server
pm2 restart superkafe-backend
```

### If Tenant Creation Still Fails:
1. Check backend logs for specific error
2. Verify migration script ran successfully
3. Check MongoDB indexes: `db.tenants.getIndexes()`
4. Verify Tenant model has no unique constraint on dbName
5. Contact support with error logs

## Success Criteria
- [x] Migration script runs without errors
- [ ] dbName unique index removed from MongoDB
- [ ] First tenant creation successful
- [ ] Second tenant creation successful (no E11000 error)
- [ ] Both tenants can access their data
- [ ] No cross-tenant data leakage
- [ ] No error 500 on setup wizard
- [ ] Backend logs show no errors
- [ ] All existing tenants still functional

## Files Modified
1. `backend/models/Tenant.js` - Schema update
2. `backend/scripts/dropDbNameIndex.js` - Migration script
3. `.kiro/specs/setup-wizard-500-error-fix/bugfix.md` - Documentation
4. `SETUP_WIZARD_FIX_GUIDE.md` - Deployment guide
5. `FIX_SUMMARY.md` - Summary
6. `DEPLOYMENT_CHECKLIST.md` - This checklist

## Support Contacts
- Backend logs: `backend/logs/combined.log`
- Error logs: `backend/logs/error.log`
- MongoDB logs: Check MongoDB server logs
- Documentation: See `SETUP_WIZARD_FIX_GUIDE.md`

## Notes
- Migration is idempotent (safe to run multiple times)
- No downtime required for migration
- Existing tenants unaffected by changes
- All changes are backward compatible

---

**Deployment Date**: _________________
**Deployed By**: _________________
**Verified By**: _________________
**Status**: [ ] Success [ ] Failed [ ] Rolled Back
