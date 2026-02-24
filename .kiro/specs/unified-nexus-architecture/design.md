# Design Document: Unified Nexus Architecture

## Overview

The Unified Nexus Architecture represents a fundamental transformation of the SuperKafe platform from a fragmented multi-database system to a centralized single-database multitenancy architecture. This design eliminates "database pollution" on VPS infrastructure by consolidating all tenant data into a single MongoDB database (`superkafe_v2`) while maintaining strict tenant isolation at the application layer.

### Current State Problems

The existing architecture suffers from:
- **Database Proliferation**: Each tenant triggers dynamic database creation, leading to hundreds of databases on the VPS
- **Scattered Logic**: Database switching logic is distributed across controllers, services, and utilities
- **Inconsistent Isolation**: Tenant data isolation relies on manual filtering, creating security risks
- **Complex Connection Management**: Multiple database connections consume resources and complicate monitoring
- **Maintenance Burden**: Schema changes and migrations must be applied to every tenant database

### Target Architecture

The new architecture provides:
- **Single Database**: All tenant data resides in `superkafe_v2` with tenant isolation via `tenantId` field
- **Automatic Scoping**: Mongoose plugin transparently injects `tenantId` filters into all queries
- **Context Propagation**: AsyncLocalStorage tracks tenant context throughout async execution chains
- **Centralized Connection**: Single connection pool managed by `db.js` configuration module
- **Zero-to-One Initialization**: Automated script creates the first tenant with complete setup

### Key Benefits

1. **Operational Simplicity**: One database to backup, monitor, and maintain
2. **Resource Efficiency**: Single connection pool instead of N tenant connections
3. **Developer Experience**: Transparent tenant scoping eliminates manual filtering
4. **Security**: Automatic tenant isolation prevents cross-tenant data leakage
5. **Scalability**: Horizontal scaling simplified with shared database architecture

## Architecture

### System Architecture Diagram

```mermaid
graph TB
    Client[Client Application]
    API[Express API Server]
    TenantResolver[Tenant Resolver Middleware]
    ALS[AsyncLocalStorage Context]
    Plugin[Tenant Scoping Plugin]
    DB[(MongoDB superkafe_v2)]
    
    Client -->|HTTP Request + x-tenant-slug header| API
    API --> TenantResolver
    TenantResolver -->|Validate tenant| DB
    TenantResolver -->|Set context| ALS
    API -->|Execute business logic| Plugin
    Plugin -->|Read context| ALS
    Plugin -->|Auto-inject tenantId filter| DB
    
    style DB fill:#e1f5ff
    style ALS fill:#fff4e1
    style Plugin fill:#e8f5e9
```

### Request Flow

1. **Request Arrival**: Client sends HTTP request with `x-tenant-slug` header (e.g., `negoes`)
2. **Tenant Resolution**: Middleware validates tenant exists and is active in `tenants` collection
3. **Context Storage**: Tenant information stored in AsyncLocalStorage for current async execution
4. **Business Logic**: Controllers execute without explicit tenant parameter passing
5. **Query Execution**: Mongoose plugin automatically injects `tenantId` filter before database query
6. **Response**: Data returned contains only records matching current tenant context

### Data Flow Diagram

```mermaid
sequenceDiagram
    participant C as Client
    participant M as Tenant Resolver
    participant A as AsyncLocalStorage
    participant P as Mongoose Plugin
    participant D as Database
    
    C->>M: Request + x-tenant-slug: negoes
    M->>D: SELECT * FROM tenants WHERE slug='negoes'
    D-->>M: Tenant {id: ObjectId(...), slug: 'negoes'}
    M->>A: setTenantContext({id, slug, name})
    M-->>C: Continue to controller
    
    Note over P: Controller executes query
    P->>A: getTenantContext()
    A-->>P: {id: ObjectId(...)}
    P->>D: SELECT * FROM orders WHERE tenantId=ObjectId(...)
    D-->>P: [tenant-scoped results]
    P-->>C: Response with tenant data
```


## Components and Interfaces

### 1. Database Connection Module (`backend/config/db.js`)

**Purpose**: Centralized database connection management for the unified architecture.

**Responsibilities**:
- Establish single connection to `superkafe_v2` database
- Manage connection lifecycle (connect, disconnect, error handling)
- Provide connection instance to application
- Remove legacy multi-database connection logic

**Interface**:

```javascript
/**
 * Connect to the unified database
 * @returns {Promise<mongoose.Connection>} MongoDB connection
 * @throws {Error} If connection fails
 */
async function connectMainDB(): Promise<mongoose.Connection>

/**
 * Get the active database connection
 * @returns {mongoose.Connection} Active connection instance
 */
function getConnection(): mongoose.Connection

/**
 * Close database connection gracefully
 * @returns {Promise<void>}
 */
async function closeConnection(): Promise<void>
```

**Configuration**:
- Connection string from `MONGODB_URI` environment variable
- Default: `mongodb://localhost:27017/superkafe_v2`
- Connection options: `useNewUrlParser`, `useUnifiedTopology`, connection pooling

**Error Handling**:
- Log connection errors with full context
- Exit process on initial connection failure (fail-fast)
- Implement reconnection logic for transient failures
- Emit connection events for monitoring


### 2. Tenant Context Module (`backend/utils/tenantContext.js`)

**Purpose**: Manage tenant context propagation using AsyncLocalStorage.

**Responsibilities**:
- Store tenant information in AsyncLocalStorage for current async execution
- Retrieve tenant context without explicit parameter passing
- Provide fallback mechanism for test environments
- Log context operations for debugging

**Interface**:

