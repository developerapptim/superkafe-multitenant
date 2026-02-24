# Architecture Updates: Unified Nexus Architecture

## Overview

This document describes the architectural transformation from a fragmented multi-database system to the Unified Nexus Architecture with a single database. It serves as a reference for understanding the new architecture and its implications.

**Migration Date**: [To be filled]  
**Architecture Version**: 2.0  
**Previous Architecture**: Multi-Database (1.x)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Comparison](#architecture-comparison)
3. [Core Components](#core-components)
4. [Data Model Changes](#data-model-changes)
5. [API Changes](#api-changes)
6. [Security Model](#security-model)
7. [Performance Characteristics](#performance-characteristics)
8. [Operational Changes](#operational-changes)
9. [Development Workflow](#development-workflow)
10. [Migration Path](#migration-path)

---

## Executive Summary

### What Changed

The SuperKafe platform has migrated from a **multi-database architecture** where each tenant had its own MongoDB database to a **single-database multitenancy architecture** where all tenants share one database (`superkafe_v2`) with application-level isolation.

### Why We Changed

**Problems with Multi-Database Architecture**:
- Database proliferation (hundreds of databases on VPS)
- Complex connection management
- Scattered database switching logic
- Difficult schema migrations
- Resource inefficiency
- Monitoring complexity

**Benefits of Unified Architecture**:
- Single database to backup and maintain
- Simplified connection management
- Automatic tenant isolation via plugin
- Easier schema migrations
- Better resource utilization
- Centralized monitoring

### Impact Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Databases** | N databases (1 per tenant) | 1 database (superkafe_v2) |
| **Connections** | N connection pools | 1 connection pool |
| **Tenant Isolation** | Database-level | Application-level |
| **Data Scoping** | Manual switching | Automatic plugin |
| **Schema Changes** | Apply to N databases | Apply to 1 database |
| **Backups** | N backup operations | 1 backup operation |
| **Monitoring** | N databases to monitor | 1 database to monitor |

---

## Architecture Comparison

### Legacy Architecture (v1.x)

```
┌─────────────────────────────────────────────────────────┐
│                    Express Application                   │
├─────────────────────────────────────────────────────────┤
│  Request → getTenantDB(slug) → Switch Connection        │
│  ↓                                                       │
│  Controller → Query with tenant-specific connection     │
└─────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                  ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ superkafe_   │  │ superkafe_   │  │ superkafe_   │
│   negoes     │  │   tenant2    │  │   tenant3    │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Characteristics**:
- Dynamic database creation per tenant
- Connection switching in controllers
- Manual tenant filtering
- Database-level isolation
- Complex connection management

### Unified Architecture (v2.0)

```
┌─────────────────────────────────────────────────────────┐
│                    Express Application                   │
├─────────────────────────────────────────────────────────┤
│  Request → Tenant Resolver → Set AsyncLocalStorage      │
│  ↓                                                       │
│  Controller → Query (plugin auto-injects tenantId)      │
└─────────────────────────────────────────────────────────┘
                          ↓
                  ┌──────────────┐
                  │ superkafe_v2 │
                  ├──────────────┤
                  │ tenants      │
                  │ users        │
                  │ employees    │ ← tenantId field
                  │ menuitems    │ ← tenantId field
                  │ orders       │ ← tenantId field
                  │ tables       │ ← tenantId field
                  └──────────────┘
```

**Characteristics**:
- Single database for all tenants
- Tenant context via AsyncLocalStorage
- Automatic tenant filtering via plugin
- Application-level isolation
- Centralized connection management

---

## Core Components

### 1. Database Connection Module

**File**: `backend/config/db.js`

**Purpose**: Centralized database connection management

**Key Changes**:
- ✅ Single connection to `superkafe_v2`
- ✅ Removed `getTenantDB()` function
- ✅ Removed `closeTenantDB()` function
- ✅ Removed connection caching logic
- ✅ Simplified error handling

**Usage**:
```javascript
const mongoose = require('mongoose');

// Connect to unified database
await mongoose.connect(process.env.MONGODB_URI);

// All models use this connection automatically
const items = await MenuItem.find({});
```

### 2. Tenant Context Module

**File**: `backend/utils/tenantContext.js`

**Purpose**: Manage tenant context using AsyncLocalStorage

**Key Features**:
- Store tenant information per async execution
- Retrieve context without parameter passing
- Automatic context propagation through async chains

**Usage**:
```javascript
const { setTenantContext, getTenantContext } = require('../utils/tenantContext');

// Set context (done by middleware)
setTenantContext({
  id: tenant._id.toString(),
  slug: tenant.slug,
  name: tenant.name,
  dbName: 'superkafe_v2'
});

// Get context anywhere in async chain
const context = getTenantContext();
console.log(context.slug); // 'negoes'
```

### 3. Tenant Resolver Middleware

**File**: `backend/middleware/tenantResolver.js`

**Purpose**: Validate tenant and establish context

**Key Features**:
- Extract tenant slug from `x-tenant-slug` header
- Validate tenant exists and is active
- Store context in AsyncLocalStorage
- Cache tenant lookups (5-minute TTL)
- Security logging

**Usage**:
```javascript
const tenantResolver = require('../middleware/tenantResolver');

// Apply to tenant-scoped routes
router.use('/api/menu', tenantResolver, menuRoutes);
router.use('/api/orders', tenantResolver, orderRoutes);
```

### 4. Tenant Scoping Plugin

**File**: `backend/plugins/tenantScopingPlugin.js`

**Purpose**: Automatically inject tenantId filters

**Key Features**:
- Auto-stamp tenantId on document creation
- Auto-inject tenantId filter on queries
- Prevent tenantId modification
- Validate tenant context exists

**Usage**:
```javascript
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const MenuItemSchema = new mongoose.Schema({
  name: String,
  price: Number,
  // tenantId added automatically by plugin
});

// Apply plugin
MenuItemSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('MenuItem', MenuItemSchema);
```

---

## Data Model Changes

### Schema Changes

All tenant-scoped models now include a `tenantId` field:

```javascript
{
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  // ... other fields
}
```

### Index Changes

**New Indexes**:
- `tenantId` (single field index on all tenant-scoped collections)
- `{tenantId: 1, createdAt: -1}` (compound index for time-based queries)
- `{tenantId: 1, status: 1}` (compound index for status-based queries)

**Verification**:
```bash
node scripts/verifyIndexes.js
```

### Models Requiring Tenant Scoping

✅ **Tenant-Scoped Models** (have tenantId):
- Employee
- MenuItem
- Category
- Order
- Table
- CashTransaction
- Inventory
- Customer
- Reservation
- Report

❌ **Global Models** (no tenantId):
- User (pre-tenant authentication)
- Tenant (tenant registry)

### Data Migration

All existing data was migrated with:
1. Copy from source tenant database
2. Stamp with appropriate tenantId
3. Validate data integrity
4. Verify tenant isolation

---

## API Changes

### Request Headers

**New Required Header** for tenant-scoped endpoints:

```http
x-tenant-slug: negoes
```

**Example**:
```bash
curl -H "x-tenant-slug: negoes" \
     -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/menu
```

### Error Responses

**New Error Codes**:

| Code | Status | Description |
|------|--------|-------------|
| `TENANT_HEADER_MISSING` | 400 | Missing x-tenant-slug header |
| `TENANT_NOT_FOUND` | 404 | Tenant does not exist |
| `TENANT_INACTIVE` | 403 | Tenant is not active |
| `CROSS_TENANT_ACCESS` | 403 | Attempting to access another tenant's data |
| `TENANT_CONTEXT_MISSING` | 500 | No tenant context for query |

### Endpoint Changes

**No Breaking Changes** to endpoint URLs or request/response formats.

**Internal Changes**:
- Controllers no longer call `getTenantDB()`
- Queries automatically scoped by plugin
- No manual tenantId filtering needed

**Before (v1.x)**:
```javascript
async function getMenuItems(req, res) {
  const db = await getTenantDB(req.params.tenant);
  const MenuItem = db.model('MenuItem');
  const items = await MenuItem.find({});
  res.json({ data: items });
}
```

**After (v2.0)**:
```javascript
async function getMenuItems(req, res) {
  // Plugin automatically filters by tenantId
  const items = await MenuItem.find({});
  res.json({ data: items });
}
```

---

## Security Model

### Tenant Isolation

**Isolation Level**: Application-level (previously database-level)

**Isolation Mechanism**:
1. Tenant Resolver validates tenant identity
2. Tenant context stored in AsyncLocalStorage
3. Plugin injects tenantId filter on all queries
4. Cross-tenant access attempts logged and blocked

**Security Properties**:
- ✅ Tenant A cannot query Tenant B's data
- ✅ Tenant A cannot modify Tenant B's data
- ✅ Tenant A cannot delete Tenant B's data
- ✅ tenantId field is immutable after creation
- ✅ All cross-tenant attempts are logged

### Security Testing

**Property-Based Tests**:
- Cross-tenant access prevention
- Concurrent multi-tenant isolation
- Tenant context propagation

**Integration Tests**:
- End-to-end tenant isolation
- Multi-tenant concurrent access
- Security event logging

**Verification**:
```bash
npm run test:isolation
npm run test:security
```

### Security Monitoring

**Logged Events**:
- Tenant validation failures
- Cross-tenant access attempts
- Missing tenant context errors
- Tenant context initialization

**Alert Triggers**:
- High rate of cross-tenant access attempts
- Repeated tenant validation failures
- Missing tenant context in production

---

## Performance Characteristics

### Query Performance

**Baseline**: < 100ms for typical queries

**Optimization Strategies**:
- Indexes on tenantId field
- Compound indexes for common query patterns
- Connection pooling
- Query result caching

**Performance Testing**:
```bash
node scripts/verifyQueryPerformance.js
```

### Connection Pooling

**Configuration**:
```javascript
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 20,
  minPoolSize: 5,
  maxIdleTimeMS: 30000
});
```

**Monitoring**:
```bash
node scripts/monitorConnectionPool.js
```

### Scalability

**Horizontal Scaling**:
- ✅ Multiple application instances supported
- ✅ Shared database connection pool
- ✅ AsyncLocalStorage works across instances
- ✅ No shared state between instances

**Vertical Scaling**:
- ✅ Increase connection pool size
- ✅ Optimize indexes
- ✅ Add query caching
- ✅ Use read replicas

---

## Operational Changes

### Backup Strategy

**Before (v1.x)**:
```bash
# Backup each tenant database separately
for db in superkafe_*; do
  mongodump --db=$db --out=/backup/$db
done
```

**After (v2.0)**:
```bash
# Single backup operation
mongodump --uri="$MONGODB_URI" --out=/backup/superkafe_v2
```

**Benefits**:
- Faster backup (1 operation vs N operations)
- Simpler restore process
- Consistent point-in-time snapshot
- Reduced storage requirements

### Monitoring

**Before (v1.x)**:
- Monitor N databases
- Track N connection pools
- Aggregate metrics across databases

**After (v2.0)**:
- Monitor 1 database
- Track 1 connection pool
- Centralized metrics

**Monitoring Tools**:
```bash
# Connection pool metrics
node scripts/monitorConnectionPool.js

# Query performance
node scripts/verifyQueryPerformance.js

# Health check
curl http://localhost:3000/health
```

### Schema Migrations

**Before (v1.x)**:
```bash
# Apply migration to each tenant database
for tenant in negoes tenant2 tenant3; do
  node scripts/migrate.js --tenant=$tenant
done
```

**After (v2.0)**:
```bash
# Single migration operation
node scripts/migrate.js
```

**Benefits**:
- Faster migrations
- Consistent schema across tenants
- Easier rollback
- Reduced complexity

---

## Development Workflow

### Local Development Setup

**1. Start MongoDB**:
```bash
mongod --dbpath=/data/db
```

**2. Initialize Database**:
```bash
cd backend
node scripts/initUniverse.js
```

**3. Start Application**:
```bash
npm run dev
```

**4. Test with Tenant Header**:
```bash
curl -H "x-tenant-slug: negoes" http://localhost:3000/api/menu
```

### Creating New Models

**Template**:
```javascript
const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const ExampleSchema = new mongoose.Schema({
  // tenantId added automatically by plugin
  name: String,
  description: String,
  // ... other fields
}, { timestamps: true });

// Apply tenant scoping plugin
ExampleSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('Example', ExampleSchema);
```

**Checklist**:
- [ ] Import tenantScopingPlugin
- [ ] Apply plugin to schema
- [ ] Do NOT manually add tenantId field (plugin adds it)
- [ ] Create indexes including tenantId
- [ ] Write tests for tenant isolation

### Writing Controllers

**Template**:
```javascript
const Example = require('../models/Example');

exports.getExamples = async (req, res) => {
  try {
    // Plugin automatically filters by tenantId
    const examples = await Example.find({});
    
    res.json({
      success: true,
      data: examples
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.createExample = async (req, res) => {
  try {
    // Plugin automatically stamps tenantId
    const example = new Example(req.body);
    await example.save();
    
    res.status(201).json({
      success: true,
      data: example
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
```

**Best Practices**:
- ✅ Let plugin handle tenantId automatically
- ✅ Don't manually filter by tenantId
- ✅ Don't manually set tenantId
- ✅ Trust the plugin for isolation
- ❌ Don't bypass plugin with raw queries
- ❌ Don't use `setOptions({ skipTenantFilter: true })`

### Testing

**Unit Tests**:
```javascript
const { setTenantContext } = require('../utils/tenantContext');

describe('Example Controller', () => {
  beforeEach(() => {
    // Set tenant context for tests
    setTenantContext({
      id: tenant._id.toString(),
      slug: 'test-tenant',
      name: 'Test Tenant',
      dbName: 'superkafe_v2'
    });
  });
  
  it('should return only tenant data', async () => {
    const examples = await Example.find({});
    
    examples.forEach(ex => {
      expect(ex.tenantId.toString()).toBe(tenant._id.toString());
    });
  });
});
```

**Property Tests**:
```javascript
const fc = require('fast-check');

it('should isolate data between tenants', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom(tenantA._id, tenantB._id),
      async (tenantId) => {
        setTenantContext({ id: tenantId, slug: 'test' });
        
        const examples = await Example.find({});
        
        examples.forEach(ex => {
          expect(ex.tenantId.toString()).toBe(tenantId.toString());
        });
      }
    ),
    { numRuns: 100 }
  );
});
```

---

## Migration Path

### Pre-Migration

1. **Backup all databases**
2. **Audit current database usage**
3. **Test migration on staging**
4. **Prepare rollback plan**

### Migration Steps

1. **Stop application**
2. **Create unified database**
3. **Run init script**
4. **Migrate tenant data**
5. **Validate data integrity**
6. **Deploy new code**
7. **Start application**
8. **Verify functionality**

### Post-Migration

1. **Monitor for 24-48 hours**
2. **Address any issues**
3. **Optimize performance**
4. **Update documentation**
5. **Plan legacy cleanup**

### Rollback

If critical issues occur:
1. **Stop application**
2. **Restore legacy databases**
3. **Revert code**
4. **Restart with legacy system**
5. **Investigate and fix issues**

See [ROLLBACK_PROCEDURES.md](./ROLLBACK_PROCEDURES.md) for details.

---

## Future Considerations

### Potential Enhancements

1. **Read Replicas**: Use MongoDB read replicas for read-heavy workloads
2. **Sharding**: Implement sharding if data volume grows significantly
3. **Caching Layer**: Add Redis for frequently accessed data
4. **Query Optimization**: Continuous monitoring and optimization
5. **Archive Strategy**: Archive old tenant data to separate collection

### Scaling Strategy

**Current Capacity**: Supports 100+ tenants with current infrastructure

**Scaling Triggers**:
- Database size > 100GB
- Query response time > 100ms
- Connection pool utilization > 80%
- CPU usage > 70%

**Scaling Options**:
1. Vertical: Increase server resources
2. Horizontal: Add application instances
3. Database: Add read replicas
4. Sharding: Partition data by tenantId

---

## References

### Documentation

- [Migration Guide](./MIGRATION_GUIDE.md)
- [Rollback Procedures](./ROLLBACK_PROCEDURES.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)

### Code References

- Database Connection: `backend/config/db.js`
- Tenant Context: `backend/utils/tenantContext.js`
- Tenant Resolver: `backend/middleware/tenantResolver.js`
- Tenant Plugin: `backend/plugins/tenantScopingPlugin.js`

### Design Documents

- Requirements: `.kiro/specs/unified-nexus-architecture/requirements.md`
- Design: `.kiro/specs/unified-nexus-architecture/design.md`
- Tasks: `.kiro/specs/unified-nexus-architecture/tasks.md`

---

## Glossary

- **Tenant**: Individual restaurant using the platform
- **Tenant Scoping**: Automatic filtering of data by tenant
- **AsyncLocalStorage**: Node.js API for context propagation
- **Tenant Context**: Current tenant information for request
- **Plugin**: Mongoose plugin for automatic tenant scoping
- **Unified Database**: Single database (superkafe_v2) for all tenants
- **Legacy Database**: Old per-tenant databases (superkafe_*)

---

## Change Log

### Version 2.0 (2024-01-15)

**Major Changes**:
- Migrated from multi-database to single-database architecture
- Implemented automatic tenant scoping via plugin
- Added AsyncLocalStorage for context propagation
- Centralized database connection management
- Removed legacy database switching logic

**Breaking Changes**:
- Requires `x-tenant-slug` header on tenant-scoped endpoints
- Database connection API changed (removed `getTenantDB()`)
- All models require tenant scoping plugin

**Migration Required**: Yes (see MIGRATION_GUIDE.md)

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-15  
**Maintained By**: Engineering Team  
**Review Frequency**: After major architecture changes
