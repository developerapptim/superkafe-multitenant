# Design Document: Dashboard Tenant Isolation Fix

## Overview

This design addresses a critical data isolation bug where dashboard API routes (`/api/stats`, `/api/menu`, `/api/tables`) are missing the `tenantResolver` middleware. Without this middleware, the tenant context is never established, causing the `tenantScopingPlugin` to log warnings and return unfiltered data from all tenants.

The fix is straightforward: add the `tenantResolver` middleware to the three affected route files in the correct position within the middleware chain. This ensures tenant context is established before controller execution, allowing the `tenantScopingPlugin` to automatically filter all database queries by the current tenant's ID.

**Key Insight:** The system already has all the necessary infrastructure in place:
- Frontend sends `x-tenant-slug` and `x-tenant-id` headers via JWT
- `tenantResolver` middleware extracts headers and sets tenant context
- `tenantScopingPlugin` automatically filters queries using tenant context
- Models (Order, MenuItem, Table, etc.) already use the plugin

The bug is simply that three route files don't apply the middleware, creating a security hole.

## Architecture

### Current Architecture (Broken)

```
Request → Authentication (checkJwt/checkApiKey) → Controller → Model Query
                                                                    ↓
                                                            No tenant context!
                                                            Plugin logs warning
                                                            Returns ALL tenant data
```

### Fixed Architecture

```
Request → Authentication → tenantResolver → Controller → Model Query
                                ↓                            ↓
                        Sets tenant context          Plugin auto-filters by tenantId
                        via setTenantContext()       Returns ONLY current tenant data
```

### Middleware Execution Order

The correct middleware order for dashboard routes is:

1. **Authentication** (`checkJwt` or `checkApiKey`) - Validates user credentials
2. **Tenant Resolution** (`tenantResolver`) - Extracts tenant from headers, sets context
3. **Controller** - Executes business logic with tenant context available

**Rationale:** Authentication must come first to validate the user, then tenant resolution can safely extract tenant information from the authenticated request and establish context for the controller.

## Components and Interfaces

### Affected Route Files

#### 1. statsRoutes.js

**Current Implementation:**
```javascript
const express = require('express');
const router = express.Router();
const StatsController = require('../controllers/StatsController');
const { checkJwt } = require('../middleware/auth');

router.use(checkJwt);

router.get('/', StatsController.getDashboardStats);

module.exports = router;
```

**Fixed Implementation:**
```javascript
const express = require('express');
const router = express.Router();
const StatsController = require('../controllers/StatsController');
const { checkJwt } = require('../middleware/auth');
const tenantResolver = require('../middleware/tenantResolver');

router.use(checkJwt);
router.use(tenantResolver);

router.get('/', StatsController.getDashboardStats);

module.exports = router;
```

**Changes:**
- Import `tenantResolver` middleware
- Apply `tenantResolver` after `checkJwt` using `router.use()`

#### 2. menuRoutes.js

**Current Implementation:**
```javascript
const express = require('express');
const router = express.Router();
const MenuController = require('../controllers/MenuController');
const { checkApiKey, checkJwt } = require('../middleware/auth');

router.get('/', MenuController.getMenus);
router.get('/customer', MenuController.getMenusCustomer);
router.get('/:id', MenuController.getMenuById);
router.post('/', checkJwt, MenuController.createMenu);
router.put('/reorder', checkJwt, MenuController.reorderMenus);
router.put('/:id', checkJwt, MenuController.updateMenu);
router.delete('/:id', checkJwt, MenuController.deleteMenu);

// ... more routes
```

**Fixed Implementation:**
```javascript
const express = require('express');
const router = express.Router();
const MenuController = require('../controllers/MenuController');
const { checkApiKey, checkJwt } = require('../middleware/auth');
const tenantResolver = require('../middleware/tenantResolver');

// Apply tenantResolver to ALL routes in this file
router.use(tenantResolver);

router.get('/', MenuController.getMenus);
router.get('/customer', MenuController.getMenusCustomer);
router.get('/:id', MenuController.getMenuById);
router.post('/', checkJwt, MenuController.createMenu);
router.put('/reorder', checkJwt, MenuController.reorderMenus);
router.put('/:id', checkJwt, MenuController.updateMenu);
router.delete('/:id', checkJwt, MenuController.deleteMenu);

// ... more routes
```

**Changes:**
- Import `tenantResolver` middleware
- Apply `tenantResolver` to all routes using `router.use()` at the top
- Note: Some routes have `checkJwt` inline, some don't. The `tenantResolver` applies to all.

**Authentication Note:** The menu routes have mixed authentication:
- Some routes use inline `checkJwt` (POST, PUT, DELETE)
- Some routes have no explicit auth (GET routes)
- This suggests GET routes may be protected at the app level or are intentionally public

For tenant isolation, `tenantResolver` must run on ALL routes regardless of authentication. The middleware itself validates that tenant headers are present and valid.

#### 3. tableRoutes.js

