# Database Architecture - SuperKafe Multitenant

## Overview
SuperKafe menggunakan **Multi-Database Architecture** untuk multitenant system. Setiap tenant memiliki database terpisah untuk isolasi data yang lebih kuat.

## Database Structure

### Main Database: `superkafe_main`
Database utama yang berisi metadata tenant dan user accounts.

#### Collections:
- **tenants** - Master list of all tenants
  - `slug`, `name`, `dbName`, `isActive`
  - `ownerEmail`, `subscriptionPlan`, `trialEndsAt`
  
- **users** - User accounts (before tenant setup)
  - `email`, `password`, `name`, `authProvider`
  - `hasCompletedSetup`, `tenantId`, `tenantSlug`

### Tenant Databases: `superkafe_{slug}`
Setiap tenant memiliki database terpisah dengan nama `superkafe_{slug}`.

#### Example:
- `superkafe_negoes` - Database untuk tenant "negoes"
- `superkafe_aldykafe` - Database untuk tenant "aldykafe"
- `superkafe_warkop_pusat` - Database untuk tenant "warkop-pusat"

#### Collections per Tenant Database:
- **employees** - Employee data
- **menuitems** - Menu items
- **categories** - Categories
- **orders** - Orders
- **tables** - Tables
- **ingredients** - Ingredients
- **recipes** - Recipes
- **customers** - Customers
- **expenses** - Expenses
- **operationalexpenses** - Operational expenses
- **cashtransactions** - Cash transactions
- **shifts** - Shifts
- **attendances** - Attendances
- **reservations** - Reservations
- **feedbacks** - Feedbacks
- **vouchers** - Vouchers
- **settings** - Settings
- **auditlogs** - Audit logs
- **activitylogs** - Activity logs

## Database Connection Flow

### 1. Main Database Connection
```javascript
// backend/config/db.js
const connectMainDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI);
  // Connects to: superkafe_main
};
```

### 2. Tenant Database Connection (Dynamic)
```javascript
// backend/config/db.js
const getTenantDB = async (dbName) => {
  // Example: dbName = "superkafe_negoes"
  const tenantURI = `mongodb://root:pass@host:port/${dbName}?authSource=admin`;
  const tenantDB = mongoose.createConnection(tenantURI);
  return tenantDB;
};
```

### 3. Connection Pooling
- Tenant connections are cached in memory
- Reused for subsequent requests to same tenant
- Automatically cleaned up on disconnect

## JWT Token Structure

### Before Setup (No Tenant)
```json
{
  "userId": "673abc123...",
  "email": "user@example.com",
  "hasCompletedSetup": false,
  "tenantSlug": null
}
```

### After Setup (With Tenant)
```json
{
  "id": "673def456...",
  "email": "user@example.com",
  "role": "admin",
  "tenant": "negoes",
  "tenantSlug": "negoes",  // Used by frontend to set x-tenant-slug header
  "tenantId": "673ghi789...",
  "tenantDbName": "superkafe_negoes",  // Tenant database name
  "userId": "673abc123..."
}
```

## Request Flow

### 1. User Login
```
User → POST /api/auth/login
     → UnifiedAuthController.login()
     → Find user in superkafe_main.users
     → Find tenant in superkafe_main.tenants
     → Get employee from superkafe_{slug}.employees
     → Generate JWT with tenantSlug and tenantDbName
     → Return token to frontend
```

### 2. Frontend Stores Token
```javascript
localStorage.setItem('token', token);
localStorage.setItem('tenant_slug', user.tenantSlug);
```

### 3. API Request with Tenant Header
```javascript
// api.js interceptor
const decoded = decodeJWT(token);
if (decoded.tenantSlug) {
  config.headers['x-tenant-slug'] = decoded.tenantSlug;
}
```

### 4. Backend Processes Request
```
Request → tenantResolver middleware
        → Extract x-tenant-slug header
        → Find tenant in superkafe_main.tenants
        → Get tenant dbName (e.g., "superkafe_negoes")
        → Connect to tenant database
        → Controller executes query on tenant DB
        → Return tenant-specific data
```

## Data Isolation

### Strong Isolation
Each tenant has completely separate database:
- No risk of cross-tenant data leak
- Can have different schemas per tenant
- Can backup/restore individual tenants
- Can scale tenants independently

### Example: Get Menu Items
```javascript
// Frontend
const response = await api.get('/menu');
// Header: x-tenant-slug: negoes

// Backend (tenantResolver middleware)
const tenant = await Tenant.findOne({ slug: 'negoes' }); // From superkafe_main
const tenantDB = await getTenantDB(tenant.dbName); // Connect to superkafe_negoes

