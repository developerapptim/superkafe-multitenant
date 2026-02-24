# 🏗️ Single Database Architecture - SuperKafe Multitenant

## 📋 Overview

SuperKafe menggunakan **Single Database Architecture** dengan **Tenant Scoping Plugin** untuk isolasi data antar tenant. Ini adalah arsitektur yang cerdas dan efisien untuk aplikasi multitenant dengan skala menengah.

## 🎯 Mengapa Single Database Architecture?

### Keuntungan:
1. **Simplicity** - Satu koneksi database, lebih mudah maintain
2. **Performance** - No connection switching overhead
3. **Cost-effective** - Satu database untuk semua tenant (hemat biaya hosting)
4. **Easier backups** - Backup sekali untuk semua data
5. **Atomic transactions** - Bisa melakukan transaction across tenants jika diperlukan
6. **Easier scaling** - Scale vertical lebih mudah daripada manage multiple databases

### Kapan Menggunakan Single Database?
- ✅ Tenant count: 10-1000 tenants
- ✅ Data per tenant: Small to medium (< 1GB per tenant)
- ✅ Security requirement: Medium (data isolation via application layer)
- ✅ Budget: Limited (shared infrastructure)

### Kapan Menggunakan Multi-Database?
- ❌ Tenant count: > 1000 tenants
- ❌ Data per tenant: Large (> 1GB per tenant)
- ❌ Security requirement: High (regulatory compliance, complete isolation)
- ❌ Budget: High (dedicated infrastructure per tenant)

## 🗄️ Database Structure

### Database: `superkafe_v2`
Satu database utama yang berisi semua data untuk semua tenant.

### Collections

#### 1. Global Collections (Shared)
Collections yang berisi data global (tidak tenant-specific):

- **tenants** - Tenant metadata
  ```javascript
  {
    _id: ObjectId,
    slug: "negoes",           // Unique identifier
    name: "Negoes",
    dbName: "superkafe_v2",   // Always same for single DB
    isActive: true,
    ownerEmail: "admin@negoes.com",
    subscriptionPlan: "trial",
    trialEndsAt: Date,
    createdAt: Date
  }
  ```

- **users** - User accounts (sebelum setup tenant)
  ```javascript
  {
    _id: ObjectId,
    email: "user@example.com",
    password: "hashed",
    name: "User Name",
    authProvider: "local",
    hasCompletedSetup: true,
    tenantId: ObjectId,       // Reference to tenant
    tenantSlug: "negoes"
  }
  ```

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

Contoh document dengan `tenantId`:
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId("699d08bcf06ea7ac08a24c2f"),  // CRITICAL: Tenant isolation
  id: "menu_kopi_susu",
  name: "Kopi Susu",
  price: 15000,
  category: "cat_coffee",
  is_active: true,
  createdAt: Date
}
```

## 🔐 Tenant Isolation Mechanism

### 1. Mongoose Plugin (`tenantScopingPlugin.js`)
Automatically adds `tenantId` to all queries and saves:

```javascript
// Automatically applied to all tenant-scoped models
schema.plugin(tenantScopingPlugin);

// Example: When querying MenuItem
MenuItem.find() 
// Automatically becomes: 
// MenuItem.find({ tenantId: currentTenantId })
```

**How it works:**
- Pre-hook pada `find`, `findOne`, `updateOne`, `deleteOne`, dll
- Automatically inject `tenantId` filter dari tenant context
- Prevents cross-tenant data access at database query level

### 2. Tenant Context (`tenantContext.js`)
Uses AsyncLocalStorage to track current tenant in request context:

```javascript
const { setTenantContext, getTenantContext } = require('../utils/tenantContext');

// Set in middleware
setTenantContext({ id: tenant._id, slug: tenant.slug });

// Retrieved in plugin
const context = getTenantContext();
```

**Benefits:**
- Thread-safe tenant tracking
- No need to pass tenant info through function parameters
- Automatic cleanup after request completes

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

**Security checks:**
- ✅ Validates tenant exists and is active
- ✅ Prevents cross-tenant access (JWT tenant must match header)
- ✅ Logs security violations

## 🔄 Request Flow

### 1. User Login
```
User → POST /api/auth/login
     → UnifiedAuthController.login()
     → Generate JWT with tenantSlug
     → Return token to frontend
```

JWT Token Structure:
```javascript
{
  "id": "employee_mongodb_id",
  "email": "admin@negoes.com",
  "role": "admin",
  "tenant": "negoes",
  "tenantSlug": "negoes",        // CRITICAL: Used by frontend
  "tenantId": "tenant_mongodb_id",
  "tenantDbName": "superkafe_v2",
  "userId": "user_mongodb_id"
}
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
        → Set tenant context (AsyncLocalStorage)
        → Controller executes query
        → Plugin adds tenantId filter automatically
        → Return tenant-specific data
```

## 📊 Data Isolation Examples

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

### Example 3: Cross-Tenant Access Prevention
```javascript
// User A (tenant: negoes) tries to access tenant B's data
// JWT: { tenantSlug: "negoes" }
// Header: x-tenant-slug: "aldykafe"

// tenantResolver middleware detects mismatch:
if (req.user.tenant !== tenant.slug) {
  return res.status(403).json({ 
    message: 'Unauthorized access to tenant data' 
  });
}
```

## 🔧 Configuration

### Environment Variables
```env
# Single database for all tenants
MONGODB_URI=mongodb://root:password@127.0.0.1:27018/superkafe_v2?authSource=admin&directConnection=true

