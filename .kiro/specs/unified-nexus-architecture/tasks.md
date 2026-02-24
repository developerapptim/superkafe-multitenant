# Implementation Plan: Unified Nexus Architecture

## Overview

This implementation plan transforms the SuperKafe platform from a fragmented multi-database system to a unified single-database multitenancy architecture. The implementation follows a phased approach to minimize risk and ensure data integrity throughout the migration.

## Tasks

- [x] 1. Update database connection module for single database
  - Modify `backend/config/db.js` to connect exclusively to `superkafe_v2`
  - Remove `getTenantDB()` function and tenant connection caching
  - Remove `closeTenantDB()` and `closeAllTenantConnections()` functions
  - Implement single connection with proper error handling and reconnection logic
  - Add connection pool configuration
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 1.1 Write property test for database connection exclusivity
  - **Property 1: Database Connection Exclusivity**
  - **Validates: Requirements 1.1, 1.3, 1.4, 1.5**

- [x] 2. Verify tenant context module implementation
  - Review `backend/utils/tenantContext.js` for AsyncLocalStorage implementation
  - Ensure `setTenantContext()`, `getTenantContext()`, and `runWithTenantContext()` work correctly
  - Add enhanced logging for context operations
  - Verify fallback mechanism for test environments
  - _Requirements: 2.4, 2.6_

- [x] 2.1 Write property test for tenant context propagation
  - **Property 7: Tenant Context Propagation**
  - **Validates: Requirements 2.4, 2.6**

- [x] 3. Update tenant resolver middleware
  - Modify `backend/middleware/tenantResolver.js` to query only `superkafe_v2`
  - Remove legacy database connection logic
  - Implement tenant caching with 5-minute TTL
  - Add comprehensive error handling for missing/invalid/inactive tenants
  - Enhance security logging for cross-tenant access attempts
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3.1 Write property test for tenant resolver header extraction
  - **Property 5: Tenant Resolver Header Extraction**
  - **Validates: Requirements 3.1, 3.3, 3.6**

- [x] 3.2 Write property test for tenant resolver caching
  - **Property 6: Tenant Resolver Caching**
  - **Validates: Requirements 3.8**

- [x] 3.3 Write unit tests for tenant resolver edge cases
  - Test missing tenant header (400 error)
  - Test invalid tenant slug (404 error)
  - Test inactive tenant (403 error)
  - Test cross-tenant access attempt (403 error)
  - _Requirements: 3.2, 3.4, 3.5_

- [x] 4. Verify tenant scoping plugin implementation
  - Review `backend/plugins/tenantScopingPlugin.js` for completeness
  - Ensure all query hooks are implemented (find, update, delete, count, aggregate)
  - Verify document hooks for auto-stamping and validation
  - Add security checks for tenantId immutability
  - Enhance error messages for missing context
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.7, 2.8_

- [x] 4.1 Write property test for automatic tenant stamping
  - **Property 2: Automatic Tenant Stamping and Immutability**
  - **Validates: Requirements 2.2, 2.7, 7.3**

- [x] 4.2 Write property test for automatic query filtering
  - **Property 3: Automatic Tenant Query Filtering**
  - **Validates: Requirements 2.3, 2.8, 7.1, 7.4**

- [x] 4.3 Write unit test for missing tenant context error
  - Test query without tenant context throws error
  - _Requirements: 2.5_

- [x] 5. Audit and update all Mongoose models
  - [x] 5.1 Identify all models requiring tenant scoping
    - List all business data models (Employee, MenuItem, Category, Order, Table, etc.)
    - Identify models that should NOT have tenant scoping (User, Tenant)
    - Document exceptions with clear reasoning
    - _Requirements: 4.1, 4.2, 4.4_
  
  - [x] 5.2 Apply tenant scoping plugin to all tenant-scoped models
    - Ensure `tenantId` field exists in schema
    - Apply `tenantScopingPlugin` to each model
    - Verify plugin is applied correctly
    - _Requirements: 4.1, 4.2_
  
  - [x] 5.3 Create indexes on tenantId fields
    - Add index on `tenantId` for all tenant-scoped models
    - Create compound indexes: `{tenantId: 1, createdAt: -1}`
    - Create compound indexes: `{tenantId: 1, status: 1}` where applicable
    - _Requirements: 4.3, 4.6_

- [x] 5.4 Write property test for model configuration consistency
  - **Property 8: Model Configuration Consistency**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.6**

- [x] 5.5 Write unit test for model migration validation
  - Verify all tenant-scoped models have plugin applied
  - Verify all tenant-scoped models have tenantId index
  - _Requirements: 4.5_

- [x] 6. Checkpoint - Verify core infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create Init Universe script
  - Create `backend/scripts/initUniverse.js` based on existing `initSingleDatabase.js`
  - Implement tenant creation for "Negoes"
  - Implement admin user creation
  - Implement employee creation with tenantId
  - Implement menu category and item seeding
  - Add idempotency checks (skip if already exists)
  - Add comprehensive error handling and rollback
  - Add detailed success/failure reporting
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 7.1 Write unit tests for Init Universe script
  - Test successful initialization
  - Test idempotency (running multiple times)
  - Test error handling and rollback
  - Test database validation
  - _Requirements: 5.4, 5.5, 5.8_