```javascript
/**
 * Set tenant context for current async execution
 * @param {Object} tenant - Tenant information
 * @param {string} tenant.id - Tenant ObjectId as string
 * @param {string} tenant.slug - Tenant slug identifier
 * @param {string} tenant.name - Tenant display name
 * @param {string} tenant.dbName - Database name (always 'superkafe_v2')
 */
function setTenantContext(tenant: TenantContext): void

/**
 * Get current tenant context
 * @returns {TenantContext|undefined} Current tenant or undefined
 */
function getTenantContext(): TenantContext | undefined

/**
 * Run function with specific tenant context
 * @param {TenantContext} tenant - Tenant context
 * @param {Function} fn - Function to execute
 * @returns {*} Function result
 */
function runWithTenantContext(tenant: TenantContext, fn: Function): any
```

**Type Definitions**:

```typescript
interface TenantContext {
  id: string;          // MongoDB ObjectId as string
  slug: string;        // URL-safe identifier (e.g., 'negoes')
  name: string;        // Display name (e.g., 'Negoes')
  dbName: string;      // Always 'superkafe_v2' in unified architecture
}
```


### 3. Tenant Resolver Middleware (`backend/middleware/tenantResolver.js`)

**Purpose**: Validate tenant identity and establish context for each request.

**Responsibilities**:
- Extract tenant slug from `x-tenant-slug` HTTP header
- Validate tenant exists and is active in database
- Prevent cross-tenant access attempts
- Store tenant context in AsyncLocalStorage
- Cache tenant information to minimize database queries
- Log security events (invalid tenants, cross-tenant attempts)

**Middleware Signature**:

```javascript
/**
 * Tenant resolver middleware
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
async function tenantResolver(req, res, next): Promise<void>
```

**Request Enhancement**:

```javascript
// Middleware adds these properties to req object
req.tenant = {
  id: string,      // Tenant ObjectId as string
  slug: string,    // Tenant slug
  name: string,    // Tenant name
  dbName: string   // Always 'superkafe_v2'
}
```

**Validation Rules**:
1. Header `x-tenant-slug` must be present → 400 Bad Request if missing
2. Tenant must exist in `tenants` collection → 404 Not Found if missing
3. Tenant must have `isActive: true` → 403 Forbidden if inactive
4. If user authenticated, `req.user.tenant` must match `req.tenant.slug` → 403 Forbidden if mismatch

**Caching Strategy**:
- Cache tenant lookups in memory (Map or LRU cache)
- Cache key: tenant slug (lowercase)
- Cache TTL: 5 minutes
- Invalidate on tenant updates


### 4. Tenant Scoping Plugin (`backend/plugins/tenantScopingPlugin.js`)

**Purpose**: Automatically inject `tenantId` filters into all Mongoose queries.

**Responsibilities**:
- Add `tenantId` field to schemas that don't have it
- Auto-stamp `tenantId` on document creation
- Auto-inject `tenantId` filter on all read queries
- Auto-inject `tenantId` filter on all write queries
- Prevent `tenantId` modification on existing documents
- Validate tenant context exists before operations
- Log security warnings when context is missing

**Plugin Signature**:

```javascript
/**
 * Tenant scoping plugin for Mongoose schemas
 * @param {Schema} schema - Mongoose schema
 * @param {Object} options - Plugin options
 */
function tenantScopingPlugin(schema, options = {}): void
```

**Schema Modification**:

```javascript
// Plugin adds this field if not present
{
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  }
}
```

**Query Hooks**:
- `pre('find')` - Inject filter before find queries
- `pre('findOne')` - Inject filter before findOne queries
- `pre('findOneAndUpdate')` - Inject filter before updates
- `pre('findOneAndDelete')` - Inject filter before deletes
- `pre('updateOne')` - Inject filter before updateOne
- `pre('updateMany')` - Inject filter before updateMany
- `pre('deleteOne')` - Inject filter before deleteOne
- `pre('deleteMany')` - Inject filter before deleteMany
- `pre('countDocuments')` - Inject filter before count queries

**Document Hooks**:
- `pre('validate')` - Auto-stamp tenantId on new documents
- `pre('save')` - Validate tenantId matches context on updates

**Security Features**:
- Throw error if no tenant context exists during query
- Prevent tenantId modification after document creation
- Log security events for cross-tenant access attempts


### 5. Init Universe Script (`backend/scripts/initUniverse.js`)

**Purpose**: Zero-to-one initialization script for first tenant setup.

**Responsibilities**:
- Create first tenant "Negoes" in `superkafe_v2` database
- Create admin user with valid credentials
- Create employee record linked to tenant
- Seed basic menu categories and items
- Validate database exists before seeding
- Handle idempotency (skip if already initialized)
- Provide detailed success/failure reporting

**Script Interface**:

```javascript
/**
 * Initialize the unified database with first tenant
 * @returns {Promise<InitResult>}
 */
async function initUniverse(): Promise<InitResult>

interface InitResult {
  success: boolean;
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
  user: {
    email: string;
    name: string;
  };
  employee: {
    email: string;
    role: string;
  };
  menuItems: number;
  message: string;
}
```

**Initialization Steps**:

1. **Connect to Database**
   - Connect to `superkafe_v2` using `MONGODB_URI`
   - Validate connection successful

2. **Create Tenant**
   - Check if tenant "negoes" exists
   - If not exists, create with:
     - `name`: "Negoes"
     - `slug`: "negoes"
     - `dbName`: "superkafe_v2"
     - `isActive`: true
     - `status`: "trial"
     - `trialExpiresAt`: 10 days from now