# All tenants share this database
# Isolation is handled by tenantId field + plugin
```

### Model Setup
```javascript
// backend/models/MenuItem.js
const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const MenuItemSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    // ... other fields
});

// CRITICAL: Apply plugin for automatic tenant isolation
MenuItemSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('MenuItem', MenuItemSchema);
```

## 🚀 Initialization

### Run Initialization Script
```bash
node backend/scripts/initSingleDatabase.js
```

This script will:
1. ✅ Create tenant "Negoes" in `tenants` collection
2. ✅ Create user `admin@negoes.com` in `users` collection
3. ✅ Create employee with role `admin` in `employees` collection
4. ✅ Create sample menu items with `tenantId`
5. ✅ Create sample category with `tenantId`

### Login Credentials
```
Email: admin@negoes.com
Password: admin123
```

### Access URLs
```
Frontend: http://localhost:5174/auth/login
Dashboard: http://localhost:5174/negoes/admin/dashboard
```

## 🛡️ Security Considerations

### 1. JWT Token Validation
- ✅ Token must contain valid `tenantSlug`
- ✅ User's tenant must match requested tenant (checked in tenantResolver)

### 2. Cross-Tenant Access Prevention
```javascript
// tenantResolver.js
if (req.user && req.user.tenant && req.user.tenant !== tenant.slug) {
  console.error('[SECURITY] Cross-tenant access attempt detected');
  return res.status(403).json({ message: 'Unauthorized access to tenant data' });
}
```

### 3. Tenant Status Check
- ✅ Only active tenants can access data
- ✅ Inactive tenants are blocked at middleware level

### 4. Plugin-Level Isolation
- ✅ All queries automatically filtered by `tenantId`
- ✅ All saves automatically include `tenantId`
- ✅ No manual filtering needed in controllers

## 🐛 Troubleshooting

### Issue: "Gagal memuat data" di Dashboard

**Possible Causes:**
1. Tenant "negoes" belum dibuat di database
2. Header `x-tenant-slug` tidak dikirim dari frontend
3. JWT token tidak mengandung `tenantSlug`
4. Model tidak menggunakan `tenantScopingPlugin`

**Solutions:**
```bash
# 1. Run initialization script
node backend/scripts/initSingleDatabase.js

# 2. Restart backend server
cd backend
npm start

# 3. Clear browser localStorage
# Open DevTools → Application → Local Storage → Clear All

# 4. Login again with credentials
# Email: admin@negoes.com
# Password: admin123
```

### Issue: Data from wrong tenant appears

**Cause**: Plugin not applied or tenant context not set

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

## 📈 Performance Optimization

### 1. Indexing
```javascript
// Create compound index for tenant-scoped queries
MenuItemSchema.index({ tenantId: 1, id: 1 });
MenuItemSchema.index({ tenantId: 1, category: 1, order: 1 });
```

### 2. Caching
```javascript
// Tenant-specific cache
const customerMenuCache = new Map(); // Map<tenantId, { data, timestamp }>

// Invalidate cache on updates
const invalidateCustomerMenuCache = (tenantId) => {
    customerMenuCache.delete(tenantId);
};
```

### 3. Lean Queries
```javascript
// For read-only queries, use lean() for better performance
const items = await MenuItem.find().lean();
```

## 🎓 Best Practices

### 1. Always Use Mongoose Methods
```javascript
// ✅ GOOD - Plugin applies automatically
const items = await MenuItem.find({ category: 'coffee' });

// ❌ BAD - Bypasses plugin
const items = await MenuItem.collection.find({ category: 'coffee' }).toArray();
```

### 2. Verify Tenant Context in Critical Operations
```javascript
const { getTenantContext } = require('../utils/tenantContext');

const context = getTenantContext();
if (!context || !context.id) {
  throw new Error('Tenant context not available');
}
```

### 3. Log Tenant Info in Errors
```javascript
console.error('[ERROR] Failed to create order', {
  tenantId: req.tenant?.id,
  tenantSlug: req.tenant?.slug,
  error: error.message
});
```

### 4. Use Transactions for Multi-Collection Operations
```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
  await Order.create([orderData], { session });
  await Inventory.updateMany(updates, { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

## 📚 Related Files

- `backend/.env` - Database connection string
- `backend/config/db.js` - Database connection setup
- `backend/middleware/tenantResolver.js` - Tenant resolution middleware
- `backend/plugins/tenantScopingPlugin.js` - Automatic tenant filtering
- `backend/utils/tenantContext.js` - Tenant context management
- `backend/controllers/UnifiedAuthController.js` - JWT token generation
- `frontend/src/services/api.js` - API interceptor for tenant header
- `backend/scripts/initSingleDatabase.js` - Database initialization script

## 🎯 Summary

SuperKafe menggunakan **Single Database Architecture** dengan:
- ✅ Satu database `superkafe_v2` untuk semua tenant
- ✅ Tenant isolation berbasis `tenantId` field
- ✅ Mongoose plugin untuk automatic filtering
- ✅ AsyncLocalStorage untuk tenant context
- ✅ JWT Token dengan `tenantSlug` untuk routing
- ✅ Middleware untuk security checks

Arsitektur ini memberikan balance yang baik antara:
- **Simplicity** - Easy to maintain and scale
- **Performance** - No connection overhead
- **Security** - Application-level isolation
- **Cost** - Shared infrastructure

---

**Last Updated**: 2026-02-24
**Database**: superkafe_v2
**Architecture**: Single Database with Tenant Scoping
