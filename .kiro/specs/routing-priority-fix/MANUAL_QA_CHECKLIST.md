# Manual QA Checklist - Routing Priority Fix

**Task 9: Integration Testing dan Manual QA**  
**Date:** $(date)  
**Requirements:** 1.4, 2.1, 3.1, 4.1, 4.4, 5.1, 5.3

## Overview

This document provides a comprehensive manual QA checklist for testing the routing priority fix implementation. Each test case maps to specific requirements and should be verified in a development or staging environment.

---

## Test Environment Setup

### Prerequisites
- [ ] Backend server running (`npm run dev` in backend/)
- [ ] Frontend server running (`npm run dev` in frontend/)
- [ ] Database accessible and seeded with test data
- [ ] Browser DevTools open for debugging
- [ ] Test user accounts prepared:
  - [ ] New user without tenant (for registration flow)
  - [ ] Existing user with tenant (for backward compatibility)
  - [ ] Google OAuth test account

---

## Flow 1: Register → Setup Wizard → Dashboard

### Test Case 1.1: Email Registration Flow
**Requirements: 4.1, 4.4**

- [ ] Navigate to `/auth/register`
- [ ] Fill in registration form:
  - Name: "Test User"
  - Email: "test@example.com"
  - Password: "password123"
  - Confirm Password: "password123"
- [ ] Click "Daftar Sekarang"
- [ ] **Expected:** Redirect to `/auth/verify-otp`
- [ ] Enter OTP code from email
- [ ] **Expected:** After verification, redirect to `/setup-cafe`

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 1.2: Setup Wizard Access (New User)
**Requirements: 4.1, 4.2**

- [ ] As authenticated user without tenant, navigate to `/setup-cafe`
- [ ] **Expected:** Setup Wizard page loads successfully
- [ ] **Expected:** Form shows fields:
  - Nama Kafe (required)
  - URL Slug (required, with real-time validation)
  - Nama Admin (optional, pre-filled with user name)

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 1.3: Setup Wizard Form Submission
**Requirements: 4.4**

- [ ] Fill in setup form:
  - Nama Kafe: "Test Cafe"
  - URL Slug: "test-cafe" (auto-generated, should show green checkmark)
  - Nama Admin: Leave default or customize
- [ ] **Expected:** Slug availability check shows "Slug tersedia" in green
- [ ] Click "Buat Kafe Saya"
- [ ] **Expected:** Success toast message appears
- [ ] **Expected:** Redirect to `/admin/dashboard`
- [ ] **Expected:** Dashboard loads with new tenant data

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

## Flow 2: Google OAuth → Setup Wizard → Dashboard

### Test Case 2.1: Google OAuth Registration (New User)
**Requirements: 4.1**

- [ ] Navigate to `/auth/register`
- [ ] Click "Daftar dengan Google" button
- [ ] **Expected:** Google OAuth popup appears
- [ ] Select Google account (use test account)
- [ ] **Expected:** After OAuth success, redirect to `/setup-cafe`
- [ ] **Expected:** Setup Wizard loads with Google user name pre-filled

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 2.2: Google OAuth Login (Existing User with Tenant)
**Requirements: 4.3**

- [ ] Navigate to `/auth/login`
- [ ] Click "Masuk dengan Google" button
- [ ] Select Google account (existing user with tenant)
- [ ] **Expected:** After OAuth success, redirect to `/admin/dashboard`
- [ ] **Expected:** Dashboard loads with existing tenant data
- [ ] **Expected:** Does NOT redirect to `/setup-cafe`

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

## Reserved Keyword Rejection in UI

### Test Case 3.1: Reserved Keyword "admin"
**Requirements: 2.1, 2.2**