3. **Create User**
   - Check if user exists by email
   - If not exists, create with:
     - `email`: "admin@negoes.com"
     - `password`: bcrypt hash of "admin123"
     - `name`: "Admin Negoes"
     - `authProvider`: "local"
     - `isVerified`: true
     - `hasCompletedSetup`: true
     - `tenantId`: tenant._id
     - `tenantSlug`: "negoes"

4. **Create Employee**
   - Check if employee exists for tenant
   - If not exists, create with:
     - `tenantId`: tenant._id
     - `email`: "admin@negoes.com"
     - `name`: "Admin Negoes"
     - `role`: "admin"
     - `isActive`: true

5. **Seed Menu Data**
   - Create "Kopi" category
   - Create 3 sample menu items (Kopi Susu, Kopi Hitam, Es Kopi)
   - All with `tenantId` field set

**Idempotency**:
- Check existence before creating each entity
- Skip creation if already exists
- Report status for each step (created/skipped)

**Output**:
- Success summary with created entities
- Login credentials
- Access URLs
- Important next steps


## Data Models

### Tenant Model

**Collection**: `tenants` (in `superkafe_v2` database)

**Schema**:

```javascript
{
  _id: ObjectId,                    // Auto-generated
  name: String,                     // Display name (e.g., "Negoes")
  slug: String,                     // URL-safe identifier (unique, lowercase)
  dbName: String,                   // Always "superkafe_v2" in unified architecture
  isActive: Boolean,                // Tenant active status
  status: String,                   // Enum: 'trial', 'paid', 'expired', 'suspended'
  trialExpiresAt: Date,             // Trial expiration date
  subscriptionExpiresAt: Date,      // Subscription expiration (null for trial)
  createdAt: Date,                  // Auto-timestamp
  updatedAt: Date                   // Auto-timestamp
}
```

**Indexes**:
- `slug`: Unique index with case-insensitive collation
- `isActive`: Index for filtering active tenants
- `status`: Index for subscription queries
- `trialExpiresAt`: Index for expiration checks

**Validation Rules**:
- `slug` must match pattern: `/^[a-z0-9-]+$/`
- `slug` must be unique (case-insensitive)
- `name` is required and trimmed
- `dbName` is required (always "superkafe_v2")
- `status` must be one of enum values

**Virtual Fields**:
- `isTrialActive`: Computed boolean (status === 'trial' && now < trialExpiresAt)
- `trialDaysRemaining`: Computed integer (days until trial expires)

**Methods**:
- `canAccessFeatures()`: Returns true if tenant can access platform features


### Tenant-Scoped Models

All business data models must include `tenantId` field and apply the tenant scoping plugin.

**Base Schema Pattern**:

```javascript
const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const ExampleSchema = new mongoose.Schema({
  // tenantId added automatically by plugin if not present
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  
  // Business fields
  name: String,
  // ... other fields
  
}, { timestamps: true });

// Apply tenant scoping plugin
ExampleSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('Example', ExampleSchema);
```

**Models Requiring Tenant Scoping**:

1. **Employee** - Restaurant staff members
2. **MenuItem** - Menu items and products
3. **Category** - Menu categories
4. **Order** - Customer orders
5. **Table** - Restaurant tables
6. **CashTransaction** - Financial transactions
7. **Inventory** - Stock management
8. **Customer** - Customer records
9. **Reservation** - Table reservations
10. **Report** - Generated reports

**Models NOT Requiring Tenant Scoping**:

1. **User** - Pre-tenant registration users (global)
2. **Tenant** - Tenant registry (global)

**Index Strategy**:
- All tenant-scoped models must have index on `tenantId`
- Compound indexes should include `tenantId` as first field
- Example: `{tenantId: 1, createdAt: -1}` for time-based queries


## API Specifications

### Tenant Resolution

All API endpoints (except authentication and public endpoints) must include tenant resolution.

**Required Header**:

```http
x-tenant-slug: negoes
```

**Middleware Application**:

```javascript
// Apply to all tenant-scoped routes
const tenantResolver = require('./middleware/tenantResolver');

// Protected routes
router.use('/api/menu', tenantResolver, menuRoutes);
router.use('/api/orders', tenantResolver, orderRoutes);
router.use('/api/tables', tenantResolver, tableRoutes);
// ... other tenant-scoped routes

// Public routes (no tenant resolver)
router.use('/api/auth', authRoutes);
router.use('/api/health', healthRoutes);
```

**Error Responses**:

```javascript
// Missing tenant header
{
  "success": false,
  "message": "Header x-tenant-slug atau x-tenant-id wajib disertakan",
  "code": "TENANT_HEADER_MISSING"
}
// Status: 400 Bad Request

// Tenant not found
{
  "success": false,
  "message": "Tenant tidak ditemukan atau tidak aktif",
  "code": "TENANT_NOT_FOUND"
}
// Status: 404 Not Found

// Inactive tenant
{
  "success": false,
  "message": "Tenant tidak ditemukan atau tidak aktif",
  "code": "TENANT_INACTIVE"
}
// Status: 403 Forbidden

// Cross-tenant access attempt
{
  "success": false,
  "message": "Unauthorized access to tenant data",
  "code": "CROSS_TENANT_ACCESS"
}
// Status: 403 Forbidden
```


### Database Query Patterns

**Automatic Tenant Filtering**:

```javascript
// Controller code - no manual tenantId filtering needed
const MenuController = {
  async getMenuItems(req, res) {
    // Plugin automatically adds: { tenantId: req.tenant.id }
    const items = await MenuItem.find({ isActive: true });
    
    res.json({ success: true, data: items });
  },
  
  async createMenuItem(req, res) {
    // Plugin automatically stamps tenantId on save
    const item = new MenuItem(req.body);
    await item.save();
    
    res.json({ success: true, data: item });
  }
};
```