// Backend (MenuController)
const MenuItemModel = tenantDB.model('MenuItem', MenuItemSchema);
const items = await MenuItemModel.find(); // Query superkafe_negoes.menuitems

// Result: Only menu items from superkafe_negoes database
```

## Security Considerations

### 1. JWT Token Validation
- Token must contain valid `tenantSlug`
- User's tenant must match requested tenant

### 2. Cross-Tenant Access Prevention
```javascript
// tenantResolver.js
if (req.user && req.user.tenant && req.user.tenant !== tenant.slug) {
  console.error('[SECURITY] Cross-tenant access attempt detected');
  return res.status(403).json({ message: 'Unauthorized access to tenant data' });
}
```

### 3. Tenant Status Check
- Only active tenants can access data
- Inactive tenants are blocked at middleware level

### 4. Database-Level Isolation
- Each tenant has separate database
- No shared collections between tenants
- MongoDB user permissions can be set per database

## Configuration

### Environment Variables
```env
# Main database (tenant metadata)
MONGODB_URI=mongodb://root:password@127.0.0.1:27018/superkafe_main?authSource=admin

# Tenant databases are created dynamically
# Format: superkafe_{slug}
# Example: superkafe_negoes, superkafe_aldykafe
```

### Database Naming Convention
```
Main DB: superkafe_main
Tenant DB: superkafe_{slug}

Examples:
- Tenant slug: "negoes" → Database: "superkafe_negoes"
- Tenant slug: "aldykafe" → Database: "superkafe_aldykafe"
- Tenant slug: "warkop-pusat" → Database: "superkafe_warkop_pusat"
```

## Troubleshooting

### Issue: "Tenant tidak ditemukan atau tidak aktif"
**Cause**: Backend connected to wrong main database
**Solution**:
1. Check `.env` file: `MONGODB_URI` should point to `superkafe_main`
2. Restart backend server
3. Verify tenant exists in `superkafe_main.tenants` collection

### Issue: Data from wrong tenant appears
**Cause**: Wrong tenant database connected
**Solution**:
1. Check JWT token contains correct `tenantDbName`
2. Verify `getTenantDB()` is using correct database name
3. Check tenant metadata in `superkafe_main.tenants`

### Issue: Connection pool exhausted
**Cause**: Too many tenant connections open
**Solution**:
1. Increase `maxPoolSize` in `getTenantDB()`
2. Implement connection cleanup on idle
3. Monitor connection count

## Best Practices

### 1. Always Use getTenantDB()
```javascript
// ✅ GOOD - Uses connection pooling
const tenantDB = await getTenantDB(tenant.dbName);
const MenuItemModel = tenantDB.model('MenuItem', MenuItemSchema);

// ❌ BAD - Creates new connection every time
const tenantDB = mongoose.createConnection(tenantURI);
```

### 2. Close Connections on Shutdown
```javascript
// Graceful shutdown
process.on('SIGTERM', async () => {
  await closeAllTenantConnections();
  await mongoose.connection.close();
  process.exit(0);
});
```

### 3. Monitor Connection Health
```javascript
tenantDB.on('error', (err) => {
  console.error(`[DB ERROR] Tenant database error (${dbName}):`, err.message);
  // Implement retry logic or alerting
});
```

### 4. Verify Tenant Context
```javascript
if (!req.tenant || !req.tenant.dbName) {
  throw new Error('Tenant context not available');
}
```

## Migration Notes

### From Single Database to Multi-Database
If migrating from single database (`superkafe_v2`) to multi-database:

1. Create `superkafe_main` database
2. Move `tenants` and `users` collections to `superkafe_main`
3. For each tenant:
   - Create new database `superkafe_{slug}`
   - Copy tenant-specific collections
   - Remove `tenantId` field (no longer needed)
4. Update `.env` to point to `superkafe_main`
5. Restart backend

### From Multi-Database to Single Database
If migrating to single database (not recommended):

1. Create `superkafe_v2` database
2. Copy `tenants` and `users` from `superkafe_main`
3. For each tenant database:
   - Copy all collections to `superkafe_v2`
   - Add `tenantId` field to all documents
4. Implement Mongoose plugin for automatic filtering
5. Update `.env` to point to `superkafe_v2`

## Related Files
- `backend/.env` - Database connection string
- `backend/config/db.js` - Database connection management
- `backend/middleware/tenantResolver.js` - Tenant resolution middleware
- `backend/controllers/UnifiedAuthController.js` - JWT token generation
- `frontend/src/services/api.js` - API interceptor for tenant header

## Summary
SuperKafe menggunakan multi-database architecture dengan `superkafe_main` sebagai database utama untuk metadata tenant, dan `superkafe_{slug}` sebagai database terpisah untuk setiap tenant. JWT Token membawa `tenantSlug` dan `tenantDbName` yang digunakan untuk routing request ke database tenant yang benar. Setiap tenant memiliki isolasi data yang kuat dengan database terpisah.

## Database Structure

### Main Database: `superkafe_v2`
Satu database utama yang berisi semua data untuk semua tenant.

### Collections

#### 1. Global Collections (Shared)
Collections yang berisi data global (tidak tenant-specific):

- **users** - User accounts (sebelum setup tenant)
  - `email`, `password`, `name`, `authProvider`
  - `hasCompletedSetup`, `tenantId`, `tenantSlug`
  - Digunakan untuk authentication sebelum user setup tenant

- **tenants** - Tenant metadata
  - `slug`, `name`, `dbName`, `isActive`
  - `ownerEmail`, `subscriptionPlan`, `trialEndsAt`
  - Master list of all tenants

#### 2. Tenant-Scoped Collections
Collections yang berisi data tenant-specific (dengan `tenantId` field):

- **employees** - Employee data per tenant
- **menuitems** - Menu items per tenant
- **categories** - Categories per tenant
- **orders** - Orders per tenant
- **tables** - Tables per tenant
- **ingredients** - Ingredients per tenant
- **recipes** - Recipes per tenant
- **customers** - Customers per tenant
- **expenses** - Expenses per tenant
- **operationalexpenses** - Operational expenses per tenant
- **cashtransactions** - Cash transactions per tenant
- **shifts** - Shifts per tenant
- **attendances** - Attendances per tenant
- **reservations** - Reservations per tenant
- **feedbacks** - Feedbacks per tenant
- **vouchers** - Vouchers per tenant
- **settings** - Settings per tenant
- **auditlogs** - Audit logs per tenant
- **activitylogs** - Activity logs per tenant

## Tenant Isolation Mechanism

### 1. Mongoose Plugin (`tenantScopingPlugin.js`)
Automatically adds `tenantId` to all queries and saves:

```javascript
// Automatically applied to all tenant-scoped models
schema.plugin(tenantScopingPlugin);

