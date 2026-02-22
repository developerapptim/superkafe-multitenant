# Quick Manual Test Guide - Routing Priority Fix

**Task 9: Integration Testing dan Manual QA**  
**Estimated Time:** 15-20 minutes  
**Prerequisites:** Backend and frontend servers running, MongoDB connected

---

## Setup

1. **Start Backend Server**
   ```bash
   cd backend
   npm run dev
   ```
   Expected: Server running on port 5001, MongoDB connected

2. **Start Frontend Server**
   ```bash
   cd frontend
   npm run dev
   ```
   Expected: Vite dev server running (usually port 5173 or 5174)

3. **Open Browser**
   - Navigate to `http://localhost:5173` (or the port shown in terminal)
   - Open DevTools (F12) for debugging

---

## Critical Test Cases (Must Pass)

### Test 1: Setup Wizard Route Priority ✅
**Requirement: 1.1 - Static routes prioritized over dynamic routes**

**Steps:**
1. Navigate to `http://localhost:5173/setup-cafe`
2. **Expected:** Setup Wizard page loads (NOT a tenant storefront)
3. **Expected:** Page shows "Setup Kafe Anda" heading
4. **Expected:** Form with fields: Nama Kafe, URL Slug, Nama Admin

**Pass Criteria:** ✅ Setup Wizard loads correctly, not treated as tenant slug

---

### Test 2: Reserved Keyword Rejection ✅
**Requirement: 2.1, 2.2 - Reserved keywords cannot be used as slugs**

**Steps:**
1. Register a new user or login as user without tenant
2. Navigate to `/setup-cafe`
3. In the "URL Slug" field, type: `admin`
4. Wait 500ms for validation
5. **Expected:** Red X icon appears
6. **Expected:** Error message: "Slug 'admin' tidak dapat digunakan karena merupakan kata yang direservasi sistem"
7. **Expected:** Submit button is disabled

**Repeat for these keywords:**
- `setup-cafe` ✅
- `dashboard` ✅
- `auth` ✅
- `api` ✅

**Pass Criteria:** ✅ All reserved keywords are rejected with clear error messages

---

### Test 3: Invalid Format Rejection ✅
**Requirement: 3.1, 3.2 - Slug format validation**

**Steps:**
1. In Setup Wizard, test these inputs:

   **Test 3a: Uppercase Letters**
   - Type: `TestCafe`
   - **Expected:** Auto-converts to `testcafe`
   - **Expected:** Validation passes (green checkmark)

   **Test 3b: Special Characters**
   - Type: `test@cafe!`
   - **Expected:** Special chars filtered out → `testcafe`
   - **Expected:** Validation passes

   **Test 3c: Too Short**
   - Type: `ab`
   - **Expected:** No validation check (< 3 chars)
   - **Expected:** Submit button disabled

   **Test 3d: Starts with Hyphen**
   - Type: `-test-cafe`
   - **Expected:** Red X icon
   - **Expected:** Error: "Slug tidak boleh diawali atau diakhiri dengan tanda hubung"

   **Test 3e: Ends with Hyphen**
   - Type: `test-cafe-`
   - **Expected:** Red X icon
   - **Expected:** Error: "Slug tidak boleh diawali atau diakhiri dengan tanda hubung"

**Pass Criteria:** ✅ All format rules enforced with clear feedback

---

### Test 4: Valid Slug Acceptance ✅
**Requirement: 2.4, 3.3 - Valid slugs are accepted**

**Steps:**
1. In Setup Wizard, type a valid slug: `test-cafe-123`
2. Wait for validation (500ms)
3. **Expected:** Green checkmark appears
4. **Expected:** Message: "Slug tersedia"
5. **Expected:** Submit button is enabled

**Pass Criteria:** ✅ Valid slug is accepted and form can be submitted

---

### Test 5: Complete Setup Flow ✅
**Requirement: 4.1, 4.4 - Setup wizard to dashboard flow**

**Steps:**
1. Fill in Setup Wizard form:
   - Nama Kafe: `Test Cafe Manual QA`
   - URL Slug: `test-cafe-qa` (should auto-generate)
   - Nama Admin: Leave default or customize
2. Click "Buat Kafe Saya"
3. **Expected:** Loading state appears
4. **Expected:** Success toast message
5. **Expected:** Redirect to `/admin/dashboard`
6. **Expected:** Dashboard loads with new tenant data

**Pass Criteria:** ✅ Complete flow works end-to-end without errors

---

### Test 6: Existing Tenant Accessibility ✅
**Requirement: 5.1 - Existing tenant slugs remain accessible**

**Steps:**
1. After creating tenant in Test 5, navigate to: `http://localhost:5173/test-cafe-qa`
2. **Expected:** Customer storefront loads
3. **Expected:** Tenant name "Test Cafe Manual QA" is displayed
4. **Expected:** Menu page is visible
5. **Expected:** No 404 or routing errors