**Explicit Tenant Override (Admin Operations)**:

```javascript
// For admin operations that need cross-tenant access
const AdminController = {
  async getAllTenantsData(req, res) {
    // Explicitly bypass plugin by querying without context
    // This should be rare and require elevated permissions
    const allData = await MenuItem.find({}).setOptions({ 
      skipTenantFilter: true  // Custom option to bypass plugin
    });
    
    res.json({ success: true, data: allData });
  }
};
```

**Aggregation Queries**:

```javascript
// Plugin automatically injects $match stage with tenantId
const OrderController = {
  async getOrderStats(req, res) {
    const stats = await Order.aggregate([
      // Plugin adds: { $match: { tenantId: ObjectId(...) } }
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({ success: true, data: stats });
  }
};
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, the following properties were identified as testable through property-based testing. Redundant properties have been eliminated through logical analysis:

**Eliminated Redundancies**:
- Properties 2.2 (auto-stamp tenantId) and 7.3 (tenantId immutable) are combined into Property 2 (tenant stamping and immutability)
- Properties 2.3 (auto-filter queries) and 7.1 (only return matching documents) are combined into Property 3 (query filtering)
- Properties 2.8 (delete filtering) and 7.1 (query filtering) are combined into Property 3 (covers all operations)
- Properties 3.1 (extract header) and 3.6 (store context) are combined into Property 6 (tenant resolution flow)
- Properties 4.1, 4.2, 4.3 are combined into Property 8 (model configuration)
- Properties 7.2 (prevent cross-tenant) and 7.6 (admin permissions) are combined into Property 4 (cross-tenant prevention)

### Core Properties

**Property 1: Database Connection Exclusivity**

*For any* database operation in the system, the connection used SHALL always target the `superkafe_v2` database and never create or connect to tenant-specific databases.

**Validates: Requirements 1.1, 1.3, 1.4, 1.5**

---

**Property 2: Automatic Tenant Stamping and Immutability**

*For any* new document created in a tenant-scoped model, the system SHALL automatically stamp the `tenantId` field with the current tenant context, and *for any* subsequent update operation, the `tenantId` field SHALL remain immutable and unchanged.

**Validates: Requirements 2.2, 2.7, 7.3**

---

**Property 3: Automatic Tenant Query Filtering**

*For any* query operation (find, update, delete, count, aggregate) on a tenant-scoped model, the system SHALL automatically inject a filter matching the current tenant context's `tenantId`, ensuring only documents belonging to the current tenant are accessed.

**Validates: Requirements 2.3, 2.8, 7.1, 7.4**

---

**Property 4: Cross-Tenant Access Prevention**

*For any* authenticated user with tenant context A attempting to access data, if the request specifies tenant context B where A ≠ B, the system SHALL reject the request with a 403 Forbidden error, preventing cross-tenant data leakage.

**Validates: Requirements 7.2, 7.6**

---

**Property 5: Tenant Resolver Header Extraction**

*For any* HTTP request to a tenant-scoped endpoint, the tenant resolver SHALL extract the tenant slug from the `x-tenant-slug` header, validate it against the tenants collection, and store the tenant context in AsyncLocalStorage if valid and active.

**Validates: Requirements 3.1, 3.3, 3.6**

---

**Property 6: Tenant Resolver Caching**

*For any* sequence of requests with the same tenant slug within the cache TTL period, the tenant resolver SHALL perform database lookup only on the first request and serve subsequent requests from cache, minimizing database queries.

**Validates: Requirements 3.8**

---

**Property 7: Tenant Context Propagation**

*For any* async operation chain initiated within a request with tenant context, the tenant context SHALL remain accessible via `getTenantContext()` throughout the entire async execution chain without explicit parameter passing.

**Validates: Requirements 2.4, 2.6**

---

**Property 8: Model Configuration Consistency**

*For any* tenant-scoped Mongoose model, the schema SHALL include a required `tenantId` field with an index, and the Tenant_Scoping_Plugin SHALL be applied to the schema.

**Validates: Requirements 4.1, 4.2, 4.3, 4.6**

---

**Property 9: Concurrent Multi-Tenant Isolation**

*For any* set of concurrent requests from different tenants, each request SHALL only access data belonging to its own tenant context, with no data leakage between concurrent tenant operations.

**Validates: Requirements 8.3**

---

**Property 10: Error Message Clarity**

*For any* error condition related to tenant context (missing context, invalid tenant, cross-tenant access), the system SHALL provide a clear error message indicating the specific tenant context problem.

**Validates: Requirements 10.6**

---

**Property 11: Tenant Context Logging**

*For any* tenant context initialization or validation failure, the system SHALL log the event with sufficient detail (tenant slug, timestamp, error details) for debugging and security auditing.

**Validates: Requirements 11.1, 11.3**

---

**Property 12: Horizontal Scaling Compatibility**

*For any* deployment with multiple application instances sharing the unified database, each instance SHALL correctly handle tenant isolation using AsyncLocalStorage without interference between instances or requests.

**Validates: Requirements 12.6**


### Edge Cases and Examples

The following acceptance criteria are best tested through specific examples or edge case handling rather than universal properties:

**Edge Case 1: Missing Tenant Header**

When a request arrives without the `x-tenant-slug` header, the tenant resolver SHALL return a 400 Bad Request error.

**Validates: Requirements 3.2**

---

**Edge Case 2: Invalid Tenant Slug**

When a request arrives with a tenant slug that does not exist in the tenants collection, the tenant resolver SHALL return a 404 Not Found error.

**Validates: Requirements 3.4**

---

**Edge Case 3: Inactive Tenant**

When a request arrives with a tenant slug for an inactive tenant (`isActive: false`), the tenant resolver SHALL return a 403 Forbidden error.

**Validates: Requirements 3.5**

---

**Edge Case 4: Missing Tenant Context**

When a query operation is attempted without tenant context in AsyncLocalStorage, the Tenant_Scoping_Plugin SHALL throw an error preventing data access.

**Validates: Requirements 2.5**

---

**Example 1: Database Connection Configuration**

The system SHALL connect to `superkafe_v2` database using the `MONGODB_URI` environment variable on application startup.

**Validates: Requirements 1.1, 1.2**

---

**Example 2: Legacy Code Removal**

The codebase SHALL have zero references to legacy patterns: `getTenantDB()`, `createConnection()` with tenant-specific database names, or dynamic database creation functions.

**Validates: Requirements 1.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

---

**Example 3: Tenant Resolver Database Query**

The tenant resolver SHALL query the `tenants` collection in `superkafe_v2` database, not any legacy tenant-specific database.

**Validates: Requirements 3.7**

---

**Example 4: Init Universe Idempotency**

When the `initUniverse` script is run multiple times, it SHALL skip creation of entities that already exist and report their status without errors.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8**

---

**Example 5: Index Usage Verification**

Query execution plans for tenant-scoped queries SHALL show index usage on the `tenantId` field.

**Validates: Requirements 8.1, 8.6**

---

**Example 6: Connection Pool Configuration**

The database connection SHALL use connection pooling with configured pool size limits.

**Validates: Requirements 8.4**

---

**Example 7: Health Check Endpoint**

The system SHALL provide a `/health` endpoint that validates database connectivity and returns connection status.

**Validates: Requirements 12.2**

---

**Example 8: Environment Variable Validation**

On application startup, the system SHALL validate that required environment variables (`MONGODB_URI`) are present and exit with error if missing.

**Validates: Requirements 12.1, 12.4**

---

**Example 9: Automated Test Coverage**

The test suite SHALL include tests demonstrating correct usage of the Tenant_Scoping_Plugin for common operations (create, read, update, delete).

**Validates: Requirements 10.4**

---

**Example 10: Monitoring Metrics**

The system SHALL track and expose metrics for database connection pool usage, query performance per tenant, and tenant validation failures.

**Validates: Requirements 11.2, 11.5, 11.6, 11.7**

---

**Example 11: Migration Safety**

The migration process SHALL create backups, validate data integrity, provide rollback capability, and log all steps.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.7**

---

**Example 12: Deployment Automation**

The deployment process SHALL automatically run the `initUniverse` script if the database is empty.

**Validates: Requirements 12.3**


## Error Handling

### Error Categories

**1. Configuration Errors**

Errors related to system configuration and startup:

```javascript
// Missing environment variable
{
  code: 'CONFIG_MISSING',
  message: 'Required environment variable MONGODB_URI is not set',
  severity: 'FATAL',
  action: 'Set MONGODB_URI in environment and restart'
}

