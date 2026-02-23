# Implementation Plan: Dashboard Tenant Isolation Fix

## Overview

This implementation plan addresses a critical data isolation bug by adding the `tenantResolver` middleware to three dashboard route files. The fix is straightforward and low-risk: we're adding existing, well-tested middleware to routes that should have had it from the beginning. No controller or model changes are required.

The implementation follows a simple pattern: import the middleware and apply it in the correct position in the middleware chain. We'll verify the fix with property-based tests to ensure tenant isolation works correctly across all dashboard endpoints.

## Tasks

- [x] 1. Add tenantResolver middleware to statsRoutes.js
  - Import `tenantResolver` from `../middleware/tenantResolver`
  - Apply middleware using `router.use(tenantResolver)` after `router.use(checkJwt)`
  - Verify middleware order: checkJwt → tenantResolver → controller
  - _Requirements: 1.1, 2.1, 2.2, 5.1_

- [ ]* 2. Write property test for stats route tenant context establishment
  - **Property 1: Tenant Context Establishment for Dashboard Routes**
  - **Validates: Requirements 1.1, 1.2, 1.3**
  - Generate random valid tenant IDs and verify context is established for /api/stats
  - Minimum 100 iterations

- [x] 3. Add tenantResolver middleware to menuRoutes.js
  - Import `tenantResolver` from `../middleware/tenantResolver`
  - Apply middleware using `router.use(tenantResolver)` at the top of route definitions
  - Verify middleware applies to all menu routes (GET, POST, PUT, DELETE)
  - _Requirements: 1.2, 2.1, 2.2, 5.2_

- [ ]* 4. Write property test for menu routes tenant context establishment
  - **Property 1: Tenant Context Establishment for Dashboard Routes**
  - **Validates: Requirements 1.1, 1.2, 1.3**
  - Generate random valid tenant IDs and verify context is established for /api/menu/*
  - Minimum 100 iterations

- [x] 5. Add tenantResolver middleware to tableRoutes.js
  - Import `tenantResolver` from `../middleware/tenantResolver`
  - Apply middleware using `router.use(tenantResolver)` after `router.use(checkApiKey)`
  - Verify middleware order: checkApiKey → tenantResolver → controller
  - _Requirements: 1.3, 2.1, 2.2, 5.3_

- [ ]* 6. Write property test for table routes tenant context establishment
  - **Property 1: Tenant Context Establishment for Dashboard Routes**
  - **Validates: Requirements 1.1, 1.2, 1.3**
  - Generate random valid tenant IDs and verify context is established for /api/tables/*
  - Minimum 100 iterations

- [x] 7. Checkpoint - Verify middleware is properly configured
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 8. Write property test for tenant context availability
  - **Property 2: Tenant Context Availability Throughout Request Lifecycle**
  - **Validates: Requirements 1.4, 2.3**
  - Generate random tenant IDs and verify getTenantContext() returns correct value in controllers
  - Minimum 100 iterations

- [ ]* 9. Write property test for error handling
  - **Property 3: Error Handling for Invalid Tenant Headers**
  - **Validates: Requirements 1.5**
  - Generate random invalid tenant headers and verify appropriate error responses
  - Test missing headers, non-existent tenants, inactive tenants, mismatched tenants
  - Minimum 100 iterations

- [x] 10. Write property test for cross-tenant data isolation
  - **Property 4: Cross-Tenant Data Isolation**
  - **Validates: Requirements 3.1, 3.2, 3.3**
  - Generate random pairs of distinct tenants with test data
  - Verify each tenant only sees their own data across all dashboard endpoints
  - Test /api/stats, /api/menu, /api/tables
  - Minimum 100 iterations

- [x] 11. Write property test for automatic filter injection
  - **Property 5: Automatic TenantId Filter Injection**
  - **Validates: Requirements 3.4**
  - Generate random tenant IDs and intercept queries
  - Verify tenantId filter is present in query conditions
  - Minimum 100 iterations

- [ ]* 12. Write property test for no plugin warnings
  - **Property 6: No Plugin Warnings with Proper Context**
  - **Validates: Requirements 4.1**
  - Generate random valid tenant IDs and capture log output
  - Verify no plugin warnings appear during dashboard requests
  - Minimum 100 iterations

- [ ]* 13. Write integration test for multi-tenant dashboard access
  - Create 3+ test tenants with distinct data
  - Make authenticated requests to all dashboard endpoints for each tenant
  - Verify complete data isolation and correct data returned
  - _Requirements: 3.1, 3.2, 3.3, 6.1, 6.2, 6.3, 6.4_

- [ ]* 14. Write unit tests for middleware order verification
  - Verify tenantResolver is present in middleware stack for each route file
  - Verify tenantResolver comes after authentication middleware
  - Verify tenantResolver comes before controller execution
  - _Requirements: 2.1, 2.2, 5.1, 5.2, 5.3_

- [ ]* 15. Write unit tests for error response examples
  - Test missing x-tenant-slug header returns 400
  - Test non-existent tenant returns 404
  - Test inactive tenant returns 404
  - Test cross-tenant access attempt returns 403
  - _Requirements: 1.5, 6.5_

- [ ]* 16. Run existing test suites for backward compatibility
  - Run existing tests for StatsController, MenuController, TableController
  - Verify all existing tests pass without modification
  - Verify existing authentication flows work correctly
  - _Requirements: 2.4, 5.4, 6.6_

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster deployment
- The core fix (tasks 1, 3, 5) is simple and low-risk
- Property tests provide comprehensive validation of tenant isolation
- Integration tests verify end-to-end flows work correctly
- Unit tests verify specific edge cases and error conditions
- All tests should use fast-check or similar PBT library for Node.js
- Each property test should run minimum 100 iterations
- Manual testing checklist is provided in the design document for final verification