// Example: When querying MenuItem
MenuItem.find() // Automatically becomes: MenuItem.find({ tenantId: currentTenantId })
```

### 2. Tenant Context (`tenantContext.js`)
Uses AsyncLocalStorage to track current tenant in request context:

```javascript
const { setTenantContext, getTenantContext } = require('../utils/tenantContext');

// Set in middleware
setTenantContext({ id: tenant._id, slug: tenant.slug });

// Retrieved in plugin
const context = getTenantContext();
```

### 3. Tenant Resolver Middleware (`tenantResolver.js`)
Resolves tenant from request header and sets context:

```javascript
// Extract tenant slug from header
const tenantSlug = req.headers['x-tenant-slug'];

// Find tenant in database
const tenant = await Tenant.findOne({ slug: tenantSlug, isActive: true });

// Set tenant context for this request
setTenantContext({ id: tenant._id, slug: tenant.slug });

// Attach to request object
req.tenant = { id: tenant._id, slug: tenant.slug };
```

## JWT Token Structure

### Before Setup (No Tenant)
```json
{
  "userId": "user_mongodb_id",
  "email": "user@example.com",
  "hasCompletedSetup": false,
  "tenantSlug": null
}
```

### After Setup (With Tenant)
```json
{
  "id": "employee_mongodb_id",
  "email": "user@example.com",
  "role": "admin",
  "tenant": "negoes",
  "tenantSlug": "negoes",  // CRITICAL: Used by frontend to set x-tenant-slug header
  "tenantId": "tenant_mongodb_id",
  "tenantDbName": "superkafe_v2",
  "userId": "user_mongodb_id"
}
```

## Request Flow

### 1. User Login
```
User → POST /api/auth/login
     → UnifiedAuthController.login()
     → Generate JWT with tenantSlug
     → Return token to frontend
```

### 2. Frontend Stores Token
```javascript
localStorage.setItem('token', token);
localStorage.setItem('tenant_slug', user.tenantSlug);
```

### 3. API Request with Tenant Header
```javascript
// api.js interceptor
const decoded = decodeJWT(token);
if (decoded.tenantSlug) {
  config.headers['x-tenant-slug'] = decoded.tenantSlug;
}
```

### 4. Backend Processes Request
```
Request → tenantResolver middleware
        → Extract x-tenant-slug header
        → Find tenant in database
        → Set tenant context
        → Controller executes query
        → Plugin adds tenantId filter
        → Return tenant-specific data
```

## Data Isolation Examples

### Example 1: Get Menu Items
```javascript
// Frontend
const response = await api.get('/menu');
// Header: x-tenant-slug: negoes

// Backend (MenuController)
const items = await MenuItem.find(); // No manual tenantId filter needed!

