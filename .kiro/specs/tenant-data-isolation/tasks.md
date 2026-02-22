# Implementation Plan: Tenant Data Isolation & Routing Context

## Overview

This implementation plan transforms the shared-dashboard architecture into a true multi-tenant system with perfect data isolation. The approach follows a layered strategy:

1. **Foundation Layer**: Database schema updates and Mongoose plugin for automatic tenant scoping
2. **Backend Layer**: Enhance middleware and audit all controllers for tenant data scoping
3. **Frontend Layer**: Migrate routing structure from `/admin` to `/:tenantSlug/admin`
4. **Integration Layer**: Wire everything together with proper error handling and redirects
5. **Validation Layer**: Comprehensive testing to ensure zero data leakage

Each task builds incrementally, with checkpoints to validate core functionality before proceeding.

## Tasks

- [x] 1. Database Schema and Tenant Scoping Foundation
  - [x] 1.1 Add case-insensitive unique index to Tenant model slug field
    - Update `backend/models/Tenant.js` to add collation-based unique index
    - _Requirements: 1.6_
  
  - [x] 1.2 Create Mongoose tenant scoping plugin
    - Create `backend/plugins/tenantScopingPlugin.js`
    - Implement query hooks: pre('find'), pre('findOne'), pre('updateOne'), pre('updateMany'), pre('deleteOne'), pre('deleteMany'), pre('save')
    - Auto-inject tenantId filter from tenant context
    - Auto-set tenantId on document creation
    - _Requirements: 2.2, 2.4_
  
  - [x]* 1.3 Write property test for tenant scoping plugin
    - **Property 10: Automatic TenantId Filter Injection**
    - **Property 12: New Records Auto-Tagged with TenantId**
    - **Validates: Requirements 2.2, 2.4**
  
  - [x] 1.4 Create tenant context storage utility
    - Create `backend/utils/tenantContext.js` using AsyncLocalStorage
    - Implement setTenantContext() and getTenantContext() functions
    - _Requirements: 3.3_
  
  - [x] 1.5 Add tenantId field to all tenant-scoped models
    - Update models: MenuItem, Order, Employee, Inventory, Cash, CashTransaction, Table, Customer, Recipe, Category, Expense, Debt, Attendance, Shift, Payroll, Reservation, ServiceRequest, Feedback, MarketingCampaign
    - Add tenantId field with required: true, index: true
    - Apply tenantScopingPlugin to each model
    - _Requirements: 2.2, 2.3_

- [x] 2. Backend Middleware and Context Enhancement
  - [x] 2.1 Enhance tenantResolver middleware
    - Update `backend/middleware/tenantResolver.js`
    - Call setTenantContext() after resolving tenant
    - Ensure req.tenant and req.tenantDB are properly set
    - _Requirements: 3.3, 3.4_
  
  - [x]* 2.2 Write property test for middleware tenant context attachment
    - **Property 17: Middleware Attaches Tenant Context**
    - **Validates: Requirements 3.3, 3.4**
  
  - [x] 2.3 Update JWT token generation to include tenant info
    - Update `backend/controllers/SetupController.js` setupTenant function
    - Update `backend/controllers/UnifiedAuthController.js` login function
    - Ensure JWT payload includes: tenant (slug), tenantId, tenantDbName
    - _Requirements: 3.1_
  
  - [x]* 2.4 Write property test for JWT tenant information
    - **Property 15: JWT Contains Tenant Information**
    - **Validates: Requirements 3.1**