- [x] 8. Remove legacy multi-database code
  - [x] 8.1 Search and remo ve dynamic database creation functions
    - Remove `getTenantDB()` calls from controllers
    - Remove database switching logic
    - Remove tenant-specific database name references
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 8.2 Update all database connection references
    - Replace tenant database connections with unified connection
    - Update controllers to use centralized connection
    - Update services to use centralized connection
    - _Requirements: 6.4_
  
  - [x] 8.3 Remove unused database utilities
    - Remove unused connection pooling code
    - Remove unused database helper functions
    - Clean up imports and dependencies
    - _Requirements: 6.6_

- [x] 8.4 Write unit test for legacy code removal verification
  - Search codebase for legacy patterns
  - Verify zero references to `getTenantDB()`
  - Verify zero references to dynamic database creation
  - _Requirements: 6.5_

- [x] 9. Implement data isolation validation
  - [x] 9.1 Write property test for cross-tenant access prevention
    - **Property 4: Cross-Tenant Access Prevention**
    - **Validates: Requirements 7.2, 7.6**
  
  - [x] 9.2 Write property test for concurrent multi-tenant isolation
    - **Property 9: Concurrent Multi-Tenant Isolation**
    - **Validates: Requirements 8.3**
  
  - [x] 9.3 Write integration test for end-to-end tenant isolation
    - Test concurrent requests from multiple tenants
    - Verify data isolation between tenants
    - Test cross-tenant access attempts are blocked
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [-] 10. Implement monitoring and logging
  - [x] 10.1 Add tenant context logging
    - Log all tenant context initialization events
    - Log all tenant validation failures
    - Add structured logging with correlation IDs
    - _Requirements: 11.1, 11.3_
  
  - [x] 10.2 Add database connection metrics
    - Track connection pool utilization
    - Track query performance per tenant
    - Add health check endpoint
    - _Requirements: 11.2, 12.2_
  
  - [x] 10.3 Add alerting for critical events
    - Alert on database connection failures
    - Alert on cross-tenant access attempts
    - Alert on high error rates
    - _Requirements: 11.5, 11.7_

- [x] 10.4 Write property test for error message clarity
  - **Property 10: Error Message Clarity**
  - **Validates: Requirements 10.6**

- [x] 10.5 Write property test for tenant context logging
  - **Property 11: Tenant Context Logging**
  - **Validates: Requirements 11.1, 11.3**

- [x] 10.6 Write unit tests for monitoring metrics
  - Test connection pool metrics tracking
  - Test query performance tracking
  - Test health check endpoint
  - _Requirements: 11.2, 11.6_

- [x] 11. Checkpoint - Verify monitoring and isolation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement deployment readiness features
  - [x] 12.1 Add environment variable validation
    - Validate MONGODB_URI on startup
    - Validate all required environment variables
    - Exit with clear error if missing
    - _Requirements: 12.1, 12.4_
  
  - [x] 12.2 Create health check endpoint
    - Implement `/health` endpoint
    - Check database connectivity
    - Return connection status and response time
    - _Requirements: 12.2_
  
  - [ ] 12.3 Add deployment automation
    - Create deployment script
    - Auto-run initUniverse if database is empty
    - Add pre-deployment validation
    - _Requirements: 12.3_

- [ ] 12.4 Write property test for horizontal scaling compatibility
  - **Property 12: Horizontal Scaling Compatibility**
  - **Validates: Requirements 12.6**

- [ ] 12.5 Write unit tests for deployment features
  - Test environment variable validation
  - Test health check endpoint
  - Test deployment automation
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 13. Performance optimization
  - [x] 13.1 Verify index usage
    - Run explain() on common queries
    - Verify tenantId indexes are used
    - Optimize slow queries
    - _Requirements: 8.1, 8.6_
  
  - [x] 13.2 Configure connection pooling
    - Set appropriate pool size
    - Configure connection timeouts
    - Monitor pool utilization
    - _Requirements: 8.4_
  
  - [-] 13.3 Write unit tests for performance features
    - Test index usage verification
    - Test connection pool configuration
    - _Requirements: 8.1, 8.4, 8.6_

- [x] 14. Create migration documentation
  - Document migration steps from multi-database to single database
  - Create rollback procedures
  - Document deployment checklist
  - Create troubleshooting guide
  - Update architecture documentation
  - _Requirements: 6.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 10.1, 10.2, 10.3, 10.7, 12.5, 12.7_

- [x] 15. Final checkpoint - Complete system validation
  - Run full test suite (unit, property, integration)
  - Verify all requirements are met
  - Perform manual QA on critical flows
  - Review security audit findings
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- The implementation follows a phased approach to minimize risk
- Legacy code removal should be done carefully with thorough testing
- Data migration is not included in this plan and should be handled separately
- Performance testing should be done in staging before production deployment

