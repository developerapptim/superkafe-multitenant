# 🔥 Hotfix: tenantDB is not defined

## ❌ Error

```
ReferenceError: tenantDB is not defined
    at registerTenant (TenantController.js:328:29)
```

## 🔍 Root Cause

**Problem**: Variable `tenantDB` was declared with `const` inside a `try` block, making it inaccessible outside that scope.

**Location**: `backend/controllers/TenantController.js:131`

```javascript
// ❌ BEFORE (Wrong scope)
try {
  const tenantDB = await getTenantDB(dbName);  // Declared inside try block
  // ... seeding code ...
} catch (dbError) {
  // ... error handling ...
}

// Response section (outside try block)
if (isGoogleAuth) {
  const EmployeeModel = tenantDB.model(...);  // ❌ ERROR: tenantDB not defined
  // ...
}
```

**Why it failed**:
- `tenantDB` declared with `const` inside `try` block (line 131)
- Variable scope limited to that `try` block only
- Code at line 328 (outside the `try` block) tried to access `tenantDB`
- Result: `ReferenceError: tenantDB is not defined`

## ✅ Solution

**Change**: Declare `tenantDB` with `let` in outer scope before the `try` block.

```javascript
// ✅ AFTER (Correct scope)
let tenantDB; // Declare in outer scope

try {
  tenantDB = await getTenantDB(dbName);  // Assign value inside try block
  // ... seeding code ...
} catch (dbError) {
  // ... error handling ...
}

// Response section (outside try block)
if (isGoogleAuth) {
  const EmployeeModel = tenantDB.model(...);  // ✅ OK: tenantDB accessible
  // ...
}
```

## 📝 Code Change

**File**: `backend/controllers/TenantController.js`

**Line 130-131**:

```diff
    // Inisialisasi database tenant dan seeding data awal
+   let tenantDB; // Deklarasi di scope luar agar accessible di response
+   
    try {
-     const tenantDB = await getTenantDB(dbName);
+     tenantDB = await getTenantDB(dbName);
```

## 🧪 Testing

### Before Fix

```bash
# Test Google registration
curl -X POST http://localhost:5001/api/tenants/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Cafe",
    "slug": "test-cafe",
    "email": "test@gmail.com",
    "authProvider": "google",
    "googleId": "123456",
    "adminName": "Test User"
  }'

# Response:
# ❌ 500 Internal Server Error
# ReferenceError: tenantDB is not defined
```

### After Fix

```bash
# Test Google registration
curl -X POST http://localhost:5001/api/tenants/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Cafe",
    "slug": "test-cafe",
    "email": "test@gmail.com",
    "authProvider": "google",
    "googleId": "123456",
    "googlePicture": "https://...",
    "adminName": "Test User",
    "password": null
  }'

# Response:
# ✅ 201 Created
# {
#   "success": true,
#   "message": "Tenant berhasil didaftarkan dengan Google. Selamat datang!",
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": { ... },
#   "data": { ... }
# }
```

## 🎯 Impact

**Before**:
- ❌ Google registration always failed with 500 error
- ❌ Database created but response failed
- ❌ User couldn't login (no token returned)

**After**:
- ✅ Google registration succeeds
- ✅ JWT token generated and returned
- ✅ User can login immediately
- ✅ Database properly initialized

## 📊 Verification

### Check Logs

```bash
# Backend logs should show:
docker logs superkafe-backend | tail -20

# Expected output:
[TENANT] Tenant baru berhasil dibuat dengan trial 10 hari
[TENANT] Settings berhasil di-seed
[TENANT] Admin user created with Google auth (no OTP needed)
[TENANT] Database tenant berhasil diinisialisasi
# ✅ No error about tenantDB
```

### Check Database

```bash
# Connect to MongoDB
mongo superkafe_test_cafe

# Check employee collection
db.employees.findOne({ authProvider: "google" })

# Expected:
# {
#   id: "EMP-...",
#   email: "test@gmail.com",
#   name: "Test User",
#   googleId: "123456",
#   authProvider: "google",
#   isVerified: true,
#   password: null
# }
```

## 🚀 Deployment

```bash
# 1. Restart backend
docker-compose restart backend

# 2. Test registration
# Open: https://superkafe.com/auth/register
# Fill "Alamat Link": "my-cafe"
# Click "Daftar dengan Google"
# ✅ Should succeed and redirect to dashboard
```

## ✅ Status

- **Issue**: ReferenceError: tenantDB is not defined
- **Root Cause**: Variable scope issue
- **Fix**: Declare `tenantDB` with `let` in outer scope
- **Status**: ✅ FIXED
- **Tested**: ✅ Yes
- **Deployed**: Ready for deployment

---

**Fixed by**: Kiro Dev
**Date**: 2024
**File**: `backend/controllers/TenantController.js`
**Lines Changed**: 130-131
