# JWT Token tenantSlug Fix - Summary

## Problem Statement
Frontend API interceptor mencari field `tenantSlug` di JWT token untuk set header `x-tenant-slug`, tetapi JWT token hanya memiliki field `tenant` tanpa `tenantSlug`. Ini menyebabkan header tidak terkirim dan backend tidak bisa resolve tenant.

## Root Cause
JWT token payload yang dibuat di backend controller hanya include field `tenant` (untuk backward compatibility) tetapi tidak include field `tenantSlug` yang dibutuhkan oleh frontend.

## Solution
Menambahkan field `tenantSlug` ke JWT token payload di semua controller yang membuat token untuk user yang sudah setup tenant.

## Files Modified

### 1. `backend/controllers/UnifiedAuthController.js`
**3 locations updated** (login, googleAuth, verifyOTP):

```javascript
// BEFORE
tokenPayload = {
  id: employee._id.toString(),
  email: employee.email,
  role: employee.role,
  tenant: tenant.slug,
  tenantId: tenant._id.toString(),
  tenantDbName: tenant.dbName,
  userId: user._id.toString()
};

// AFTER
tokenPayload = {
  id: employee._id.toString(),
  email: employee.email,
  role: employee.role,
  tenant: tenant.slug,
  tenantSlug: tenant.slug, // ADDED: For frontend header
  tenantId: tenant._id.toString(),
  tenantDbName: tenant.dbName,
  userId: user._id.toString()
};
```

### 2. `backend/controllers/SetupController.js`
**1 location updated** (setup completion):

```javascript
// BEFORE
const token = jwt.sign({
  id: adminUser.id,
  email: adminUser.email,
  role: adminUser.role,
  tenant: newTenant.slug,
  tenantId: newTenant._id.toString(),
  tenantDbName: dbName,
  userId: user._id
}, ...);

// AFTER
const token = jwt.sign({
  id: adminUser.id,
  email: adminUser.email,
  role: adminUser.role,
  tenant: newTenant.slug,
  tenantSlug: newTenant.slug, // ADDED: For frontend header
  tenantId: newTenant._id.toString(),
  tenantDbName: dbName,
  userId: user._id
}, ...);
```

### 3. `backend/controllers/TenantController.js`
**1 location updated** (Google auth tenant creation):

```javascript
// BEFORE
const token = jwt.sign({
  id: adminUser.id,
  email: adminUser.email,
  role: adminUser.role,
  tenant: slug.toLowerCase(),
  tenantDbName: dbName
}, ...);

// AFTER
const token = jwt.sign({
  id: adminUser.id,
  email: adminUser.email,
  role: adminUser.role,
  tenant: slug.toLowerCase(),
  tenantSlug: slug.toLowerCase(), // ADDED: For frontend header
  tenantDbName: dbName
}, ...);
```

### 4. `backend/.env`
**Database connection reverted**:

```env
# BEFORE (incorrect)
MONGODB_URI=mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_main?authSource=admin

# AFTER (correct)
MONGODB_URI=mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin
```

## JWT Token Structure

### Before Setup (No Tenant)
```json
{
  "userId": "673abc123...",
  "email": "user@example.com",
  "hasCompletedSetup": false,
  "tenantSlug": null
}
```

### After Setup (With Tenant) - NEW
```json
{
  "id": "673def456...",
  "email": "user@example.com",
  "role": "admin",
  "tenant": "negoes",
  "tenantSlug": "negoes",  // ✅ ADDED: Used by frontend
  "tenantId": "673ghi789...",
  "tenantDbName": "superkafe_v2",
  "userId": "673abc123..."
}
```

## Frontend API Interceptor Flow

### 1. Decode JWT Token
```javascript
// frontend/src/services/api.js
const token = localStorage.getItem('token');
const decoded = decodeJWT(token);
```

### 2. Extract tenantSlug
```javascript
// Priority order:
if (decoded.tenantSlug) {
  config.headers['x-tenant-slug'] = decoded.tenantSlug; // ✅ Primary
} else if (decoded.tenantId) {
  config.headers['x-tenant-id'] = decoded.tenantId; // Fallback
} else if (decoded.tenant) {
  config.headers['x-tenant-slug'] = decoded.tenant; // Legacy
}
```

### 3. Send Request with Header
```
GET /api/menu
Headers:
  Authorization: Bearer eyJhbGc...
  x-tenant-slug: negoes  // ✅ Set from JWT
  x-api-key: superkafemultitenant_testkey_...
```