- [x] 3. Backend Controller Audit and Data Scoping
  - [x] 3.1 Audit and update MenuController for tenant scoping
    - Update `backend/controllers/MenuController.js`
    - Verify all queries use tenant-scoped models (automatic via plugin)
    - Remove any manual tenantId filtering (now handled by plugin)
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 3.2 Audit and update remaining controllers
    - Update controllers: CashController, AnalyticsController, InventoryController, OrderController, EmployeeController, FinanceController, TableController, CustomerController, SettingsController
    - Verify tenant scoping via plugin
    - Ensure no cross-tenant data access
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x]* 3.3 Write property test for cross-tenant data isolation
    - **Property 11: Cross-Tenant Data Isolation**
    - **Property 13: Cross-Tenant Modification Prevention**
    - **Validates: Requirements 2.3, 2.5**
  
  - [x] 3.4 Update ImageController for tenant-namespaced file uploads
    - Update `backend/controllers/ImageController.js`
    - Change upload path from `uploads/{filename}` to `uploads/{tenantId}/{filename}`
    - Update file retrieval logic to use tenant-namespaced paths
    - _Requirements: 2.7_
  
  - [x]* 3.5 Write property test for file upload path namespacing
    - **Property 14: File Upload Path Namespacing**
    - **Validates: Requirements 2.7**

- [x] 4. Checkpoint - Backend Data Isolation Validation
  - Ensure all tests pass
  - Manually test: Create two tenants, add data to each, verify no cross-tenant data leakage
  - Ask the user if questions arise

- [x] 5. Frontend API Service Enhancement
  - [x] 5.1 Update API service to include x-tenant-id header
    - Update `frontend/src/services/api.js`
    - Add request interceptor to extract tenant slug from JWT and add to headers
    - _Requirements: 3.2_
  
  - [x]* 5.2 Write property test for API request tenant header
    - **Property 16: API Requests Include Tenant Header**
    - **Validates: Requirements 3.2**

- [x] 6. Frontend Routing Structure Migration
  - [x] 6.1 Create TenantRouter utility component
    - Create `frontend/src/components/TenantRouter.jsx`
    - Implement tenant context extraction from JWT
    - Implement slug validation logic
    - Provide tenant context to child components
    - _Requirements: 1.1, 1.2_
  
  - [x] 6.2 Enhance ProtectedRoute with tenant validation
    - Update `frontend/src/components/ProtectedRoute.jsx`
    - Add requireTenant prop (default: true for admin routes)
    - Implement URL slug vs JWT slug validation
    - Implement redirect logic for slug mismatch
    - Implement redirect for incomplete setup
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x]* 6.3 Write property tests for route protection
    - **Property 4: URL Slug Mismatch Triggers Redirect**
    - **Property 5: Unauthenticated Access Redirects to Login**
    - **Property 6: Incomplete Setup Redirects to Wizard**
    - **Property 7: Invalid Slug Format Rejected**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
  
  - [x] 6.4 Update App.jsx routing structure
    - Update `frontend/src/App.jsx`
    - Change admin routes from `/admin/*` to `/:tenantSlug/admin/*`
    - Add LegacyAdminRedirect component for `/admin` route
    - Wrap admin routes with enhanced ProtectedRoute
    - Maintain route priority (static routes before dynamic routes)
    - _Requirements: 1.1, 1.4_
  
  - [x]* 6.5 Write property test for dashboard navigation slug preservation
    - **Property 1: Dashboard Navigation Preserves Tenant Slug**
    - **Validates: Requirements 1.2**
  
  - [x] 6.6 Create LegacyAdminRedirect component
    - Create `frontend/src/components/LegacyAdminRedirect.jsx`
    - Extract tenant slug from JWT
    - Redirect to `/{tenantSlug}/admin`
    - Log legacy route access
    - _Requirements: 1.4, 6.1, 6.5_
  
  - [x]* 6.7 Write property tests for legacy route handling
    - **Property 2: Legacy Admin Route Redirects to Tenant Route**
    - **Property 8: State Preservation During Legacy Redirect**
    - **Property 22: Legacy Route Access Logged**
    - **Validates: Requirements 1.4, 6.1, 6.2, 6.5**