- [ ] Navigate to `/setup-cafe` as authenticated user without tenant
- [ ] In URL Slug field, type: "admin"
- [ ] Wait for debounced validation (500ms)
- [ ] **Expected:** Red X icon appears
- [ ] **Expected:** Error message: "Slug 'admin' tidak dapat digunakan karena merupakan kata yang direservasi sistem"
- [ ] **Expected:** Submit button is disabled

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 3.2: Reserved Keyword "setup-cafe"
**Requirements: 2.1, 2.2**

- [ ] In URL Slug field, type: "setup-cafe"
- [ ] Wait for validation
- [ ] **Expected:** Red X icon appears
- [ ] **Expected:** Error message contains "direservasi sistem"
- [ ] **Expected:** Submit button is disabled

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 3.3: Reserved Keyword "dashboard"
**Requirements: 2.1, 2.2**

- [ ] In URL Slug field, type: "dashboard"
- [ ] Wait for validation
- [ ] **Expected:** Red X icon appears
- [ ] **Expected:** Error message contains "direservasi sistem"
- [ ] **Expected:** Submit button is disabled

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 3.4: Reserved Keyword "auth"
**Requirements: 2.1, 2.2**

- [ ] In URL Slug field, type: "auth"
- [ ] Wait for validation
- [ ] **Expected:** Red X icon appears
- [ ] **Expected:** Error message contains "direservasi sistem"
- [ ] **Expected:** Submit button is disabled

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 3.5: Reserved Keyword "api"
**Requirements: 2.1, 2.2**

- [ ] In URL Slug field, type: "api"
- [ ] Wait for validation
- [ ] **Expected:** Red X icon appears
- [ ] **Expected:** Error message contains "direservasi sistem"
- [ ] **Expected:** Submit button is disabled

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

## Invalid Format Rejection in UI

### Test Case 4.1: Uppercase Letters
**Requirements: 3.1, 3.2**

- [ ] In URL Slug field, type: "TestCafe"
- [ ] **Expected:** Input automatically converts to lowercase: "testcafe"
- [ ] **Expected:** Validation passes (green checkmark)

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 4.2: Special Characters
**Requirements: 3.1, 3.2**

- [ ] In URL Slug field, type: "test@cafe!"
- [ ] **Expected:** Special characters are filtered out: "testcafe"
- [ ] **Expected:** Validation passes (green checkmark)

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 4.3: Slug Too Short (< 3 characters)
**Requirements: 3.1, 3.2**

- [ ] In URL Slug field, type: "ab"
- [ ] **Expected:** No validation check triggered (< 3 chars)
- [ ] **Expected:** Submit button remains disabled
- [ ] Try to submit form
- [ ] **Expected:** Browser validation or error message: "Slug minimal 3 karakter"

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 4.4: Slug Too Long (> 50 characters)
**Requirements: 3.1, 3.2**

- [ ] In URL Slug field, type: "a" repeated 51 times
- [ ] **Expected:** Input is truncated to 50 characters
- [ ] **Expected:** Validation check runs
- [ ] **Expected:** If valid format, shows green checkmark

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 4.5: Slug Starting with Hyphen
**Requirements: 3.1, 3.2**

- [ ] In URL Slug field, type: "-test-cafe"
- [ ] Wait for validation
- [ ] **Expected:** Red X icon appears
- [ ] **Expected:** Error message: "Slug tidak boleh diawali atau diakhiri dengan tanda hubung"
- [ ] **Expected:** Submit button is disabled

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 4.6: Slug Ending with Hyphen
**Requirements: 3.1, 3.2**

- [ ] In URL Slug field, type: "test-cafe-"
- [ ] Wait for validation
- [ ] **Expected:** Red X icon appears
- [ ] **Expected:** Error message: "Slug tidak boleh diawali atau diakhiri dengan tanda hubung"
- [ ] **Expected:** Submit button is disabled

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

## Existing Tenant Slug Accessibility

### Test Case 5.1: Access Existing Tenant Storefront
**Requirements: 5.1**

