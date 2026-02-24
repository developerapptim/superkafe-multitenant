# Migration Guide: Multi-Database to Unified Nexus Architecture

## Overview

This guide provides comprehensive instructions for migrating the SuperKafe platform from a fragmented multi-database architecture to the Unified Nexus Architecture with a single database (`superkafe_v2`).

**Migration Goal**: Consolidate all tenant data from individual databases into a single MongoDB database while maintaining strict tenant isolation at the application layer.

**Estimated Duration**: 4-6 hours for production migration (depending on data volume)

**Risk Level**: Medium - Requires careful data validation and rollback preparation

---

## Table of Contents

1. [Pre-Migration Preparation](#pre-migration-preparation)
2. [Migration Prerequisites](#migration-prerequisites)
3. [Step-by-Step Migration Process](#step-by-step-migration-process)
4. [Data Validation](#data-validation)
5. [Post-Migration Verification](#post-migration-verification)
6. [Common Issues](#common-issues)

---

## Pre-Migration Preparation

### 1. Backup All Databases

**CRITICAL**: Create complete backups before starting migration.

```bash
# Create backup directory
mkdir -p /backup/pre-migration-$(date +%Y%m%d)
cd /backup/pre-migration-$(date +%Y%m%d)

# Backup all tenant databases
mongodump --uri="mongodb://localhost:27017" --out=./all-databases

# Verify backup integrity
ls -lh all-databases/
```

**Backup Checklist**:
- [ ] All tenant databases backed up
- [ ] Backup files verified (non-zero size)
- [ ] Backup location has sufficient disk space
- [ ] Backup timestamp recorded
- [ ] Backup restoration tested on staging

### 2. Audit Current Database Usage

Identify all tenant databases and their data volume:

```bash
# List all tenant databases
mongo --eval "db.adminCommand('listDatabases').databases.forEach(function(d) { print(d.name + ': ' + d.sizeOnDisk); })"

# Count documents per tenant database
node backend/scripts/auditTenantDatabases.js
```

Create an audit report:
```
Tenant Database Audit Report
Generated: 2024-01-15 10:00:00

Database Name          | Collections | Documents | Size (MB)
--------------------- | ----------- | --------- | ---------
superkafe_negoes      | 12          | 1,234     | 45.2
superkafe_tenant2     | 12          | 567       | 23.1
superkafe_tenant3     | 12          | 890       | 34.5
...
```

### 3. Identify All Models Requiring Tenant Scoping

Review the model audit document:

```bash
cat .kiro/specs/unified-nexus-architecture/MODEL_TENANT_SCOPING_AUDIT.md
```

**Models Requiring Tenant Scoping**:
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

**Models NOT Requiring Tenant Scoping**:
- User (global authentication)
- Tenant (tenant registry)

### 4. Document Current Connection Logic

Search for legacy database connection patterns:

```bash
# Find getTenantDB() usage
grep -r "getTenantDB" backend/ --exclude-dir=node_modules

# Find dynamic database creation
grep -r "createConnection" backend/ --exclude-dir=node_modules

# Find database switching logic
grep -r "useDb\|switchDb" backend/ --exclude-dir=node_modules
```

Document findings for reference during cleanup phase.

---

## Migration Prerequisites

### System Requirements

- **MongoDB Version**: 4.4 or higher
- **Node.js Version**: 14.x or higher
- **Disk Space**: 2x current database size (for safety)
- **RAM**: Minimum 4GB available
- **Backup Storage**: 3x current database size

### Environment Setup

1. **Create Unified Database**:

```bash
# Connect to MongoDB
mongo

# Create superkafe_v2 database
use superkafe_v2

# Create admin user for the database
db.createUser({
  user: "superkafe_admin",
  pwd: "secure_password_here",
  roles: [
    { role: "readWrite", db: "superkafe_v2" },
    { role: "dbAdmin", db: "superkafe_v2" }
  ]
})
```

2. **Update Environment Variables**:

```bash
# Update .env file
MONGODB_URI=mongodb://superkafe_admin:secure_password_here@localhost:27017/superkafe_v2?authSource=superkafe_v2
NODE_ENV=production
```

3. **Install Dependencies**:

```bash
cd backend
npm ci --production
```

4. **Verify Code Updates**:

Ensure all code changes are deployed:
- [ ] `backend/config/db.js` updated for single connection
- [ ] `backend/plugins/tenantScopingPlugin.js` implemented
- [ ] `backend/middleware/tenantResolver.js` updated
- [ ] All models have `tenantId` field and plugin applied
- [ ] Legacy database code removed

---

## Step-by-Step Migration Process

### Phase 1: Infrastructure Setup (30 minutes)

#### Step 1.1: Stop Application

```bash
# Stop all application instances
pm2 stop all

# Verify no processes are running
pm2 list
ps aux | grep node
```

#### Step 1.2: Create Unified Database

```bash
# Run initialization script
cd backend
node scripts/initUniverse.js
```

**Expected Output**:
```
[INFO] Connecting to superkafe_v2...
[INFO] Database connected successfully
[INFO] Creating tenant 'Negoes'...
[SUCCESS] Tenant created: negoes
[INFO] Creating admin user...
[SUCCESS] User created: admin@negoes.com
[INFO] Creating employee record...
[SUCCESS] Employee created
[INFO] Seeding menu data...
[SUCCESS] Created 3 menu items

=== Initialization Complete ===
Tenant: Negoes (negoes)
Admin: admin@negoes.com / admin123
Database: superkafe_v2
```

#### Step 1.3: Verify Database Structure

```bash
# Connect to database
mongo superkafe_v2

# List collections
show collections

# Verify indexes
db.tenants.getIndexes()
db.employees.getIndexes()
db.menuitems.getIndexes()
```

**Expected Collections**:
- tenants
- users
- employees
- menuitems
- categories
- orders
- tables
- cashtransactions

### Phase 2: Data Migration (2-4 hours)

#### Step 2.1: Create Migration Script

Create `backend/scripts/migrateTenantData.js`:

```javascript
const mongoose = require('mongoose');
const { setTenantContext } = require('../utils/tenantContext');

async function migrateTenantData(sourceDatabaseName, targetTenantSlug) {
  console.log(`[INFO] Migrating ${sourceDatabaseName} to tenant ${targetTenantSlug}`);
  
  // 1. Find or create tenant in unified database
  const Tenant = mongoose.model('Tenant');
  let tenant = await Tenant.findOne({ slug: targetTenantSlug });
  
  if (!tenant) {
    tenant = await Tenant.create({
      name: targetTenantSlug.charAt(0).toUpperCase() + targetTenantSlug.slice(1),
      slug: targetTenantSlug,
      dbName: 'superkafe_v2',
      isActive: true,
      status: 'paid'
    });
    console.log(`[INFO] Created tenant: ${tenant.slug}`);
  }
  
  // 2. Set tenant context for data stamping
  setTenantContext({
    id: tenant._id.toString(),
    slug: tenant.slug,
    name: tenant.name,
    dbName: 'superkafe_v2'
  });
  
  // 3. Connect to source database
  const sourceConn = await mongoose.createConnection(
    `mongodb://localhost:27017/${sourceDatabaseName}`,
    { useNewUrlParser: true, useUnifiedTopology: true }
  );
  
  console.log(`[INFO] Connected to source database: ${sourceDatabaseName}`);
  
  // 4. Migrate each collection
  const collections = [
    'employees',
    'menuitems',
    'categories',
    'orders',
    'tables',
    'cashtransactions'
  ];
  
  for (const collectionName of collections) {
    try {
      const sourceCollection = sourceConn.collection(collectionName);
      const count = await sourceCollection.countDocuments();
      
      if (count === 0) {
        console.log(`[SKIP] ${collectionName}: No documents`);
        continue;
      }
      
      console.log(`[INFO] Migrating ${collectionName}: ${count} documents`);
      
      // Get target model
      const modelName = collectionName.charAt(0).toUpperCase() + collectionName.slice(1).slice(0, -1);
      const TargetModel = mongoose.model(modelName);
      
      // Fetch all documents from source
      const documents = await sourceCollection.find({}).toArray();
      
      // Transform and insert into target
      let migrated = 0;
      for (const doc of documents) {
        try {
          // Remove _id to let MongoDB generate new one
          const { _id, ...docData } = doc;
          
          // Add tenantId
          docData.tenantId = tenant._id;
          
          // Create in target database
          await TargetModel.create(docData);
          migrated++;
        } catch (error) {
          console.error(`[ERROR] Failed to migrate document:`, error.message);
        }
      }
      
      console.log(`[SUCCESS] ${collectionName}: ${migrated}/${count} documents migrated`);
      
    } catch (error) {
      console.error(`[ERROR] Failed to migrate ${collectionName}:`, error);
    }
  }
  
  // 5. Close source connection
  await sourceConn.close();
  
  console.log(`[SUCCESS] Migration complete for ${sourceDatabaseName}`);
  
  return {
    tenant: tenant.slug,
    success: true
  };
}

// Main execution
async function main() {
  try {
    // Connect to unified database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[INFO] Connected to unified database');
    
    // List of tenant databases to migrate
    const tenantDatabases = [
      { source: 'superkafe_negoes', slug: 'negoes' },
      { source: 'superkafe_tenant2', slug: 'tenant2' },
      { source: 'superkafe_tenant3', slug: 'tenant3' },
      // Add more tenants here
    ];
    
    // Migrate each tenant
    for (const { source, slug } of tenantDatabases) {
      await migrateTenantData(source, slug);
    }
    
    console.log('[SUCCESS] All tenants migrated successfully');
    
  } catch (error) {
    console.error('[FATAL] Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
```

#### Step 2.2: Run Migration Script

```bash
# Dry run first (add --dry-run flag to script)
node scripts/migrateTenantData.js --dry-run

# Review dry run output
# If everything looks good, run actual migration
node scripts/migrateTenantData.js
```

**Monitor Progress**:
```
[INFO] Migrating superkafe_negoes to tenant negoes
[INFO] Connected to source database: superkafe_negoes
[INFO] Migrating employees: 5 documents
[SUCCESS] employees: 5/5 documents migrated
[INFO] Migrating menuitems: 45 documents
[SUCCESS] menuitems: 45/45 documents migrated
[INFO] Migrating orders: 234 documents
[SUCCESS] orders: 234/234 documents migrated
...
[SUCCESS] Migration complete for superkafe_negoes
```

#### Step 2.3: Log Migration Results

Create a migration log:

```bash
# Save migration output
node scripts/migrateTenantData.js 2>&1 | tee migration-$(date +%Y%m%d-%H%M%S).log
```

---

### Phase 3: Data Validation (30-60 minutes)

#### Step 3.1: Verify Document Counts

```bash
# Run validation script
node scripts/validateMigration.js
```

Create `backend/scripts/validateMigration.js`:

```javascript
const mongoose = require('mongoose');

async function validateMigration() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const Tenant = mongoose.model('Tenant');
  const tenants = await Tenant.find({});
  
  console.log('=== Migration Validation Report ===\n');
  
  for (const tenant of tenants) {
    console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
    console.log(`Tenant ID: ${tenant._id}`);
    
    // Count documents per collection
    const models = ['Employee', 'MenuItem', 'Category', 'Order', 'Table', 'CashTransaction'];
    
    for (const modelName of models) {
      try {
        const Model = mongoose.model(modelName);
        const count = await Model.countDocuments({ tenantId: tenant._id });
        console.log(`  ${modelName}: ${count} documents`);
      } catch (error) {
        console.log(`  ${modelName}: Model not found`);
      }
    }
    
    console.log('');
  }
  
  await mongoose.disconnect();
}

validateMigration();
```

**Expected Output**:
```
=== Migration Validation Report ===

Tenant: Negoes (negoes)
Tenant ID: 507f1f77bcf86cd799439011
  Employee: 5 documents
  MenuItem: 45 documents
  Category: 8 documents
  Order: 234 documents
  Table: 12 documents
  CashTransaction: 156 documents
```

#### Step 3.2: Verify Data Integrity

Check for data consistency:

```bash
# Verify all documents have tenantId
mongo superkafe_v2 --eval "
  db.employees.find({ tenantId: { \$exists: false } }).count()
  db.menuitems.find({ tenantId: { \$exists: false } }).count()
  db.orders.find({ tenantId: { \$exists: false } }).count()
"

# Should return 0 for all collections
```

#### Step 3.3: Verify Tenant Isolation

```bash
# Run isolation test
node scripts/testTenantIsolation.js
```

Create `backend/scripts/testTenantIsolation.js`:

```javascript
const mongoose = require('mongoose');
const { setTenantContext } = require('../utils/tenantContext');

async function testIsolation() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const Tenant = mongoose.model('Tenant');
  const MenuItem = mongoose.model('MenuItem');
  
  const tenants = await Tenant.find({}).limit(2);
  
  if (tenants.length < 2) {
    console.log('[SKIP] Need at least 2 tenants for isolation test');
    return;
  }
  
  const [tenant1, tenant2] = tenants;
  
  // Set context to tenant1
  setTenantContext({
    id: tenant1._id.toString(),
    slug: tenant1.slug,
    name: tenant1.name,
    dbName: 'superkafe_v2'
  });
  
  // Query should only return tenant1 data
  const items1 = await MenuItem.find({});
  const allTenant1 = items1.every(item => item.tenantId.toString() === tenant1._id.toString());
  
  console.log(`Tenant 1 (${tenant1.slug}): ${items1.length} items, isolated: ${allTenant1}`);
  
  // Set context to tenant2
  setTenantContext({
    id: tenant2._id.toString(),
    slug: tenant2.slug,
    name: tenant2.name,
    dbName: 'superkafe_v2'
  });
  
  // Query should only return tenant2 data
  const items2 = await MenuItem.find({});
  const allTenant2 = items2.every(item => item.tenantId.toString() === tenant2._id.toString());
  
  console.log(`Tenant 2 (${tenant2.slug}): ${items2.length} items, isolated: ${allTenant2}`);
  
  if (allTenant1 && allTenant2) {
    console.log('\n[SUCCESS] Tenant isolation verified');
  } else {
    console.log('\n[ERROR] Tenant isolation failed!');
  }
  
  await mongoose.disconnect();
}

testIsolation();
```

---

### Phase 4: Application Update (30 minutes)

#### Step 4.1: Update Application Code

Ensure all code changes are deployed:

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm ci --production

# Verify environment variables
node -e "require('dotenv').config(); console.log('MONGODB_URI:', process.env.MONGODB_URI)"
```

#### Step 4.2: Run Database Migrations

```bash
# Run any pending migrations
npm run migrate

# Verify migrations
npm run migrate:status
```

#### Step 4.3: Verify Indexes

```bash
# Run index verification script
node scripts/verifyIndexes.js
```

**Expected Output**:
```
[INFO] Verifying indexes for unified database...
[SUCCESS] tenants: slug_1 (unique)
[SUCCESS] employees: tenantId_1
[SUCCESS] menuitems: tenantId_1, tenantId_1_createdAt_-1
[SUCCESS] orders: tenantId_1, tenantId_1_status_1
[SUCCESS] All indexes verified
```

---

### Phase 5: Application Restart (15 minutes)

#### Step 5.1: Start Application

```bash
# Start application
pm2 start ecosystem.config.js --env production

# Monitor logs
pm2 logs --lines 100
```

**Look for**:
```
[INFO] Connecting to superkafe_v2...
[INFO] Database connected successfully
[INFO] Server listening on port 3000
```

#### Step 5.2: Health Check

```bash
# Check health endpoint
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "database": {
    "connected": true,
    "name": "superkafe_v2",
    "responseTime": 5
  }
}
```

---

## Post-Migration Verification

### Functional Testing

#### Test 1: Tenant Resolution

```bash
# Test with valid tenant
curl -H "x-tenant-slug: negoes" http://localhost:3000/api/menu

# Should return menu items for negoes tenant
```

#### Test 2: Authentication

```bash
# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: negoes" \
  -d '{"email":"admin@negoes.com","password":"admin123"}'

# Should return JWT token
```

#### Test 3: Data Isolation

```bash
# Run automated isolation tests
npm run test:isolation

# All tests should pass
```

### Performance Testing

#### Test Query Performance

```bash
# Run performance tests
node scripts/verifyQueryPerformance.js

# Expected: All queries < 100ms
```

#### Monitor Connection Pool

```bash
# Monitor connection pool
node scripts/monitorConnectionPool.js

# Expected: Pool utilization < 80%
```

### Security Audit

#### Verify Tenant Isolation

```bash
# Run security audit
npm run test:security

# All tests should pass
```

#### Check for Cross-Tenant Access

```bash
# Review logs for security events
grep "CROSS_TENANT_ACCESS" logs/application.log

# Should be empty or only test data
```

---

## Common Issues

### Issue 1: Migration Script Fails

**Symptoms**: Script exits with error during migration

**Causes**:
- Source database connection failure
- Insufficient disk space
- Memory exhaustion
- Network timeout

**Solutions**:
```bash
# Check disk space
df -h

# Check memory
free -h

# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" node scripts/migrateTenantData.js

# Migrate in batches
node scripts/migrateTenantData.js --batch-size=100
```

### Issue 2: Missing tenantId on Documents

**Symptoms**: Queries return no results or throw errors

**Causes**:
- Migration script didn't stamp tenantId
- Manual data insertion without context

**Solutions**:
```bash
# Find documents without tenantId
mongo superkafe_v2 --eval "db.menuitems.find({ tenantId: { \$exists: false } })"

# Fix manually
mongo superkafe_v2
> db.menuitems.updateMany(
    { tenantId: { $exists: false } },
    { $set: { tenantId: ObjectId("tenant_id_here") } }
  )
```

### Issue 3: Performance Degradation

**Symptoms**: Slow query response times

**Causes**:
- Missing indexes on tenantId
- Large collection scans
- Insufficient connection pool

**Solutions**:
```bash
# Verify indexes
node scripts/verifyIndexes.js

# Create missing indexes
mongo superkafe_v2
> db.menuitems.createIndex({ tenantId: 1 })
> db.orders.createIndex({ tenantId: 1, createdAt: -1 })

# Increase connection pool
# In .env:
MONGODB_POOL_SIZE=20
```

### Issue 4: Application Won't Start

**Symptoms**: Application crashes on startup

**Causes**:
- Invalid MONGODB_URI
- Database not accessible
- Missing environment variables

**Solutions**:
```bash
# Test database connection
mongo "$MONGODB_URI"

# Verify environment variables
node backend/utils/envValidator.js

# Check application logs
pm2 logs --err
```

### Issue 5: Tenant Not Found Errors

**Symptoms**: 404 errors for valid tenants

**Causes**:
- Tenant not created in unified database
- Incorrect tenant slug
- Tenant marked as inactive

**Solutions**:
```bash
# List all tenants
mongo superkafe_v2 --eval "db.tenants.find({}, {slug: 1, isActive: 1})"

# Create missing tenant
node scripts/createTenant.js --slug=tenant-name

# Activate tenant
mongo superkafe_v2
> db.tenants.updateOne({ slug: "tenant-name" }, { $set: { isActive: true } })
```

---

## Next Steps

After successful migration:

1. **Monitor for 24-48 hours**: Watch logs, metrics, and user reports
2. **Review Performance**: Analyze query performance and optimize if needed
3. **Update Documentation**: Document any issues encountered and solutions
4. **Plan Legacy Cleanup**: Schedule removal of old tenant databases
5. **Conduct Retrospective**: Review migration process and identify improvements

---

## Support

For migration assistance:
- Review [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)
- Check [ROLLBACK_PROCEDURES.md](./ROLLBACK_PROCEDURES.md) if issues occur
- Contact DevOps team for infrastructure support

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-15  
**Maintained By**: DevOps Team