// Invalid database connection string
{
  code: 'CONFIG_INVALID_URI',
  message: 'Invalid MongoDB connection string format',
  severity: 'FATAL',
  action: 'Verify MONGODB_URI format and credentials'
}
```

**2. Tenant Resolution Errors**

Errors during tenant validation and context establishment:

```javascript
// Missing tenant header
{
  code: 'TENANT_HEADER_MISSING',
  message: 'Header x-tenant-slug atau x-tenant-id wajib disertakan',
  statusCode: 400,
  severity: 'WARNING'
}

// Tenant not found
{
  code: 'TENANT_NOT_FOUND',
  message: 'Tenant tidak ditemukan atau tidak aktif',
  statusCode: 404,
  severity: 'WARNING',
  tenantSlug: 'invalid-slug'
}

// Inactive tenant
{
  code: 'TENANT_INACTIVE',
  message: 'Tenant tidak ditemukan atau tidak aktif',
  statusCode: 403,
  severity: 'WARNING',
  tenantSlug: 'inactive-tenant'
}

// Cross-tenant access attempt
{
  code: 'CROSS_TENANT_ACCESS',
  message: 'Unauthorized access to tenant data',
  statusCode: 403,
  severity: 'HIGH',
  userTenant: 'tenant-a',
  requestedTenant: 'tenant-b'
}
```

**3. Tenant Context Errors**

Errors related to AsyncLocalStorage context:

```javascript
// Missing tenant context during query
{
  code: 'TENANT_CONTEXT_MISSING',
  message: 'No tenant context available for query operation',
  severity: 'ERROR',
  model: 'MenuItem',
  operation: 'find'
}

// Tenant mismatch on document update
{
  code: 'TENANT_MISMATCH',
  message: 'Cannot modify document from different tenant',
  statusCode: 403,
  severity: 'HIGH',
  documentTenantId: 'ObjectId(...)',
  contextTenantId: 'ObjectId(...)'
}
```

**4. Database Errors**

Errors related to database operations:

```javascript
// Connection failure
{
  code: 'DB_CONNECTION_FAILED',
  message: 'Failed to connect to database',
  severity: 'FATAL',
  error: 'MongoNetworkError: connection timeout'
}