- [x] 7. Frontend Navigation Updates
  - [x] 7.1 Update Sidebar navigation links to use tenant slug
    - Update `frontend/src/components/Sidebar.jsx`
    - Change menuItems paths from `/admin/*` to use tenant slug from JWT
    - Use useTenant() hook or extract slug from JWT token
    - Update all paths: dashboard, menu, kasir, gramasi, inventaris, keuangan, pegawai, meja, laporan, shift, pelanggan, feedback, marketing, pengaturan, data-center
    - _Requirements: 1.2_
  
  - [x] 7.2 Update SetupWizard redirect logic
    - Update `frontend/src/pages/SetupWizard.jsx`
    - Change redirect from `/admin/dashboard` to `/{tenantSlug}/admin/dashboard`
    - Extract tenant slug from API response (response.data.tenant.slug)
    - _Requirements: 1.3, 4.1, 4.2, 4.3_
  
  - [ ]* 7.3 Write integration test for setup completion redirect
    - **Property 21: Setup Completion Redirects to Tenant Dashboard**
    - **Validates: Requirements 1.3, 4.1, 4.2, 4.3**
  
  - [x] 7.4 Update CommandPalette navigation actions
    - Update `frontend/src/components/CommandPalette.jsx`
    - Ensure all navigation actions use tenant-specific paths
    - Extract tenant slug from JWT and prepend to action URLs
    - _Requirements: 1.2_
  
  - [x] 7.5 Update AdminLayout logout redirect
    - Update `frontend/src/pages/admin/AdminLayout.jsx`
    - Change logout redirect from `/login` to `/auth/login` or appropriate login route
    - Ensure consistency with authentication flow
    - _Requirements: 6.1_
  
  - [x] 7.6 Audit and update remaining admin page navigation
    - Check and update navigation in: SubscriptionSuccess, Meja, DataCenter, and any other pages with hardcoded `/admin` paths
    - Ensure all navigate() calls preserve or correctly construct tenant slug paths
    - _Requirements: 1.2_

- [-] 8. Checkpoint - Frontend Routing Validation
  - Ensure all tests pass
  - Manually test: Navigate through all admin pages, verify slug persists in URL
  - Manually test: Access legacy `/admin` route, verify redirect to `/{slug}/admin`
  - Manually test: Complete setup wizard, verify redirect to `/{slug}/admin/dashboard`
  - Manually test: Click all sidebar links, verify tenant slug is preserved
  - Ask the user if questions arise

- [x] 9. Error Handling Implementation
  - [x] 9.1 Create error page components
    - Create `frontend/src/pages/errors/InvalidSlug.jsx`
    - Create `frontend/src/pages/errors/TenantNotFound.jsx`
    - Create `frontend/src/pages/errors/UnauthorizedAccess.jsx`
    - _Requirements: 7.1, 7.2_
  
  - [x] 9.2 Implement frontend error handling in ProtectedRoute
    - Add error state management
    - Show appropriate error pages for different scenarios
    - Provide user-friendly error messages
    - _Requirements: 7.1, 7.2_
  
  - [ ]* 9.3 Write property tests for error handling
    - **Property 18: Invalid Slug Shows User-Friendly Error**
    - **Property 19: Tenant Resolution Failure Logs Details**
    - **Property 20: Tenant Scoping Errors Return Generic User Message**
    - **Validates: Requirements 7.1, 7.3, 7.4**
  
  - [x] 9.4 Enhance backend error logging
    - Update tenantResolver middleware error handling
    - Add detailed logging for tenant resolution failures
    - Add security logging for cross-tenant access attempts
    - _Requirements: 7.3, 7.4_

- [ ] 10. Integration Testing and Validation
  - [ ]* 10.1 Write integration test for complete tenant isolation flow
    - Create two tenants with different slugs
    - Add data to each tenant
    - Verify no cross-tenant data leakage
    - Test cross-tenant access attempts
    - **Validates: Requirements 2.3, 2.5**
  
  - [ ]* 10.2 Write integration test for routing and authentication flow
    - Test unauthenticated access → login → tenant dashboard
    - Test setup wizard → tenant creation → redirect to dashboard
    - Test slug mismatch → automatic redirect
    - **Validates: Requirements 1.3, 5.1, 5.2, 5.3**
  
  - [ ]* 10.3 Write property test for slug uniqueness
    - **Property 3: Slug Case-Insensitive Uniqueness**
    - **Validates: Requirements 1.6**

