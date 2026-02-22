# Requirements Document: Tenant Data Isolation & Routing Context

## Introduction

This feature addresses a critical multi-tenancy architecture flaw where tenant data is not properly isolated. Currently, the system uses a shared-dashboard approach where all users are routed to a global `/admin` route, and backend controllers do not filter data by tenant identity. This results in data leakage where User B can see User A's menu data after registration.

The goal is to implement perfect tenant data isolation where every cafe owner experiences a standalone application with their unique URL structure (`/{slug}/admin`) and zero data leakage between tenants.

## Glossary

- **Tenant**: A cafe owner's isolated workspace with dedicated database and unique slug identifier
- **TenantSlug**: A unique URL-safe identifier for each tenant (e.g., "cafe-mocha", "warung-kopi")
- **TenantId**: The MongoDB ObjectId reference to a tenant in the main database
- **TenantDB**: The isolated MongoDB database for a specific tenant's operational data
- **Frontend_Router**: React Router component managing client-side navigation
- **Backend_Controller**: Express.js controller handling API requests and database operations
- **TenantResolver_Middleware**: Express middleware that extracts tenant context from request headers
- **JWT_Token**: JSON Web Token containing user authentication and tenant context
- **Admin_Route**: Protected dashboard routes for cafe management operations
- **Setup_Wizard**: Onboarding flow where new users create their tenant and choose a slug
- **Data_Scoping**: Database query filtering to ensure only tenant-specific data is retrieved

## Requirements

### Requirement 1: Tenant-Specific Admin Routing

**User Story:** As a cafe owner, I want my admin dashboard to use my unique cafe slug in the URL, so that my cafe feels like a standalone application with its own identity.

#### Acceptance Criteria

1. THE Frontend_Router SHALL change admin route structure from `/admin/*` to `/:tenantSlug/admin/*`
2. WHEN a user navigates within the dashboard, THE Frontend_Router SHALL preserve the `:tenantSlug` parameter in all navigation paths
3. WHEN a user completes the Setup_Wizard successfully, THE System SHALL redirect to `/{tenantSlug}/admin/dashboard` instead of `/admin`
4. WHEN a user attempts to access `/admin` directly, THE Frontend_Router SHALL redirect to `/{tenantSlug}/admin` using the tenant slug from their JWT_Token
5. WHEN a user bookmarks a tenant-specific admin URL, THE System SHALL load the correct tenant context on subsequent visits
6. WHEN the Setup_Wizard creates a new tenant slug, THE System SHALL enforce case-insensitive uniqueness using a database unique index to prevent collisions between "Cafe-Kopi" and "cafe-kopi"

### Requirement 2: Backend Data Scoping

**User Story:** As a cafe owner, I want to see only my cafe's data in the dashboard, so that my business information remains private and isolated from other cafes.

#### Acceptance Criteria

1. WHEN a Backend_Controller receives a request, THE System SHALL extract tenantId from the JWT_Token (not from URL) as the source of truth for database queries
2. WHEN a Backend_Controller queries the database, THE System SHALL automatically inject tenantId filter into all queries using a Mongoose global plugin to prevent human error
3. WHEN multiple tenants exist in the system, THE Backend_Controller SHALL return only data belonging to the requesting tenant
4. WHEN a Backend_Controller creates new data, THE System SHALL automatically associate the data with the requesting tenant's tenantId
5. WHEN a Backend_Controller updates or deletes data, THE System SHALL verify the data belongs to the requesting tenant before performing the operation
6. THE System SHALL audit all backend controllers (menuRoutes, cashRoutes, analyticsRoutes, inventoryRoutes, orderRoutes, employeeRoutes, financeRoutes, tableRoutes, customerRoutes, settingsRoutes) for data scoping compliance
7. WHEN a Backend_Controller handles file uploads, THE System SHALL namespace uploaded files by tenantId in the storage path to prevent cross-tenant asset access

### Requirement 3: Tenant Context Propagation

**User Story:** As a system architect, I want tenant context to flow seamlessly from authentication through routing to data access, so that tenant isolation is enforced at every layer.

#### Acceptance Criteria