- [ ] Create a tenant with slug "warkop-jaya" (if not exists)
- [ ] In browser, navigate to: `http://localhost:5173/warkop-jaya`
- [ ] **Expected:** Customer storefront loads successfully
- [ ] **Expected:** Tenant name "Warkop Jaya" is displayed
- [ ] **Expected:** Menu items are visible
- [ ] **Expected:** No 404 or routing errors

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 5.2: Access Multiple Existing Tenants
**Requirements: 5.1**

Test with multiple existing tenant slugs:
- [ ] Navigate to `/kafe-123` - **Expected:** Loads correctly
- [ ] Navigate to `/my-coffee-shop` - **Expected:** Loads correctly
- [ ] Navigate to `/cafe-corner` - **Expected:** Loads correctly
- [ ] Navigate to `/kopi-kenangan` - **Expected:** Loads correctly

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 5.3: Invalid Tenant Slug
**Requirements: 5.1**

- [ ] Navigate to `/non-existent-slug-12345`
- [ ] **Expected:** Error message or redirect to landing page
- [ ] **Expected:** Does NOT crash or show blank page

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

## Nested Routes Functionality

### Test Case 6.1: Nested Route /:slug/keranjang
**Requirements: 5.3**

- [ ] Navigate to `/warkop-jaya/keranjang`
- [ ] **Expected:** Customer layout loads
- [ ] **Expected:** Keranjang (cart) page is displayed
- [ ] **Expected:** URL remains `/warkop-jaya/keranjang`
- [ ] **Expected:** Navigation works correctly

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 6.2: Nested Route /:slug/pesanan
**Requirements: 5.3**

- [ ] Navigate to `/warkop-jaya/pesanan`
- [ ] **Expected:** Customer layout loads
- [ ] **Expected:** Pesanan Saya (orders) page is displayed
- [ ] **Expected:** URL remains `/warkop-jaya/pesanan`
- [ ] **Expected:** Navigation works correctly

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 6.3: Nested Route /:slug/bantuan
**Requirements: 5.3**

- [ ] Navigate to `/warkop-jaya/bantuan`
- [ ] **Expected:** Customer layout loads
- [ ] **Expected:** Bantuan (help) page is displayed
- [ ] **Expected:** URL remains `/warkop-jaya/bantuan`
- [ ] **Expected:** Navigation works correctly

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

## Backward Compatibility

### Test Case 7.1: Static Routes Take Priority
**Requirements: 1.1, 1.2, 1.3**

- [ ] Navigate to `/setup-cafe`
- [ ] **Expected:** Setup Wizard loads (NOT tenant storefront)
- [ ] Navigate to `/admin`
- [ ] **Expected:** Admin layout loads (NOT tenant storefront)
- [ ] Navigate to `/auth/login`
- [ ] **Expected:** Login page loads (NOT tenant storefront)

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 7.2: Existing Tenant Data Integrity
**Requirements: 5.1**

- [ ] Query database for existing tenants
- [ ] Verify all existing tenant slugs are still valid
- [ ] **Expected:** No tenant slugs conflict with reserved keywords
- [ ] **Expected:** All tenant slugs match format: `^[a-z0-9-]+$`
- [ ] **Expected:** No tenant slugs start or end with hyphen

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 7.3: Existing User Flows Unaffected
**Requirements: 5.1**

- [ ] Login as existing user with tenant
- [ ] **Expected:** Redirect to `/admin/dashboard` (not `/setup-cafe`)
- [ ] Navigate to tenant storefront
- [ ] **Expected:** Storefront loads correctly
- [ ] Test admin features (menu, kasir, etc.)
- [ ] **Expected:** All features work as before

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

## Edge Cases and Error Handling

### Test Case 8.1: Unauthenticated Access to Setup Wizard
**Requirements: 4.3**