// Plugin automatically adds:
// MenuItem.find({ tenantId: ObjectId("tenant_negoes_id") })

// Result: Only menu items for "negoes" tenant
```

### Example 2: Create Order
```javascript
// Frontend
const response = await api.post('/orders', orderData);
// Header: x-tenant-slug: negoes

// Backend (OrderController)
const order = new Order(orderData);
await order.save();

// Plugin automatically adds tenantId before save:
// order.tenantId = ObjectId("tenant_negoes_id")

// Result: Order saved with correct tenantId
```

## Security Considerations

### 1. JWT Token Validation
- Token must contain valid `tenantSlug`
- User's tenant must match requested tenant (checked in tenantResolver)

### 2. Cross-Tenant Access Prevention
```javascript
// tenantResolver.js
if (req.user && req.user.tenant && req.user.tenant !== tenant.slug) {
  console.error('[SECURITY] Cross-tenant access attempt detected');
  return res.status(403).json({ message: 'Unauthorized access to tenant data' });
}
```

### 3. Tenant Status Check
- Only active tenants can access data
- Inactive tenants are blocked at middleware level

## Migration from Multi-Database

### Old Architecture (Multi-Database)
```
superkafe_main (metadata)
  └── tenants collection

superkafe_negoes (tenant data)
  ├── employees
  ├── menuitems
  └── ...

superkafe_aldykafe (tenant data)
  ├── employees
  ├── menuitems
  └── ...
```

### New Architecture (Single Database)
```
superkafe_v2 (all data)
  ├── tenants (global)
  ├── users (global)
  ├── employees (tenantId: negoes)
  ├── employees (tenantId: aldykafe)
  ├── menuitems (tenantId: negoes)
  ├── menuitems (tenantId: aldykafe)
  └── ...
```

### Benefits of Single Database
1. **Simpler Connection Management**: No need to manage multiple database connections
2. **Easier Backups**: Single database to backup
3. **Better Performance**: No connection switching overhead
4. **Simpler Queries**: No need to switch database context
5. **Easier Maintenance**: Single schema to manage

## Troubleshooting

### Issue: Data from wrong tenant appears
**Cause**: tenantId not set correctly or plugin not applied
**Solution**: 
1. Check if model has `tenantScopingPlugin` applied
2. Verify tenant context is set in middleware
3. Check JWT token contains correct `tenantSlug`

### Issue: "Tenant tidak ditemukan" error
**Cause**: x-tenant-slug header not sent or tenant not in database
**Solution**:
1. Verify JWT token contains `tenantSlug` field
2. Check api.js interceptor is setting header correctly
3. Verify tenant exists in `tenants` collection with `isActive: true`

### Issue: Cross-tenant data leak
**Cause**: Query bypassing plugin (using native MongoDB methods)
**Solution**:
1. Always use Mongoose methods (find, findOne, etc.)
2. Never use `Model.collection.find()` (bypasses plugin)
3. Add manual `tenantId` filter if using aggregation

## Best Practices

### 1. Always Use Mongoose Methods
```javascript
// ✅ GOOD - Plugin applies automatically
const items = await MenuItem.find({ category: 'coffee' });

// ❌ BAD - Bypasses plugin
const items = await MenuItem.collection.find({ category: 'coffee' }).toArray();
```

### 2. Use Lean for Read-Only Queries
```javascript
// For better performance on read-only queries
const items = await MenuItem.find().lean();
```

### 3. Verify Tenant Context in Critical Operations
```javascript
const { getTenantContext } = require('../utils/tenantContext');

const context = getTenantContext();
if (!context || !context.id) {
  throw new Error('Tenant context not available');
}
```

### 4. Log Tenant Info in Errors
```javascript
console.error('[ERROR] Failed to create order', {
  tenantId: req.tenant?.id,
  tenantSlug: req.tenant?.slug,
  error: error.message
});
```

## Related Files
- `backend/.env` - Database connection string
- `backend/config/db.js` - Database connection setup
- `backend/middleware/tenantResolver.js` - Tenant resolution middleware
- `backend/plugins/tenantScopingPlugin.js` - Automatic tenant filtering
- `backend/utils/tenantContext.js` - Tenant context management
- `backend/controllers/UnifiedAuthController.js` - JWT token generation
- `frontend/src/services/api.js` - API interceptor for tenant header

## Summary
SuperKafe menggunakan single database (`superkafe_v2`) dengan tenant isolation berbasis `tenantId` field. JWT Token membawa `tenantSlug` yang digunakan frontend untuk set header `x-tenant-slug`, yang kemudian di-resolve oleh backend middleware menjadi `tenantId` untuk filtering data. Mongoose plugin secara otomatis menambahkan filter `tenantId` pada semua query, memastikan data isolation antar tenant.