**Current Implementation:**
```javascript
const express = require('express');
const router = express.Router();
const TableController = require('../controllers/TableController');
const { checkApiKey } = require('../middleware/auth');

router.use(checkApiKey);

router.get('/', TableController.getTables);
router.post('/', TableController.addTable);
router.patch('/:id/status', TableController.updateStatus);
router.delete('/:id', TableController.deleteTable);
router.post('/:fromId/move/:toId', TableController.moveTable);
router.patch('/:id/clean', TableController.cleanTable);

module.exports = router;
```

**Fixed Implementation:**
```javascript
const express = require('express');
const router = express.Router();
const TableController = require('../controllers/TableController');
const { checkApiKey } = require('../middleware/auth');
const tenantResolver = require('../middleware/tenantResolver');

router.use(checkApiKey);
router.use(tenantResolver);

router.get('/', TableController.getTables);
router.post('/', TableController.addTable);
router.patch('/:id/status', TableController.updateStatus);
router.delete('/:id', TableController.deleteTable);
router.post('/:fromId/move/:toId', TableController.moveTable);
router.patch('/:id/clean', TableController.cleanTable);

module.exports = router;
```

**Changes:**
- Import `tenantResolver` middleware
- Apply `tenantResolver` after `checkApiKey` using `router.use()`

### Existing Components (No Changes Required)

#### tenantResolver Middleware

Located at `backend/middleware/tenantResolver.js`, this middleware:

1. Extracts `x-tenant-slug` or `x-tenant-id` from request headers
2. Queries the main database for the tenant record
3. Validates tenant exists and is active
4. Performs security check: ensures authenticated user's tenant matches requested tenant
5. Establishes tenant database connection
6. Sets tenant context via `setTenantContext(req.tenant)`
7. Attaches `req.tenant` and `req.tenantDB` to the request object

**No modifications needed** - this middleware already works correctly.

#### tenantScopingPlugin

Located at `backend/plugins/tenantScopingPlugin.js`, this Mongoose plugin:

1. Adds `tenantId` field to schemas
2. Hooks into all query operations (find, update, delete, etc.)
3. Automatically injects `tenantId` filter using `getTenantContext()`
4. Logs warnings when tenant context is missing
5. Auto-sets `tenantId` on document creation

**No modifications needed** - this plugin already works correctly.

#### Controllers

The controllers (StatsController, MenuController, TableController) already rely on the `tenantScopingPlugin` for automatic tenant filtering. They don't manually filter by `tenantId` because the plugin handles it transparently.

**No modifications needed** - controllers will automatically benefit from tenant context once middleware is applied.

## Data Models

No data model changes are required. All affected models already use the `tenantScopingPlugin`:

- **Order** - Used by StatsController
- **MenuItem** - Used by MenuController
- **Recipe** - Used by MenuController
- **Ingredient** - Used by MenuController
- **Table** - Used by TableController

The plugin is already configured on these models and will automatically filter queries once tenant context is available.


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Tenant Context Establishment for Dashboard Routes

*For any* valid tenant and any dashboard route (`/api/stats`, `/api/menu/*`, `/api/tables/*`), when a request is made with valid tenant headers, the tenantResolver middleware should successfully extract tenant identification and establish tenant context before controller execution.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Tenant Context Availability Throughout Request Lifecycle

*For any* request to dashboard routes with valid tenant headers, once tenant context is established by tenantResolver, the tenant ID should remain accessible via `getTenantContext()` throughout the entire request lifecycle, including in the tenantScopingPlugin and controllers.

**Validates: Requirements 1.4, 2.3**

### Property 3: Error Handling for Invalid Tenant Headers

*For any* request to dashboard routes with missing or invalid tenant headers (empty string, non-existent tenant, inactive tenant, mismatched tenant), the tenantResolver middleware should reject the request with an appropriate HTTP error response (400, 403, or 404) before controller execution.

**Validates: Requirements 1.5**

### Property 4: Cross-Tenant Data Isolation

*For any* two distinct tenants (Tenant A and Tenant B), when Tenant A makes a request to any dashboard endpoint (`/api/stats`, `/api/menu`, `/api/tables`), the response should contain only data belonging to Tenant A and should not contain any data belonging to Tenant B.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 5: Automatic TenantId Filter Injection

*For any* database query executed by models using the tenantScopingPlugin, when tenant context is available, the plugin should automatically inject a `tenantId` filter matching the current tenant's ID into the query filter conditions.

**Validates: Requirements 3.4**

### Property 6: No Plugin Warnings with Proper Context

*For any* request to dashboard routes with valid tenant headers and proper middleware configuration, the tenantScopingPlugin should not log warnings about missing tenant context during query execution.

**Validates: Requirements 4.1**

## Error Handling

### Tenant Resolution Errors

The `tenantResolver` middleware already handles all error cases:

1. **Missing Headers** (400 Bad Request)
   - When `x-tenant-slug` or `x-tenant-id` header is missing
   - Response: `{ success: false, message: 'Header x-tenant-slug atau x-tenant-id wajib disertakan' }`