1. WHEN a user logs in or completes setup, THE System SHALL include tenantSlug and tenantId in the JWT_Token payload
2. WHEN the Frontend makes an API request, THE System SHALL include the tenant slug in the request headers as `x-tenant-id`
3. WHEN the TenantResolver_Middleware processes a request, THE System SHALL attach tenant context to the request object for downstream use
4. WHEN a Backend_Controller accesses tenant context, THE System SHALL provide both tenant metadata and the TenantDB connection
5. THE System SHALL ensure tenant context is available in all authenticated requests without requiring manual extraction

### Requirement 4: Setup Wizard Redirect Logic

**User Story:** As a new cafe owner, I want to be automatically directed to my personalized dashboard after setup, so that I can immediately start managing my cafe.

#### Acceptance Criteria

1. WHEN the Setup_Wizard completes successfully, THE Backend SHALL return the tenant slug in the response payload
2. WHEN the Frontend receives the setup success response, THE System SHALL extract the tenant slug from the response
3. WHEN the tenant slug is extracted, THE Frontend_Router SHALL navigate to `/{tenantSlug}/admin/dashboard`
4. THE System SHALL remove all references to global `/admin` routes for tenant-specific operations
5. WHEN a user without a tenant tries to access tenant-specific routes, THE System SHALL redirect to the Setup_Wizard

### Requirement 5: Route Protection and Validation

**User Story:** As a system administrator, I want to prevent users from accessing other tenants' dashboards, so that security and data isolation are maintained.

#### Acceptance Criteria

1. WHEN a user attempts to access `/{slug}/admin/*`, THE System SHALL verify the slug matches the user's tenantSlug from their JWT_Token
2. WHEN a slug mismatch is detected (URL slug !== JWT slug), THE System SHALL redirect the user to their correct tenant dashboard at `/{correctSlug}/admin`
3. WHEN a user is not authenticated, THE System SHALL redirect to the login page
4. WHEN a user has not completed setup, THE System SHALL redirect to the Setup_Wizard
5. THE System SHALL validate tenant slug format and existence before allowing access to tenant-specific routes
6. THE System SHALL use JWT tenantId as the source of truth for database queries while using URL slug for UI branding and visual validation only

### Requirement 6: Backward Compatibility and Migration

**User Story:** As a system maintainer, I want existing users to transition smoothly to the new routing structure, so that no user experiences disruption.

#### Acceptance Criteria

1. WHEN an existing user with a tenant accesses the old `/admin` route, THE System SHALL automatically redirect to `/{tenantSlug}/admin`
2. WHEN the Frontend detects a legacy route pattern, THE System SHALL update the URL without losing application state
3. THE System SHALL maintain support for existing API endpoints while adding tenant context validation
4. WHEN a user's JWT_Token contains tenant information, THE System SHALL use it for automatic route correction
5. THE System SHALL log any legacy route access for monitoring and eventual deprecation

### Requirement 7: Error Handling and User Feedback

**User Story:** As a cafe owner, I want clear error messages when something goes wrong with tenant routing, so that I can understand and resolve issues quickly.

#### Acceptance Criteria

1. WHEN a tenant slug is invalid or not found, THE System SHALL display a user-friendly error message
2. WHEN a user tries to access another tenant's dashboard, THE System SHALL show an "Unauthorized Access" message
3. WHEN tenant context cannot be resolved, THE System SHALL log detailed error information for debugging
4. WHEN a database query fails due to tenant scoping issues, THE System SHALL return a 500 error with a generic message to the user and detailed logs to the server
5. THE System SHALL provide actionable error messages that guide users to the correct resolution path

## Notes

- This feature builds on the existing tenantResolver middleware and JWT authentication system
- The implementation must ensure zero data leakage between tenants at all layers
- All existing backend controllers must be audited and updated for tenant data scoping
- The routing changes must maintain the existing route priority system (static routes before dynamic routes)
- Property-based testing should focus on tenant isolation guarantees and route validation logic
- **Two Sources of Truth**: JWT tenantId is the authoritative source for database queries (security), while URL slug is used for UI branding and visual validation
- **Mongoose Global Plugin**: Implement a global Mongoose plugin to automatically inject tenantId filters into all queries, reducing human error risk
- **Asset Isolation**: All uploaded files (menu images, etc.) must be namespaced by tenantId in storage paths to prevent cross-tenant access
- **Case-Insensitive Uniqueness**: Tenant slug uniqueness must be enforced case-insensitively at the database level using unique indexes
