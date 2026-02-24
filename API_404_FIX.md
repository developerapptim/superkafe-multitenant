# 🔧 API 404 Error Fix - Missing Tenant Header

## 📋 Problem

API requests returning 404 errors for `/api/stats`, `/api/tables`, `/api/menu` endpoints:
```
GET https://superkafe.com/api/stats 404 (Not Found)
GET https://superkafe.com/api/tables 404 (Not Found)
GET https://superkafe.com/api/menu 404 (Not Found)
```

## 🔍 Root Cause

The backend routes require `x-tenant-slug` header for tenant resolution, but the JWT token in localStorage might not contain the `tenantSlug` field. This happens when:

1. User logged in before the `tenantSlug` field was added to JWT tokens
2. JWT token is outdated or corrupted
3. User hasn't completed setup wizard

## ✅ Quick Fix (User Action)

**LOGOUT AND LOGIN AGAIN**

1. Click logout button in the admin panel
2. Login again with your credentials
3. The new JWT token will include `tenantSlug` field
4. API requests will work correctly

## 🔧 Technical Details

### How It Works

1. **Frontend** (`frontend/src/services/api.js`):
   - Extracts `tenantSlug` from JWT token
   - Adds `x-tenant-slug` header to all API requests

2. **Backend** (`backend/middleware/tenantResolver.js`):
   - Reads `x-tenant-slug` header
   - Validates tenant exists and is active
   - Attaches tenant context to request

3. **JWT Token Structure** (after login):
```json
{
  "id": "employee_id",
  "email": "admin@negoes.com",
  "role": "admin",
  "tenant": "negoes",
  "tenantSlug": "negoes",  // ← This field is required!
  "tenantId": "tenant_object_id",
  "tenantDbName": "superkafe_v2",
  "userId": "user_object_id"
}
```

## 🛠️ Debug Tool

Open `frontend/debug-jwt.html` in your browser to inspect your JWT token:

```bash
# Navigate to:
http://localhost:5174/debug-jwt.html
```

This tool will show:
- Your current JWT token
- Decoded payload
- Headers that will be sent with API requests
- Whether `tenantSlug` is present

## 🔍 Manual Check (Browser Console)

```javascript
// Check your JWT token
const token = localStorage.getItem('token');
console.log('Token:', token);

// Decode it
function decodeJWT(token) {
    const parts = token.split('.');
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
}

const decoded = decodeJWT(token);
console.log('Decoded:', decoded);
console.log('Has tenantSlug?', !!decoded.tenantSlug);
```

## 🚨 If Logout Doesn't Work

Clear browser storage manually:

```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

Then login again.

## 📝 For Developers

### Ensure JWT Contains tenantSlug

Check `backend/controllers/UnifiedAuthController.js` login method:

```javascript
// JWT payload MUST include tenantSlug
const tokenPayload = {
  id: employee._id.toString(),
  email: employee.email,
  role: employee.role,
  tenant: tenant.slug,
  tenantSlug: tenant.slug, // ← CRITICAL for API requests
  tenantId: tenant._id.toString(),
  tenantDbName: tenant.dbName,
  userId: user._id.toString()
};
```

### Routes That Require Tenant Header

All these routes use `tenantResolver` middleware:
- `/api/menu` - Menu items
- `/api/tables` - Table management
- `/api/stats` - Dashboard statistics
- `/api/orders` - Orders
- `/api/inventory` - Inventory
- `/api/employees` - Employees
- `/api/attendance` - Attendance
- `/api/shifts` - Shifts
- And more...

### Routes That DON'T Require Tenant Header

- `/api/auth/*` - Authentication endpoints
- `/api/setup/*` - Setup wizard
- `/api/tenants/register` - Tenant registration

## ✅ Verification

After logging in again, check browser DevTools Network tab:

1. Open DevTools (F12)
2. Go to Network tab
3. Make an API request (refresh dashboard)
4. Click on any `/api/*` request
5. Check Request Headers
6. Verify `x-tenant-slug: negoes` is present

Example:
```
Request Headers:
  Authorization: Bearer eyJhbGc...
  x-api-key: warkop_secret_123
  x-tenant-slug: negoes  ← Should be present!
```

---

**Status**: ✅ SOLUTION IDENTIFIED
**Action Required**: User must logout and login again
**Date**: 2026-02-24
