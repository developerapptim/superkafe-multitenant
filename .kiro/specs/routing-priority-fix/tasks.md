# Implementation Plan: Routing Priority Fix

## Overview

Implementasi ini akan memperbaiki masalah routing priority di aplikasi SuperKafe dengan dua komponen utama:
1. Restrukturisasi routing hierarchy di frontend (App.jsx)
2. Implementasi slug validation dengan reserved keywords di backend

Setiap task dirancang untuk dapat diimplementasikan secara incremental dengan validasi di setiap langkah.

## Tasks

- [x] 1. Implementasi Slug Validation Utility di Backend
  - Buat file `backend/utils/slugValidator.js`
  - Implementasi fungsi `validateSlug()` dengan validasi:
    - Empty check
    - Reserved keywords check (setup-cafe, admin, dashboard, auth, api, login, register, logout)
    - Format validation (regex: ^[a-z0-9-]+$)
    - Length validation (min 3, max 50)
    - Hyphen position check (tidak boleh di awal/akhir)
  - Implementasi fungsi `isReservedKeyword()`
  - Export RESERVED_KEYWORDS constant
  - _Requirements: 2.1, 2.2, 2.3, 3.1_

- [x] 1.1 Write unit tests for slug validator
  - Test reserved keywords rejection
  - Test format validation (invalid characters, length, hyphen position)
  - Test valid slug acceptance
  - Test edge cases (empty, whitespace, special characters)
  - _Requirements: 2.1, 2.2, 3.1, 3.2_

- [x] 1.2 Write property test for slug validator
  - **Property 2: Reserved Keywords Rejection**
  - **Property 3: Valid Non-Reserved Slugs Acceptance**
  - **Property 4: Slug Format Validation**
  - **Validates: Requirements 2.1, 2.2, 2.4, 3.1**

- [x] 2. Update TenantController dengan Slug Validation
  - Import `validateSlug` dari `../utils/slugValidator`
  - Tambahkan slug validation di awal fungsi `registerTenant()` sebelum cek database
  - Return error response jika slug tidak valid dengan message dari validator
  - Pastikan error response konsisten dengan format existing
  - _Requirements: 2.1, 2.4, 3.1_

- [x] 2.1 Write unit tests for TenantController validation
  - Test reserved keyword rejection in registerTenant
  - Test invalid format rejection
  - Test valid slug acceptance
  - _Requirements: 2.1, 3.1_

- [x] 3. Update SetupController dengan Slug Validation
  - Import `validateSlug` dari `../utils/slugValidator`
  - Tambahkan slug validation di fungsi `setupTenant()` sebelum cek database
  - Update fungsi `checkSlug()` untuk validate slug sebelum cek database
  - Return appropriate error messages untuk setiap jenis validation error
  - _Requirements: 2.1, 2.2, 2.4, 3.1_

- [x] 3.1 Write unit tests for SetupController validation
  - Test setupTenant with reserved keywords
  - Test checkSlug with reserved keywords
  - Test setupTenant with invalid format
  - Test checkSlug with invalid format
  - _Requirements: 2.1, 2.2, 3.1_

- [x] 4. Checkpoint - Backend Validation Complete
  - Ensure all backend tests pass
  - Test API endpoints manually dengan Postman/Thunder Client:
    - POST /api/tenants/register dengan reserved keyword
    - POST /api/setup/tenant dengan reserved keyword
    - GET /api/setup/check-slug/:slug dengan reserved keyword
  - Verify error messages are clear and helpful
  - Ask user if questions arise

- [x] 5. Restrukturisasi Routing di Frontend App.jsx
  - Backup existing App.jsx
  - Reorder routes dengan prioritas:
    1. Landing page (/)
    2. Auth routes (/auth/*)
    3. Setup wizard (/setup-cafe)
    4. Admin routes (/admin/*)
    5. Dynamic tenant storefront (/:tenantSlug/*)
    6. Fallback (404)
  - Pastikan semua nested routes tetap intact
  - Verify tidak ada breaking changes pada existing routes
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 5.1 Write unit tests for routing priority
  - Test /setup-cafe routes to correct component
  - Test /admin/* routes to AdminLayout
  - Test /auth/* routes to auth components
  - Test invalid path redirects to landing page
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 5.2 Write property test for dynamic routing
  - **Property 1: Valid Tenant Slugs Route to Storefront**
  - **Property 5: Nested Routes Preservation**
  - **Validates: Requirements 1.4, 5.1, 5.3**

- [x] 6. Buat SetupWizard Component (jika belum ada)
  - Buat file `frontend/src/pages/SetupWizard.jsx`
  - Implementasi form dengan fields:
    - cafeName (required)
    - slug (required, real-time validation)
    - adminName (optional, default dari user.name)
  - Implementasi real-time slug availability check (debounced)
  - Implementasi form submission ke `/api/setup/tenant`
  - Handle success: save token, redirect to /admin/dashboard
  - Handle errors: display inline error messages
  - Add loading states dan disabled states
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 6.1 Write unit tests for SetupWizard
  - Test form validation
  - Test slug availability check
  - Test form submission success flow
  - Test error handling
  - _Requirements: 4.2, 4.4_

- [x] 7. Update Navigation Logic di Auth Components
  - Update `SimpleLogin.jsx`: redirect ke /setup-cafe jika user belum punya tenant
  - Update `SimpleRegister.jsx`: redirect ke /setup-cafe setelah registrasi Google OAuth
  - Tambahkan check: jika user sudah punya tenant, redirect ke /admin/dashboard
  - _Requirements: 4.1, 4.3_

- [x] 7.1 Write unit tests for navigation logic
  - Test redirect to setup-cafe for new users
  - Test redirect to dashboard for existing tenant owners
  - _Requirements: 4.1, 4.3_

- [x] 8. Add Protected Route Logic untuk Setup Wizard
  - Setup wizard hanya accessible untuk authenticated users
  - Jika unauthenticated, redirect ke /auth/login dengan return URL
  - Jika user sudah punya tenant, redirect ke /admin/dashboard
  - _Requirements: 4.3_

- [x] 8.1 Write unit tests for setup wizard protection
  - Test unauthenticated access redirects to login
  - Test authenticated user with tenant redirects to dashboard
  - Test authenticated user without tenant can access
  - _Requirements: 4.3_

- [x] 9. Integration Testing dan Manual QA
  - Test complete flow: Register → Setup Wizard → Dashboard
  - Test complete flow: Google OAuth → Setup Wizard → Dashboard
  - Test reserved keyword rejection di UI
  - Test invalid format rejection di UI
  - Test existing tenant slug masih accessible
  - Test nested routes (/:slug/keranjang, /:slug/pesanan) masih berfungsi
  - Verify backward compatibility dengan existing tenants
  - _Requirements: 1.4, 2.1, 3.1, 4.1, 4.4, 5.1, 5.3_

- [x] 10. Final Checkpoint - Complete System Test
  - Run all unit tests dan property tests
  - Verify all 5 correctness properties pass
  - Test dengan real data di development environment
  - Check error messages are user-friendly
  - Verify no breaking changes untuk existing features
  - Ask user for final approval before deployment

## Notes

- Tasks marked with `*` are optional testing tasks (dapat di-skip untuk MVP cepat)
- Setiap task reference specific requirements untuk traceability
- Backend validation harus selesai dan tested sebelum frontend changes
- Property tests menggunakan fast-check library dengan minimum 100 iterations
- Checkpoint tasks memastikan incremental validation
- Backward compatibility adalah prioritas - existing tenant slugs harus tetap berfungsi
