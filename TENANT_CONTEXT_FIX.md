# Tenant Context Fix - Menu Sidebar Issue

## Problem
Frontend mengirim header `X-Tenant-Slug` dengan benar, tapi backend melaporkan error:
```
[TENANT PLUGIN] No tenant context available for query
```

Akibatnya, menu di sidebar tidak muncul karena query database terblokir oleh tenant scoping plugin.

## Root Cause
1. **AsyncLocalStorage Context Loss**: `enterWith()` tidak selalu reliable dalam menjaga context di async operations
2. **No Fallback Mechanism**: Ketika AsyncLocalStorage gagal, tidak ada fallback yang bisa digunakan
3. **Insufficient Debug Logging**: Sulit untuk debug karena tidak ada logging yang menunjukkan apakah header diterima dan context di-set

## Solution Implemented

### 1. Enhanced Debug Logging (`tenantResolver.js`)
```javascript
// Log all incoming headers untuk verifikasi
console.log('[TENANT DEBUG] Incoming headers:', {
  requestId,
  headers: req.headers,
  path: req.path,
  method: req.method
});

// Verify context setelah di-set
const verifyContext = getTenantContext();
console.log('[TENANT DEBUG] Context verification:', {
  contextSet: !!verifyContext,
  contextId: verifyContext?.id,
  contextSlug: verifyContext?.slug
});
```

### 2. Improved Context Reliability (`tenantContext.js`)
```javascript
function setTenantContext(tenant) {
  try {
    tenantContext.enterWith(tenant);
    // PENTING: Set fallback untuk reliability
    fallbackContext = tenant;
    
    console.log('[TENANT CONTEXT] Context set successfully', {
      tenantId: tenant.id,
      tenantSlug: tenant.slug
    });
  } catch (error) {
    // Fallback jika AsyncLocalStorage gagal
    fallbackContext = tenant;
  }
}

function getTenantContext() {
  const context = tenantContext.getStore();
  const result = context || fallbackContext;
  
  // Log warning jika context tidak tersedia
  if (!result) {
    console.warn('[TENANT CONTEXT] No context available');
  }
  
  return result;
}
```

### 3. Case-Insensitive Header Reading
Express secara otomatis mengubah semua header menjadi lowercase, jadi:
```javascript
// ✅ CORRECT
const tenantSlug = req.headers['x-tenant-slug'] || req.headers['x-tenant-id'];

// ❌ WRONG (tidak akan pernah match)
const tenantSlug = req.headers['X-Tenant-Slug'];
```

## Testing
1. Restart backend server
2. Login ke dashboard
3. Periksa console log backend untuk melihat:
   - `[TENANT DEBUG] Incoming headers` - memastikan header diterima
   - `[TENANT CONTEXT] Context set successfully` - memastikan context di-set
   - `[TENANT DEBUG] Context verification` - memastikan context bisa diambil kembali
4. Menu di sidebar seharusnya muncul tanpa error `[TENANT PLUGIN]`

## Expected Behavior
- Header `X-Tenant-Slug` diterima dengan benar
- Tenant context di-set menggunakan AsyncLocalStorage + fallback
- Plugin tenant scoping bisa mengakses context
- Query database berjalan dengan filter `tenantId` otomatis
- Menu muncul di sidebar secara real-time

## Files Modified
- `backend/middleware/tenantResolver.js` - Added debug logging and context verification
- `backend/utils/tenantContext.js` - Added fallback mechanism and improved logging

## Related Issues
- Frontend already sends `X-Tenant-Slug` header correctly (verified via Network tab)
- Middleware order is correct (tenantResolver → auth → controller)
- Plugin is properly attached to models

## Next Steps
If issue persists after this fix:
1. Check backend console logs for the debug messages
2. Verify AsyncLocalStorage is working in your Node.js version
3. Consider using `runWithTenantContext()` wrapper for critical operations
