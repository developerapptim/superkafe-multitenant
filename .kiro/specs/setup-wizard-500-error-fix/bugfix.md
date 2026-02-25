# Setup Wizard 500 Error Fix

## Problem
User mendapatkan error 500 saat submit form setup wizard:
```
POST https://superkafe.com/api/setup/tenant
500 (Internal Server Error)
```

Error message di console:
```
Setup error: AxiosError: Request failed with status code 500
{success: false, message: 'Terjadi kesalahan saat setup tenant'}
```

## Root Causes

### 1. Missing User ID Validation
Di `backend/controllers/SetupController.js` line 25:
```javascript
const userId = req.user.userId; // WRONG! Should be req.user.id
```

JWT middleware (`checkJwt`) menyimpan user ID di `req.user.id`, bukan `req.user.userId`.

### 2. Redundant Admin User Fetch
Code mencoba fetch admin user dua kali:
1. Create via `seedAdminUser()` 
2. Fetch again via `Employee.findOne().lean()`

Fetch kedua ini gagal karena:
- Timing issue (document belum ter-commit)
- Tenant context issue
- Unnecessary complexity

## Solutions

### 1. Fix User ID Access
```javascript
// Before
const userId = req.user.userId;

// After
const userId = req.user.id || req.user.userId; // Support both formats
```

### 2. Add User ID Validation
```javascript
if (!userId) {
  console.error('[SETUP ERROR] No user ID in JWT token', { user: req.user });
  return res.status(401).json({
    success: false,
    message: 'User ID tidak ditemukan. Silakan login kembali.'
  });
}
```

### 3. Use Admin User from Seeding Directly
```javascript
// Before: Fetch admin user again (redundant & error-prone)
const adminUser = await runWithTenantContext(..., async () => {
  return await Employee.findOne({ email: user.email }).lean();
});

// After: Use return value from runWithTenantContext
const adminUser = await runWithTenantContext(..., async () => {
  // ... seeding operations ...
  const createdAdmin = await seedAdminUser(...);
  // Return admin user directly
  return createdAdmin.toObject ? createdAdmin.toObject() : createdAdmin;
});
```

### 4. Enhanced Error Logging
```javascript
} catch (error) {
  const duration = Date.now() - startTime;
  
  console.error('[SETUP ERROR] Gagal setup tenant', {
    error: error.message,
    stack: error.stack,
    userId: req.user?.id || req.user?.userId,
    body: req.body,
    duration: `${duration}ms`
  });
  
  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan saat setup tenant',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}
```

## Files Modified
- `backend/controllers/SetupController.js`
  - Line 25: Fixed user ID access
  - Line 30-40: Added user ID validation
  - Line 90-180: Refactored admin user creation flow
  - Line 240-255: Enhanced error logging

## Testing Checklist
- [x] Login sebagai user baru (belum punya tenant)
- [x] Akses `/setup-cafe`
- [x] Isi form setup wizard dengan data valid
- [x] Submit form
- [x] Verify: Setup berhasil tanpa error 500
- [x] Verify: Admin user created correctly
- [x] Verify: JWT token contains tenant info
- [x] Verify: User diredirect ke dashboard tenant baru
- [x] Verify: Settings seeded correctly
- [x] Verify: Default menu seeded correctly

## Benefits
✅ No more 500 errors on setup
✅ Better error messages for debugging
✅ Cleaner code (removed redundant fetch)
✅ Faster setup (one less database query)
✅ More reliable (no timing issues)
✅ Better logging for troubleshooting

## Prevention Tips
1. Always validate JWT payload structure
2. Use optional chaining: `req.user?.id`
3. Avoid redundant database queries
4. Return values from async operations instead of re-fetching
5. Add comprehensive error logging
6. Test with actual JWT tokens from auth flow

## Related Issues
- JWT token structure inconsistency
- User ID field naming convention
- Tenant context propagation
- Admin user creation timing

## Impact
- ✅ Setup wizard now works correctly
- ✅ New tenants can be created successfully
- ✅ No more 500 errors
- ✅ Better error messages for debugging
- ✅ Improved code maintainability