- [ ] Logout (clear localStorage)
- [ ] Navigate to `/setup-cafe`
- [ ] **Expected:** Redirect to `/auth/login?returnUrl=/setup-cafe`
- [ ] **Expected:** Toast message: "Silakan login terlebih dahulu"

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 8.2: User with Tenant Accessing Setup Wizard
**Requirements: 4.3**

- [ ] Login as user with existing tenant
- [ ] Navigate to `/setup-cafe`
- [ ] **Expected:** Redirect to `/admin/dashboard`
- [ ] **Expected:** Toast message: "Anda sudah memiliki tenant"

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 8.3: Network Error During Slug Check
**Requirements: 4.4**

- [ ] Open DevTools Network tab
- [ ] Throttle network to "Slow 3G"
- [ ] In setup wizard, type slug: "test-cafe-network"
- [ ] **Expected:** Loading spinner appears during check
- [ ] **Expected:** If timeout, shows error message
- [ ] **Expected:** User can retry

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 8.4: Duplicate Slug Submission
**Requirements: 2.1**

- [ ] Create tenant with slug "duplicate-test"
- [ ] Logout and register new user
- [ ] In setup wizard, try to use slug "duplicate-test"
- [ ] **Expected:** Slug check shows "Slug sudah digunakan"
- [ ] **Expected:** Submit button is disabled
- [ ] Try to submit anyway (if possible)
- [ ] **Expected:** Backend returns 409 error
- [ ] **Expected:** Error toast: "Slug sudah digunakan, silakan pilih slug lain"

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

## Performance and UX

### Test Case 9.1: Slug Auto-Generation
**Requirements: 4.4**

- [ ] In setup wizard, type Nama Kafe: "Warkop Kopi Kenangan"
- [ ] **Expected:** Slug auto-generates to: "warkop-kopi-kenangan"
- [ ] **Expected:** Slug check triggers automatically after 500ms
- [ ] **Expected:** Green checkmark appears if available

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 9.2: Real-Time Validation Feedback
**Requirements: 4.4**

- [ ] Type various slugs and observe feedback:
  - Valid slug: Green checkmark + "Slug tersedia"
  - Invalid slug: Red X + specific error message
  - Checking: Loading spinner
- [ ] **Expected:** Feedback is immediate and clear
- [ ] **Expected:** No lag or UI freezing

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 9.3: Form Validation States
**Requirements: 4.4**

- [ ] Submit button should be disabled when:
  - [ ] Nama Kafe is empty
  - [ ] Slug is empty
  - [ ] Slug is < 3 characters
  - [ ] Slug check is in progress
  - [ ] Slug is unavailable
  - [ ] Form is submitting
- [ ] Submit button should be enabled when:
  - [ ] All required fields filled
  - [ ] Slug is valid and available

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

## Browser Compatibility

### Test Case 10.1: Chrome/Edge
- [ ] Test all flows in Chrome/Edge
- [ ] **Expected:** All features work correctly

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 10.2: Firefox
- [ ] Test all flows in Firefox
- [ ] **Expected:** All features work correctly

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

### Test Case 10.3: Safari
- [ ] Test all flows in Safari
- [ ] **Expected:** All features work correctly

**Status:** ⬜ Pass | ⬜ Fail | ⬜ N/A  
**Notes:**

---

## Summary

### Test Results
- **Total Test Cases:** 40
- **Passed:** ___
- **Failed:** ___
- **N/A:** ___

### Critical Issues Found
1. 
2. 
3. 

### Non-Critical Issues Found
1. 
2. 
3. 

### Recommendations
1. 
2. 
3. 

### Sign-Off
- **Tester Name:** _______________
- **Date:** _______________
- **Approved for Production:** ⬜ Yes | ⬜ No | ⬜ With Conditions

---

## Notes

- This checklist should be completed in a development or staging environment before production deployment
- All critical test cases (marked with Requirements) must pass
- Document any deviations or unexpected behavior in the Notes sections
- Take screenshots of any issues for bug reports
- Retest after fixes are applied