- [ ] 11. Final Checkpoint and Documentation
  - Ensure all tests pass (unit + property + integration)
  - Run manual testing checklist from design document
  - Verify zero data leakage between tenants
  - Verify all routes use tenant-specific URLs
  - Document any migration steps for existing users
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation of critical functionality
- The Mongoose plugin approach eliminates manual filtering errors across all controllers
- JWT tenantId is the authoritative source for data queries; URL slug is for UX only
- All file uploads must be namespaced by tenantId to prevent cross-tenant asset access

## Progress Summary

### Completed (Tasks 1-6)
- ✅ Backend foundation: Mongoose plugin, tenant context storage, model updates
- ✅ Backend middleware: Enhanced tenantResolver with context propagation
- ✅ Backend controllers: All audited and updated for tenant scoping
- ✅ Backend file uploads: Tenant-namespaced paths implemented
- ✅ Frontend API service: x-tenant-id header injection
- ✅ Frontend routing structure: App.jsx updated with `/:tenantSlug/admin/*` routes
- ✅ Frontend components: TenantRouter, ProtectedRoute, LegacyAdminRedirect created
- ✅ Property-based tests: Core isolation and routing properties tested

### Remaining (Tasks 7-11)
- ⏳ Frontend navigation: Sidebar, SetupWizard, CommandPalette, and other components need tenant slug updates
- ⏳ Error handling: Error pages and enhanced error logging
- ⏳ Integration testing: End-to-end tenant isolation validation
- ⏳ Final validation: Manual testing checklist and documentation

## Critical Implementation Tips

### Task 7.1 - Dynamic Sidebar Menu Paths
When updating Sidebar.jsx, you have two options:

**Option 1: Use useTenant() hook (Recommended)**
```javascript
import { useTenant } from './TenantRouter';

function Sidebar({ onLogout, isCollapsed, toggleSidebar }) {
  const { tenantSlug } = useTenant();
  
  const menuItems = [
    { path: `/${tenantSlug}/admin/dashboard`, icon: '📊', label: 'Dashboard', ... },
    { path: `/${tenantSlug}/admin/menu`, icon: '🍽️', label: 'Manajemen Menu', ... },
    // ... rest of menu items
  ];
}
```

**Option 2: Extract from JWT directly**
```javascript
import { jwtDecode } from 'jwt-decode';

function Sidebar({ onLogout, isCollapsed, toggleSidebar }) {
  const token = localStorage.getItem('token');
  const decoded = token ? jwtDecode(token) : null;
  const tenantSlug = decoded?.tenant || '';
  
  const menuItems = [
    { path: `/${tenantSlug}/admin/dashboard`, icon: '📊', label: 'Dashboard', ... },
    // ... rest of menu items
  ];
}
```

### Task 7.2 - SetupWizard Redirect
The SetupWizard currently redirects to `/admin/dashboard`. Update line 194:

```javascript
// OLD
navigate('/admin/dashboard');

// NEW
const tenantSlug = response.data.tenant.slug;
navigate(`/${tenantSlug}/admin/dashboard`);
```

### Task 7.4 - CommandPalette Dynamic URLs
The CommandPalette has hardcoded action URLs. Update to dynamically construct paths:

```javascript
const token = localStorage.getItem('token');
const decoded = token ? jwtDecode(token) : null;
const tenantSlug = decoded?.tenant || '';

const actions = [
  { label: 'Dashboard', url: `/${tenantSlug}/admin/dashboard`, ... },
  { label: 'Menu', url: `/${tenantSlug}/admin/menu`, ... },
  // ... rest of actions
];
```

### General Best Practices
1. **Test with Multiple Tenants**: Always test with at least 2 tenants to verify isolation
2. **Check Browser Console**: Watch for navigation errors or incorrect redirects
3. **Verify URL Persistence**: Navigate through multiple pages and ensure slug stays in URL
4. **Test Legacy Routes**: Access `/admin` directly and verify redirect works
5. **Test Bookmarks**: Bookmark a tenant-specific URL and verify it loads correctly