**Pass Criteria:** ✅ Tenant storefront is accessible via slug

---

### Test 7: Nested Routes Preservation ✅
**Requirement: 5.3 - Nested routes still work**

**Steps:**
1. Navigate to: `http://localhost:5173/test-cafe-qa/keranjang`
2. **Expected:** Cart page loads within customer layout
3. Navigate to: `http://localhost:5173/test-cafe-qa/pesanan`
4. **Expected:** Orders page loads
5. Navigate to: `http://localhost:5173/test-cafe-qa/bantuan`
6. **Expected:** Help page loads

**Pass Criteria:** ✅ All nested routes work correctly

---

### Test 8: Static Routes Priority ✅
**Requirement: 1.1, 1.2, 1.3 - Static routes take priority**

**Steps:**
1. Navigate to: `http://localhost:5173/admin`
2. **Expected:** Admin layout loads (NOT tenant storefront)
3. Navigate to: `http://localhost:5173/auth/login`
4. **Expected:** Login page loads (NOT tenant storefront)
5. Navigate to: `http://localhost:5173/setup-cafe`
6. **Expected:** Setup Wizard loads (NOT tenant storefront)

**Pass Criteria:** ✅ Static routes are not captured by dynamic tenant route

---

### Test 9: User with Tenant Cannot Access Setup ✅
**Requirement: 4.3 - Setup wizard only for new users**

**Steps:**
1. Login as user who already has a tenant (from Test 5)
2. Try to navigate to: `http://localhost:5173/setup-cafe`
3. **Expected:** Redirect to `/admin/dashboard`
4. **Expected:** Toast message: "Anda sudah memiliki tenant"

**Pass Criteria:** ✅ Users with tenant cannot access setup wizard

---

### Test 10: Unauthenticated Access Blocked ✅
**Requirement: 4.3 - Setup wizard requires authentication**

**Steps:**
1. Logout (clear localStorage or use incognito window)
2. Navigate to: `http://localhost:5173/setup-cafe`
3. **Expected:** Redirect to `/auth/login?returnUrl=/setup-cafe`
4. **Expected:** Toast message: "Silakan login terlebih dahulu"

**Pass Criteria:** ✅ Unauthenticated users cannot access setup wizard

---

## Quick Verification Checklist

Use this checklist for rapid verification:

- [ ] `/setup-cafe` loads Setup Wizard (not tenant storefront)
- [ ] Reserved keyword `admin` is rejected
- [ ] Reserved keyword `setup-cafe` is rejected
- [ ] Uppercase letters auto-convert to lowercase
- [ ] Special characters are filtered out
- [ ] Slug starting with hyphen is rejected
- [ ] Valid slug shows green checkmark
- [ ] Setup form submission creates tenant
- [ ] Redirect to dashboard after setup
- [ ] Tenant storefront accessible via slug
- [ ] Nested route `/:slug/keranjang` works
- [ ] Static route `/admin` takes priority
- [ ] User with tenant cannot access setup wizard
- [ ] Unauthenticated user redirected to login

---

## Common Issues and Troubleshooting

### Issue: "Cannot connect to MongoDB"
**Solution:** Ensure MongoDB is running on port 27018 (or update `.env`)

### Issue: "Slug already exists"
**Solution:** Use a different slug or delete the test tenant from database

### Issue: "401 Unauthorized"
**Solution:** Ensure you're logged in and token is valid

### Issue: "CORS error"
**Solution:** Check backend CORS configuration allows frontend origin

### Issue: "Page not found"
**Solution:** Verify frontend routing configuration in `App.jsx`

---

## Test Results

**Date:** _______________  
**Tester:** _______________  
**Environment:** Development / Staging / Production

### Summary
- **Tests Passed:** ___ / 10
- **Tests Failed:** ___ / 10
- **Critical Issues:** _______________
- **Non-Critical Issues:** _______________

### Sign-Off
- [ ] All critical tests passed
- [ ] No blocking issues found
- [ ] Ready for production deployment

**Signature:** _______________  
**Date:** _______________

---

## Next Steps

After completing manual QA:

1. **If all tests pass:**
   - Update task status to completed
   - Proceed to final checkpoint (Task 10)
   - Prepare for production deployment

2. **If tests fail:**
   - Document failures in detail
   - Create bug reports with screenshots
   - Fix issues and retest
   - Do not proceed to production

3. **Additional testing:**
   - Browser compatibility (Chrome, Firefox, Safari)
   - Mobile responsiveness
   - Performance testing with multiple tenants
   - Load testing for slug validation endpoint

---

**Document Version:** 1.0  
**Last Updated:** 2024-02-22