// Query timeout
{
  code: 'DB_QUERY_TIMEOUT',
  message: 'Database query exceeded timeout',
  severity: 'ERROR',
  query: 'find',
  model: 'Order',
  timeout: 5000
}
```

### Error Handling Strategy

**1. Fail-Fast on Startup**

Critical configuration errors should cause immediate process exit:

```javascript
// In db.js
try {
  await mongoose.connect(process.env.MONGODB_URI);
} catch (error) {
  console.error('[FATAL] Database connection failed:', error);
  process.exit(1); // Fail-fast
}
```

**2. Graceful Degradation for Runtime Errors**

Runtime errors should be handled gracefully with appropriate HTTP responses:

```javascript
// In tenantResolver middleware
if (!tenant) {
  return res.status(404).json({
    success: false,
    code: 'TENANT_NOT_FOUND',
    message: 'Tenant tidak ditemukan atau tidak aktif'
  });
}
```

**3. Security Event Logging**

Security-related errors must be logged with full context:

```javascript
console.error('[SECURITY] Cross-tenant access attempt', {
  severity: 'HIGH',
  userId: req.user.id,
  userTenant: req.user.tenant,
  requestedTenant: tenant.slug,
  ip: req.ip,
  timestamp: new Date().toISOString()
});
```

**4. Error Recovery**

Implement retry logic for transient failures:

```javascript
// Connection retry with exponential backoff
async function connectWithRetry(maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await mongoose.connect(uri);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```


## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests as complementary approaches:

- **Unit Tests**: Verify specific examples, edge cases, error conditions, and integration points
- **Property Tests**: Verify universal properties across all inputs through randomization
- **Together**: Provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness

### Property-Based Testing

**Framework**: Use `fast-check` library for JavaScript/Node.js property-based testing

**Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `Feature: unified-nexus-architecture, Property {number}: {property_text}`

**Property Test Examples**:

```javascript
// Property 1: Database Connection Exclusivity
// Feature: unified-nexus-architecture, Property 1: Database Connection Exclusivity
describe('Property 1: Database Connection Exclusivity', () => {
  it('should always use superkafe_v2 database for all operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          operation: fc.constantFrom('find', 'create', 'update', 'delete'),
          model: fc.constantFrom('MenuItem', 'Order', 'Table', 'Employee')
        }),
        async ({ operation, model }) => {
          const Model = mongoose.model(model);
          const dbName = Model.db.name;
          
          expect(dbName).toBe('superkafe_v2');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 2: Automatic Tenant Stamping and Immutability
// Feature: unified-nexus-architecture, Property 2: Automatic Tenant Stamping and Immutability
describe('Property 2: Automatic Tenant Stamping', () => {
  it('should auto-stamp tenantId on creation and prevent modification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string(),
          price: fc.integer({ min: 1000, max: 100000 })
        }),
        async (itemData) => {
          // Set tenant context
          const tenant = { id: new ObjectId(), slug: 'test-tenant' };
          setTenantContext(tenant);
          
          // Create document
          const item = new MenuItem(itemData);
          await item.save();
          
          // Verify tenantId was stamped
          expect(item.tenantId.toString()).toBe(tenant.id.toString());
          
          // Attempt to modify tenantId
          const originalTenantId = item.tenantId;
          item.tenantId = new ObjectId();
          
          await expect(item.save()).rejects.toThrow('TENANT_MISMATCH');
          
          // Verify tenantId unchanged
          const reloaded = await MenuItem.findById(item._id);
          expect(reloaded.tenantId.toString()).toBe(originalTenantId.toString());
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 3: Automatic Tenant Query Filtering
// Feature: unified-nexus-architecture, Property 3: Automatic Tenant Query Filtering
describe('Property 3: Query Filtering', () => {
  it('should automatically filter all queries by tenantId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tenantId: fc.constantFrom(tenantA._id, tenantB._id),
          queryType: fc.constantFrom('find', 'findOne', 'updateOne', 'deleteOne')
        }),
        async ({ tenantId, queryType }) => {
          // Set tenant context
          setTenantContext({ id: tenantId, slug: 'test' });
          
          // Execute query
          let results;
          switch (queryType) {
            case 'find':
              results = await MenuItem.find({});
              break;
            case 'findOne':
              results = [await MenuItem.findOne({})].filter(Boolean);
              break;
            // ... other query types
          }
          
          // Verify all results match tenant context
          results.forEach(doc => {
            expect(doc.tenantId.toString()).toBe(tenantId.toString());
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Testing

**Focus Areas**:
- Specific examples demonstrating correct behavior
- Edge cases (missing headers, invalid tenants, inactive tenants)
- Error conditions and error messages
- Integration between components
- Init script idempotency

**Unit Test Examples**:

```javascript
// Edge Case: Missing Tenant Header
describe('Tenant Resolver - Missing Header', () => {
  it('should return 400 when x-tenant-slug header is missing', async () => {
    const req = { headers: {}, path: '/api/menu' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    await tenantResolver(req, res, jest.fn());
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: expect.stringContaining('x-tenant-slug'),
      code: 'TENANT_HEADER_MISSING'
    });
  });
});

// Edge Case: Invalid Tenant
describe('Tenant Resolver - Invalid Tenant', () => {
  it('should return 404 when tenant does not exist', async () => {
    const req = { 
      headers: { 'x-tenant-slug': 'nonexistent' },
      path: '/api/menu'
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    await tenantResolver(req, res, jest.fn());
    
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: expect.stringContaining('tidak ditemukan'),
      code: 'TENANT_NOT_FOUND'
    });
  });
});

// Example: Init Script Idempotency
describe('Init Universe Script', () => {
  it('should skip creation when tenant already exists', async () => {
    // First run
    await initUniverse();
    
    // Second run
    const result = await initUniverse();
    
    expect(result.message).toContain('already exists');
    expect(result.skipped).toBe(true);
  });
});
```

### Integration Testing

**Scenarios**:
1. End-to-end request flow with tenant resolution
2. Multi-tenant concurrent access
3. Database connection lifecycle
4. Migration process validation

**Integration Test Example**:

```javascript
describe('End-to-End Tenant Isolation', () => {
  it('should isolate data between tenants in concurrent requests', async () => {
    // Create two tenants with data
    const tenantA = await Tenant.create({ slug: 'tenant-a', ... });
    const tenantB = await Tenant.create({ slug: 'tenant-b', ... });
    
    // Create data for each tenant
    setTenantContext({ id: tenantA._id, slug: 'tenant-a' });
    await MenuItem.create({ name: 'Item A' });
    
    setTenantContext({ id: tenantB._id, slug: 'tenant-b' });
    await MenuItem.create({ name: 'Item B' });
    
    // Make concurrent requests
    const [responseA, responseB] = await Promise.all([
      request(app)
        .get('/api/menu')
        .set('x-tenant-slug', 'tenant-a'),
      request(app)
        .get('/api/menu')
        .set('x-tenant-slug', 'tenant-b')
    ]);
    
    // Verify isolation
    expect(responseA.body.data).toHaveLength(1);
    expect(responseA.body.data[0].name).toBe('Item A');
    
    expect(responseB.body.data).toHaveLength(1);
    expect(responseB.body.data[0].name).toBe('Item B');
  });
});
```

### Test Coverage Goals

- **Unit Tests**: 80% code coverage minimum
- **Property Tests**: All 12 core properties implemented
- **Integration Tests**: All critical user flows covered
- **Edge Cases**: All error conditions tested

### Continuous Integration

- Run all tests on every commit
- Fail build if any test fails
- Generate coverage reports
- Run property tests with increased iterations (1000) in CI


## Implementation Considerations

### Migration Path

**Phase 1: Preparation**
1. Backup all existing tenant databases
2. Audit current database usage patterns
3. Identify all models requiring tenant scoping
4. Document current connection logic

**Phase 2: Core Infrastructure**
1. Update `db.js` to single connection
2. Implement `tenantContext.js` with AsyncLocalStorage
3. Create `tenantScopingPlugin.js`
4. Update `tenantResolver.js` middleware

**Phase 3: Model Migration**
1. Add `tenantId` field to all tenant-scoped models
2. Apply tenant scoping plugin to models
3. Create indexes on `tenantId` fields
4. Update compound indexes to include `tenantId`

**Phase 4: Data Migration**
1. Run migration script to copy data from tenant databases to unified database
2. Stamp `tenantId` on all existing documents
3. Validate data integrity
4. Create rollback snapshots

**Phase 5: Code Cleanup**
1. Remove `getTenantDB()` function
2. Remove database switching logic from controllers
3. Update all database connection references
4. Remove unused connection utilities

**Phase 6: Testing & Validation**
1. Run comprehensive test suite
2. Perform manual QA on critical flows
3. Validate tenant isolation
4. Performance testing

**Phase 7: Deployment**
1. Deploy to staging environment
2. Run smoke tests
3. Monitor for issues
4. Deploy to production with rollback plan

### Performance Considerations

**Indexing Strategy**:
- Create index on `tenantId` for all tenant-scoped collections
- Use compound indexes: `{tenantId: 1, createdAt: -1}` for time-based queries
- Use compound indexes: `{tenantId: 1, status: 1}` for status-based queries
- Monitor index usage with `explain()` plans

**Query Optimization**:
- Ensure all queries use `tenantId` index
- Avoid full collection scans
- Use projection to limit returned fields
- Implement pagination for large result sets

**Connection Pooling**:
- Configure appropriate pool size (default: 10)
- Monitor pool utilization
- Adjust based on concurrent load
- Set connection timeout limits

**Caching**:
- Cache tenant lookups (5-minute TTL)
- Cache frequently accessed data
- Invalidate cache on updates
- Use Redis for distributed caching if needed

### Security Considerations

**Tenant Isolation**:
- Never trust client-provided `tenantId`
- Always derive tenant context from authenticated session
- Validate tenant context on every request
- Log all cross-tenant access attempts

**Data Access Control**:
- Implement role-based access control (RBAC)
- Separate admin operations from tenant operations
- Require elevated permissions for cross-tenant access
- Audit all data access

**Input Validation**:
- Validate tenant slug format
- Sanitize all user inputs
- Prevent NoSQL injection
- Use parameterized queries

**Error Handling**:
- Never expose internal errors to clients
- Log detailed errors server-side
- Return generic error messages
- Implement rate limiting

### Monitoring and Observability

**Metrics to Track**:
- Database connection pool utilization
- Query response times per tenant
- Tenant validation success/failure rates
- Cross-tenant access attempts
- Error rates by type
- Request throughput per tenant

**Logging Strategy**:
- Log all tenant context initialization
- Log all tenant validation failures
- Log all security events
- Log all database errors
- Use structured logging (JSON format)
- Include correlation IDs for request tracing

**Alerting**:
- Alert on database connection failures
- Alert on high error rates
- Alert on cross-tenant access attempts
- Alert on performance degradation
- Alert on cache miss rates

**Dashboards**:
- Active tenants and data volume
- Query performance metrics
- Error rates and types
- Connection pool health
- Cache hit rates

### Rollback Strategy

**Rollback Triggers**:
- Data integrity issues detected
- Performance degradation beyond acceptable limits
- Critical bugs in tenant isolation
- High error rates

**Rollback Steps**:
1. Stop accepting new requests
2. Restore database from backup
3. Revert code to previous version
4. Restart application with legacy configuration
5. Validate system health
6. Resume accepting requests

**Rollback Testing**:
- Test rollback procedure in staging
- Document rollback steps
- Assign rollback responsibilities
- Set rollback decision criteria

### Documentation Requirements

**Technical Documentation**:
- Architecture overview with diagrams
- Component specifications
- API documentation
- Database schema documentation
- Migration guide

**Developer Documentation**:
- Setup instructions
- Code examples for common operations
- Testing guide
- Debugging guide
- Troubleshooting guide

**Operations Documentation**:
- Deployment checklist
- Monitoring guide
- Alerting configuration
- Rollback procedures
- Incident response guide


## Deployment Readiness

### Pre-Deployment Checklist

**Infrastructure**:
- [ ] MongoDB 4.4+ installed and configured
- [ ] Database `superkafe_v2` created
- [ ] Database user with appropriate permissions
- [ ] Connection string configured in environment
- [ ] Backup system configured
- [ ] Monitoring tools installed

**Application**:
- [ ] All environment variables set
- [ ] Dependencies installed
- [ ] Database migrations ready
- [ ] Init script tested
- [ ] Health check endpoint working
- [ ] Logging configured

**Testing**:
- [ ] All unit tests passing
- [ ] All property tests passing
- [ ] Integration tests passing
- [ ] Performance tests completed
- [ ] Security audit completed
- [ ] Load testing completed

**Documentation**:
- [ ] Architecture documentation complete
- [ ] API documentation updated
- [ ] Deployment guide written
- [ ] Rollback procedures documented
- [ ] Runbook created

### Environment Variables

Required environment variables for deployment:

```bash
# Database Configuration
MONGODB_URI=mongodb://user:password@host:port/superkafe_v2?authSource=admin

# Application Configuration
NODE_ENV=production
PORT=3000

# Security
JWT_SECRET=<secure-random-string>
SESSION_SECRET=<secure-random-string>

# Monitoring (optional)
SENTRY_DSN=<sentry-dsn>
LOG_LEVEL=info

# Feature Flags (optional)
ENABLE_TENANT_CACHING=true
TENANT_CACHE_TTL=300
```

### Health Check Endpoint

```javascript
// GET /health
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "database": {
    "connected": true,
    "name": "superkafe_v2",
    "responseTime": 5
  },
  "version": "2.0.0"
}
```

### Deployment Steps

**1. Pre-Deployment**
```bash
# Backup current database
mongodump --uri="mongodb://..." --out=/backup/pre-migration

# Run database migrations
npm run migrate

# Verify migrations
npm run migrate:verify
```

**2. Deployment**
```bash
# Pull latest code
git pull origin main

# Install dependencies
npm ci --production

# Run init script (if first deployment)
npm run init:universe

# Start application
pm2 start ecosystem.config.js --env production
```

**3. Post-Deployment**
```bash
# Verify health
curl http://localhost:3000/health

# Check logs
pm2 logs

# Monitor metrics
npm run monitor
```

**4. Smoke Tests**
```bash
# Test tenant resolution
curl -H "x-tenant-slug: negoes" http://localhost:3000/api/menu

# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@negoes.com","password":"admin123"}'

# Test data isolation
npm run test:isolation
```

### Monitoring Setup

**Application Metrics**:
- Request rate and latency
- Error rate by endpoint
- Database query performance
- Memory and CPU usage

**Database Metrics**:
- Connection pool utilization
- Query execution time
- Index usage
- Slow query log

**Business Metrics**:
- Active tenants
- Requests per tenant
- Data volume per tenant
- Feature usage

### Scaling Considerations

**Vertical Scaling**:
- Increase server resources (CPU, RAM)
- Optimize database queries
- Tune connection pool size
- Enable query caching

**Horizontal Scaling**:
- Deploy multiple application instances
- Use load balancer (nginx, HAProxy)
- Ensure AsyncLocalStorage works across instances
- Share session state (Redis)
- Monitor instance health

**Database Scaling**:
- Enable MongoDB replication
- Use read replicas for read-heavy workloads
- Implement sharding if data volume grows
- Optimize indexes for query patterns

### Success Criteria

The deployment is considered successful when:

1. **Functionality**: All critical user flows work correctly
2. **Performance**: Response times meet SLA (< 100ms for typical queries)
3. **Reliability**: Error rate < 0.1%
4. **Security**: No cross-tenant data leakage detected
5. **Monitoring**: All metrics being collected and dashboards working
6. **Documentation**: All documentation updated and accessible

### Post-Deployment Tasks

**Week 1**:
- Monitor error rates and performance
- Review logs for anomalies
- Gather user feedback
- Address critical issues

**Week 2-4**:
- Analyze performance metrics
- Optimize slow queries
- Tune cache configuration
- Update documentation based on learnings

**Month 2+**:
- Review security audit findings
- Plan performance improvements
- Evaluate scaling needs
- Conduct retrospective

---

## Conclusion

The Unified Nexus Architecture transforms SuperKafe from a fragmented multi-database system to a streamlined single-database multitenancy platform. This design provides:

- **Operational Excellence**: Single database simplifies backup, monitoring, and maintenance
- **Developer Productivity**: Automatic tenant scoping eliminates manual filtering and reduces bugs
- **Security**: Built-in tenant isolation prevents cross-tenant data leakage
- **Scalability**: Efficient resource usage and horizontal scaling capability
- **Maintainability**: Clean architecture with clear separation of concerns

The implementation follows industry best practices for multitenancy, leveraging AsyncLocalStorage for context propagation and Mongoose plugins for transparent data scoping. Comprehensive testing strategies ensure correctness and security, while detailed monitoring provides operational visibility.

This architecture positions SuperKafe for sustainable growth and provides a solid foundation for future feature development.

