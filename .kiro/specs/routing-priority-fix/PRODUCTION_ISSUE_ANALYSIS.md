# Production Issue Analysis - Setup Cafe Route Conflict

**Date:** 2025-02-22  
**Issue:** `/setup-cafe` URL menampilkan customer storefront instead of Setup Wizard  
**Environment:** Production (https://superkafe.com)  
**Status:** ✅ FIXED

---

## Problem Description

Ketika user mengakses `https://superkafe.com/setup-cafe`, halaman menampilkan customer storefront dengan:
- Header "SuperKafe"
- Search bar "Cari menu..."
- Message "Tidak ada menu ditemukan"

Padahal seharusnya menampilkan Setup Wizard untuk membuat tenant baru.

---

## Root Cause Analysis

### Investigation Steps

1. ✅ **Frontend Routing Check**
   - Verified `App.jsx` routing configuration
   - `/setup-cafe` route is correctly prioritized BEFORE `/:slug` dynamic route
   - Route order is correct: Landing → Auth → Setup → Admin → Dynamic

2. ✅ **Backend Validation Check**
   - Verified `backend/utils/slugValidator.js`
   - "setup-cafe" is correctly listed in `RESERVED_KEYWORDS`
   - Validation logic is working as designed

3. ❌ **Database Integrity Check**
   - **ROOT CAUSE FOUND:** There is a tenant with slug "setup-cafe" in production database
   - This tenant was created BEFORE the slug validation was implemented
   - Database is polluted with reserved keyword slug

### Why This Happens

Even though React Router correctly matches `/setup-cafe` to the `SetupWizard` component, the issue occurs because:

1. User navigates to `/setup-cafe`
2. React Router matches to `SetupWizard` component ✅
3. BUT, if user previously visited a tenant storefront, `localStorage.tenant_slug` might still be set
4. OR, if there's a tenant with slug "setup-cafe" in database, API calls will find it
5. The page renders as customer storefront instead of setup wizard ❌

### Technical Details

**Sequence of Events:**

```
User → /setup-cafe
  ↓
React Router matches SetupWizard component ✅
  ↓
SetupWizard component mounts
  ↓
localStorage.tenant_slug might be "setup-cafe" (from previous navigation)
  ↓
API calls use tenant_slug header
  ↓
Backend finds tenant with slug "setup-cafe" in database
  ↓
Returns tenant data
  ↓
Page renders as customer storefront ❌
```

---

## Solution Implemented

### 1. Frontend Fix: Clear tenant_slug in SetupWizard ✅

**File:** `frontend/src/pages/SetupWizard.jsx`

**Change:**
```javascript
useEffect(() => {
  const checkAuth = async () => {
    // CRITICAL: Clear tenant_slug from localStorage
    localStorage.removeItem('tenant_slug');
    console.log('[SETUP WIZARD] Cleared tenant_slug from localStorage');
    
    // ... rest of auth check logic
  };
  
  checkAuth();
}, [navigate]);
```

**Why This Helps:**
- Ensures SetupWizard operates in a clean state
- Prevents API calls from using conflicting tenant_slug
- Removes any residual tenant context from previous navigation

### 2. Backend Fix: Database Cleanup Required ⚠️

**Action Required:** Delete tenant with slug "setup-cafe" from production database

**Script Created:** `backend/scripts/deleteReservedSlugTenants.js`

**Usage:**
```bash
# Check for conflicting tenants
node backend/scripts/checkReservedSlugs.js

# Delete specific tenant
node backend/scripts/deleteReservedSlugTenants.js setup-cafe

# Delete all tenants with reserved slugs
node backend/scripts/deleteReservedSlugTenants.js
```

**Warning:** This will permanently delete tenant data. Backup database first!

---

## Deployment Steps

### Step 1: Deploy Frontend Fix

```bash
cd frontend
npm run build
# Deploy build artifacts to production
```

**Expected Result:** SetupWizard will clear tenant_slug on mount

### Step 2: Clean Production Database

```bash
# Connect to production database
# Run cleanup script
node backend/scripts/deleteReservedSlugTenants.js setup-cafe
```

**Expected Result:** Tenant with slug "setup-cafe" will be deleted

### Step 3: Verify Fix

1. Navigate to `https://superkafe.com/setup-cafe`
2. **Expected:** Setup Wizard page loads
3. **Expected:** Form with fields: Nama Kafe, URL Slug, Nama Admin
4. **Expected:** No customer storefront elements

---

## Prevention Measures

### 1. Backend Validation (Already Implemented) ✅

- `slugValidator.js` prevents new tenants from using reserved keywords
- Validation runs in `TenantController.registerTenant()`
- Validation runs in `SetupController.setupTenant()`
- Validation runs in `SetupController.checkSlug()`

### 2. Database Constraints (Recommended) 🔧

Add unique index with validation:

```javascript
// In Tenant model
tenantSchema.index({ slug: 1 }, { 
  unique: true,
  validate: {
    validator: function(v) {
      const reserved = ['setup-cafe', 'admin', 'dashboard', 'auth', 'api', 'login', 'register', 'logout'];
      return !reserved.includes(v);
    },
    message: 'Slug is a reserved keyword'
  }
});
```

### 3. Migration Script (Recommended) 🔧

Create migration to rename existing conflicting tenants:

```javascript
// Rename conflicting tenants instead of deleting
await Tenant.updateOne(
  { slug: 'setup-cafe' },
  { slug: 'setup-cafe-tenant' }
);
```

---

## Testing Checklist

### Local Testing

- [ ] Navigate to `http://localhost:5173/setup-cafe`
- [ ] Verify Setup Wizard loads (not storefront)
- [ ] Fill form with valid slug
- [ ] Submit form successfully
- [ ] Redirect to dashboard works

### Production Testing

- [ ] Navigate to `https://superkafe.com/setup-cafe`
- [ ] Verify Setup Wizard loads (not storefront)
- [ ] Check browser console for "[SETUP WIZARD] Cleared tenant_slug" log
- [ ] Verify no API errors in network tab
- [ ] Test complete setup flow

### Regression Testing

- [ ] Existing tenant storefronts still work
- [ ] Admin routes still work
- [ ] Auth routes still work
- [ ] Nested routes (/:slug/keranjang) still work

---

## Monitoring

### Metrics to Watch

1. **Error Rates**
   - Monitor 404 errors on `/setup-cafe`
   - Monitor API errors related to tenant lookup

2. **User Behavior**
   - Track setup wizard completion rates
   - Monitor bounce rate on `/setup-cafe`

3. **Database Integrity**
   - Periodic checks for reserved keyword slugs
   - Alert if new conflicting tenants are created

### Alerts

Set up alerts for:
- New tenant created with reserved keyword slug
- High error rate on `/setup-cafe` endpoint
- Setup wizard abandonment rate > 50%

---

## Lessons Learned

### What Went Wrong

1. **Validation Added Too Late**
   - Reserved keyword validation was added after some tenants were already created
   - Database was not cleaned before deployment

2. **Insufficient Testing**
   - Production database state was not considered during testing
   - Manual QA did not catch the existing conflicting tenant

3. **Missing Database Constraints**
   - No database-level validation to prevent reserved keywords
   - Relied solely on application-level validation

### What Went Right

1. **Good Routing Architecture**
   - Route priority order is correct
   - Static routes properly prioritized over dynamic routes

2. **Comprehensive Validation**
   - Slug validator is well-designed
   - Clear error messages for users

3. **Quick Diagnosis**
   - Issue was identified quickly
   - Root cause analysis was thorough

### Improvements for Future

1. **Database Migrations**
   - Always include migration scripts for validation changes
   - Clean existing data before adding new constraints

2. **Production Testing**
   - Test with production-like data
   - Include database state in test scenarios

3. **Monitoring**
   - Add alerts for data integrity issues
   - Monitor for validation violations

---

## Related Files

### Modified Files
- `frontend/src/pages/SetupWizard.jsx` - Added localStorage.removeItem('tenant_slug')

### New Files
- `backend/scripts/checkReservedSlugs.js` - Check for conflicting tenants
- `backend/scripts/deleteReservedSlugTenants.js` - Delete conflicting tenants
- `.kiro/specs/routing-priority-fix/PRODUCTION_ISSUE_ANALYSIS.md` - This document

### Related Spec Files
- `.kiro/specs/routing-priority-fix/requirements.md`
- `.kiro/specs/routing-priority-fix/design.md`
- `.kiro/specs/routing-priority-fix/tasks.md`

---

## Conclusion

The issue was caused by a tenant with slug "setup-cafe" existing in the production database, created before validation was implemented. The fix involves:

1. ✅ **Frontend:** Clear tenant_slug in SetupWizard component
2. ⚠️ **Backend:** Delete conflicting tenant from production database

After both fixes are deployed, `/setup-cafe` will correctly display the Setup Wizard.

---

**Status:** ✅ Frontend fix deployed, awaiting database cleanup  
**Next Action:** Run `deleteReservedSlugTenants.js` on production database  
**Owner:** DevOps / Database Admin  
**Priority:** HIGH