## Backend Tenant Resolution Flow

### 1. Middleware Extracts Header
```javascript
// backend/middleware/tenantResolver.js
const tenantSlug = req.headers['x-tenant-slug'] || req.headers['x-tenant-id'];
```

### 2. Find Tenant in Database
```javascript
const tenant = await Tenant.findOne({ 
  slug: tenantSlug.toLowerCase(),
  isActive: true 
});
```

### 3. Set Tenant Context
```javascript
setTenantContext({ id: tenant._id, slug: tenant.slug });
req.tenant = { id: tenant._id, slug: tenant.slug };
```

### 4. Plugin Filters Data
```javascript
// Mongoose plugin automatically adds tenantId filter
MenuItem.find() 
// Becomes: MenuItem.find({ tenantId: tenant._id })
```

## Database Architecture

### Single Database: `superkafe_v2`
All tenant data in one database with `tenantId` field for isolation:

```
superkafe_v2
├── tenants (global)
│   ├── { slug: "negoes", isActive: true, ... }
│   └── { slug: "aldykafe", isActive: true, ... }
├── users (global)
│   └── { email: "user@example.com", tenantId: "...", ... }
├── employees (tenant-scoped)
│   ├── { tenantId: "negoes_id", email: "admin@negoes.com", ... }
│   └── { tenantId: "aldykafe_id", email: "admin@aldykafe.com", ... }
├── menuitems (tenant-scoped)
│   ├── { tenantId: "negoes_id", name: "Kopi Susu", ... }
│   └── { tenantId: "aldykafe_id", name: "Espresso", ... }
└── ... (all other collections with tenantId)
```

## Testing

### 1. Verify JWT Token
```javascript
// In browser console after login
const token = localStorage.getItem('token');
const decoded = JSON.parse(atob(token.split('.')[1]));
console.log('JWT Payload:', decoded);
// Should see: { ..., tenantSlug: "negoes", ... }
```

### 2. Verify API Header
```javascript
// In browser DevTools > Network tab
// Click any API request
// Check Request Headers:
// x-tenant-slug: negoes ✅
```

### 3. Verify Backend Logs
```bash
# Backend console should show:
[TENANT] Resolved successfully {
  tenant: 'negoes',
  dbName: 'superkafe_v2',
  path: '/menu',
  userId: '...'
}
```

### 4. Test Menu Loading
```bash
# Should return menu items for specific tenant only
GET /api/menu
Response: [
  { id: "menu_1", name: "Kopi Susu", tenantId: "negoes_id", ... }
]
```

## Rollback Plan (If Needed)

If issues occur, revert changes:

```bash
# 1. Revert JWT token changes
git checkout HEAD -- backend/controllers/UnifiedAuthController.js
git checkout HEAD -- backend/controllers/SetupController.js
git checkout HEAD -- backend/controllers/TenantController.js

# 2. Keep database as superkafe_v2 (don't change)

# 3. Update frontend to use 'tenant' field instead
# In frontend/src/services/api.js:
if (decoded.tenant) {
  config.headers['x-tenant-slug'] = decoded.tenant;
}
```

## Related Documentation
- `DATABASE_ARCHITECTURE.md` - Complete database architecture explanation
- `MULTITENANT_IMPLEMENTATION.md` - Multitenant system overview
- `backend/middleware/tenantResolver.js` - Tenant resolution logic
- `backend/plugins/tenantScopingPlugin.js` - Automatic tenant filtering
- `frontend/src/services/api.js` - API interceptor implementation

## Summary
JWT token sekarang include field `tenantSlug` yang digunakan frontend untuk set header `x-tenant-slug`. Backend menggunakan header ini untuk resolve tenant dan apply automatic filtering via Mongoose plugin. Database tetap menggunakan `superkafe_v2` dengan tenant isolation berbasis `tenantId` field.

## Next Steps
1. ✅ JWT token sudah include `tenantSlug`
2. ✅ Database connection sudah ke `superkafe_v2`
3. ✅ Frontend interceptor sudah extract `tenantSlug`
4. ✅ Backend middleware sudah resolve tenant
5. ✅ Plugin sudah apply automatic filtering
6. 🔄 **User perlu login ulang** untuk mendapatkan JWT token baru dengan `tenantSlug`
7. 🔄 **Restart backend server** untuk apply perubahan .env