2. **Tenant Not Found** (404 Not Found)
   - When tenant doesn't exist or is inactive
   - Response: `{ success: false, message: 'Tenant tidak ditemukan atau tidak aktif' }`

3. **Cross-Tenant Access** (403 Forbidden)
   - When authenticated user's tenant doesn't match requested tenant
   - Response: `{ success: false, message: 'Unauthorized access to tenant data' }`
   - Logs security warning with HIGH severity

4. **Internal Errors** (500 Internal Server Error)
   - When database errors or unexpected exceptions occur
   - Response: `{ success: false, message: 'Terjadi kesalahan saat memproses tenant' }`
   - Logs detailed error information for debugging

### Plugin Behavior Without Context

The `tenantScopingPlugin` handles missing context gracefully:

1. **Query Operations** - Logs warning but allows query to proceed (returns unfiltered data)
2. **Document Creation** - Logs warning but allows validation to handle missing `tenantId`

**After this fix**, dashboard routes will always have tenant context, so plugin warnings should never occur during normal operation.

## Testing Strategy

### Unit Tests

Unit tests should verify specific examples and edge cases:

1. **Middleware Order Verification**
   - Verify `tenantResolver` is present in middleware stack for each route file
   - Verify `tenantResolver` comes after authentication middleware
   - Verify `tenantResolver` comes before controller execution

2. **Error Response Examples**
   - Test request with missing `x-tenant-slug` header returns 400
   - Test request with non-existent tenant returns 404
   - Test request with inactive tenant returns 404
   - Test request with mismatched tenant (cross-tenant access) returns 403

3. **Backward Compatibility**
   - Run existing test suites for StatsController, MenuController, TableController
   - Verify all existing tests pass without modification
   - Verify existing authentication flows work correctly

### Property-Based Tests

Property tests should verify universal correctness across all inputs:

1. **Property 1: Tenant Context Establishment**
   - Generate random valid tenant IDs
   - Generate random dashboard route paths
   - For each combination, verify tenant context is established
   - Minimum 100 iterations

2. **Property 2: Context Availability**
   - Generate random valid tenant IDs
   - Make requests to dashboard routes
   - Verify `getTenantContext()` returns correct tenant ID in controller
   - Minimum 100 iterations

3. **Property 3: Error Handling**
   - Generate random invalid tenant headers (empty, null, non-existent, inactive)
   - Verify all invalid requests are rejected with appropriate error codes
   - Minimum 100 iterations

4. **Property 4: Cross-Tenant Isolation**
   - Generate random pairs of distinct tenants
   - Create test data for each tenant
   - Verify each tenant only sees their own data
   - Test across all dashboard endpoints
   - Minimum 100 iterations

5. **Property 5: Filter Injection**
   - Generate random tenant IDs
   - Intercept queries before execution
   - Verify `tenantId` filter is present in query conditions
   - Minimum 100 iterations

6. **Property 6: No Warnings**
   - Generate random valid tenant IDs
   - Capture log output during requests
   - Verify no plugin warnings appear in logs
   - Minimum 100 iterations

### Integration Tests

Integration tests should verify end-to-end flows:

1. **Multi-Tenant Dashboard Access**
   - Create 3+ test tenants with distinct data
   - Make authenticated requests to all dashboard endpoints for each tenant
   - Verify complete data isolation
   - Verify correct data is returned for each tenant

2. **Authentication + Tenant Resolution Flow**
   - Test complete flow: login → get JWT → make dashboard request
   - Verify tenant headers are correctly extracted from JWT
   - Verify tenant context is established
   - Verify data is properly filtered

3. **Error Recovery**
   - Test requests with various error conditions
   - Verify appropriate error responses
   - Verify system remains stable after errors
   - Verify subsequent valid requests work correctly

### Manual Testing Checklist

Before deployment, manually verify:

1. ✅ Login as Tenant A admin, view dashboard stats - see only Tenant A data
2. ✅ Login as Tenant B admin, view dashboard stats - see only Tenant B data
3. ✅ Login as Tenant A admin, view menu - see only Tenant A menu items
4. ✅ Login as Tenant B admin, view menu - see only Tenant B menu items
5. ✅ Login as Tenant A admin, view tables - see only Tenant A tables
6. ✅ Login as Tenant B admin, view tables - see only Tenant B tables
7. ✅ Check server logs - no plugin warnings about missing tenant context
8. ✅ Test with invalid tenant headers - verify appropriate error responses
9. ✅ Verify existing functionality (orders, payments, etc.) still works

### Test Configuration

All property-based tests should:
- Run minimum 100 iterations (due to randomization)
- Use appropriate PBT library for Node.js (fast-check recommended)
- Tag each test with format: **Feature: dashboard-tenant-isolation-fix, Property N: [property text]**
- Reference the design document property number in test comments

Example test tag:
```javascript
// Feature: dashboard-tenant-isolation-fix, Property 4: Cross-Tenant Data Isolation
// Validates: Requirements 3.1, 3.2, 3.3
```
