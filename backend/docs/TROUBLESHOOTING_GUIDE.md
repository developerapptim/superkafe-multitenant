# Troubleshooting Guide: Unified Nexus Architecture

## Overview

This guide provides solutions to common issues encountered with the Unified Nexus Architecture. Issues are organized by category with symptoms, causes, and step-by-step solutions.

**Quick Reference**:
- [Database Connection Issues](#database-connection-issues)
- [Tenant Resolution Issues](#tenant-resolution-issues)
- [Data Isolation Issues](#data-isolation-issues)
- [Performance Issues](#performance-issues)
- [Migration Issues](#migration-issues)
- [Application Startup Issues](#application-startup-issues)

---

## Database Connection Issues

### Issue 1: Cannot Connect to Database

**Symptoms**:
- Application fails to start
- Error: "MongoNetworkError: connection timeout"
- Health check returns database disconnected

**Possible Causes**:
1. MongoDB service not running
2. Incorrect connection string
3. Network/firewall blocking connection
4. Authentication failure
5. Database not created

**Diagnostic Steps**:

```bash
# 1. Check if MongoDB is running
systemctl status mongod
# or
ps aux | grep mongod

# 2. Test connection manually
mongo "$MONGODB_URI"

# 3. Verify connection string format
echo $MONGODB_URI
# Should be: mongodb://user:pass@host:port/superkafe_v2

# 4. Check MongoDB logs
tail -f /var/log/mongodb/mongod.log

# 5. Test network connectivity
telnet localhost 27017
```

**Solutions**:

**Solution 1: Start MongoDB Service**
```bash
sudo systemctl start mongod
sudo systemctl enable mongod
systemctl status mongod
```

**Solution 2: Fix Connection String**
```bash
# Update .env file
MONGODB_URI=mongodb://superkafe_admin:password@localhost:27017/superkafe_v2?authSource=superkafe_v2

# Verify format
node -e "require('dotenv').config(); console.log(process.env.MONGODB_URI)"
```

**Solution 3: Create Database and User**
```bash
mongo
> use superkafe_v2
> db.createUser({
    user: "superkafe_admin",
    pwd: "secure_password",
    roles: ["readWrite", "dbAdmin"]
  })
```

**Solution 4: Check Firewall**
```bash
# Allow MongoDB port
sudo ufw allow 27017
# or
sudo firewall-cmd --add-port=27017/tcp --permanent
sudo firewall-cmd --reload
```


### Issue 2: Connection Pool Exhausted

**Symptoms**:
- Error: "MongoServerSelectionError: connection pool exhausted"
- Slow response times
- Requests timing out

**Possible Causes**:
1. Too many concurrent connections
2. Connection pool size too small
3. Connections not being released
4. Memory leak in application

**Diagnostic Steps**:

```bash
# Check current connections
mongo superkafe_v2 --eval "db.serverStatus().connections"

# Monitor connection pool
node scripts/monitorConnectionPool.js

# Check for connection leaks
grep "connection" logs/application.log | tail -50
```

**Solutions**:

**Solution 1: Increase Pool Size**
```javascript
// In backend/config/db.js
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 20,  // Increase from default 10
  minPoolSize: 5,
  maxIdleTimeMS: 30000
});
```

**Solution 2: Fix Connection Leaks**
```javascript
// Ensure connections are properly closed
try {
  const result = await Model.find({});
  return result;
} finally {
  // Connection automatically returned to pool with mongoose
}
```

**Solution 3: Restart Application**
```bash
pm2 restart all
```

---

## Tenant Resolution Issues

### Issue 3: Tenant Not Found (404)

**Symptoms**:
- Error: "Tenant tidak ditemukan atau tidak aktif"
- Status code: 404
- Valid tenant slug provided

**Possible Causes**:
1. Tenant not created in database
2. Tenant slug mismatch (case sensitivity)
3. Tenant marked as inactive
4. Database connection issue

**Diagnostic Steps**:

```bash
# Check if tenant exists
mongo superkafe_v2 --eval "db.tenants.find({slug: 'negoes'})"

# List all tenants
mongo superkafe_v2 --eval "db.tenants.find({}, {slug: 1, isActive: 1})"

# Check tenant resolver logs
grep "TENANT_NOT_FOUND" logs/application.log | tail -20
```

**Solutions**:

**Solution 1: Create Missing Tenant**
```bash
# Run init script
node scripts/initUniverse.js

# Or create manually
mongo superkafe_v2
> db.tenants.insertOne({
    name: "Tenant Name",
    slug: "tenant-slug",
    dbName: "superkafe_v2",
    isActive: true,
    status: "trial",
    createdAt: new Date(),
    updatedAt: new Date()
  })
```

**Solution 2: Fix Slug Case**
```bash
# Tenant slugs are case-sensitive
# Ensure client sends lowercase slug
curl -H "x-tenant-slug: negoes" http://localhost:3000/api/menu
# NOT: curl -H "x-tenant-slug: Negoes" ...
```

**Solution 3: Activate Tenant**
```bash
mongo superkafe_v2
> db.tenants.updateOne(
    { slug: "negoes" },
    { $set: { isActive: true } }
  )
```

### Issue 4: Missing Tenant Header (400)

**Symptoms**:
- Error: "Header x-tenant-slug atau x-tenant-id wajib disertakan"
- Status code: 400
- Request to tenant-scoped endpoint

**Possible Causes**:
1. Client not sending header
2. Header name incorrect
3. Middleware not applied to route

**Diagnostic Steps**:

```bash
# Test with header
curl -H "x-tenant-slug: negoes" http://localhost:3000/api/menu

# Check request headers in logs
grep "x-tenant-slug" logs/application.log | tail -20
```

**Solutions**:

**Solution 1: Add Header to Client Request**
```javascript
// Frontend API client
axios.get('/api/menu', {
  headers: {
    'x-tenant-slug': 'negoes'
  }
});
```

**Solution 2: Verify Middleware Applied**
```javascript
// In routes file
const tenantResolver = require('../middleware/tenantResolver');

// Apply to tenant-scoped routes
router.use('/api/menu', tenantResolver, menuRoutes);
router.use('/api/orders', tenantResolver, orderRoutes);
```

### Issue 5: Cross-Tenant Access Attempt (403)

**Symptoms**:
- Error: "Unauthorized access to tenant data"
- Status code: 403
- User authenticated but accessing wrong tenant

**Possible Causes**:
1. JWT contains different tenant than header
2. User trying to access another tenant's data
3. Security misconfiguration

**Diagnostic Steps**:

```bash
# Check security logs
grep "CROSS_TENANT_ACCESS" logs/application.log

# Decode JWT to verify tenant
node -e "console.log(require('jsonwebtoken').decode('JWT_TOKEN_HERE'))"
```

**Solutions**:

**Solution 1: Ensure JWT Matches Tenant**
```javascript
// In authentication middleware
if (req.user.tenantSlug !== req.tenant.slug) {
  return res.status(403).json({
    success: false,
    code: 'CROSS_TENANT_ACCESS',
    message: 'Unauthorized access to tenant data'
  });
}
```

**Solution 2: Re-authenticate User**
```bash
# User should log in again to get correct JWT
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

---

## Data Isolation Issues

### Issue 6: Seeing Data from Other Tenants

**Symptoms**:
- Query returns data from multiple tenants
- Data leakage between tenants
- CRITICAL SECURITY ISSUE

**Possible Causes**:
1. Tenant scoping plugin not applied
2. Tenant context not set
3. Query bypassing plugin
4. Model misconfiguration

**Diagnostic Steps**:

```bash
# Check if documents have tenantId
mongo superkafe_v2 --eval "db.menuitems.find({}, {tenantId: 1, name: 1}).limit(5)"

# Verify plugin applied
grep "tenantScopingPlugin" backend/models/*.js

# Check tenant context
grep "getTenantContext" logs/application.log | tail -20
```

**Solutions**:

**Solution 1: Apply Plugin to Model**
```javascript
// In model file
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const MenuItemSchema = new mongoose.Schema({
  // ... fields
});

// Apply plugin
MenuItemSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('MenuItem', MenuItemSchema);
```

**Solution 2: Ensure Tenant Context Set**
```javascript
// In tenant resolver middleware
const { setTenantContext } = require('../utils/tenantContext');

setTenantContext({
  id: tenant._id.toString(),
  slug: tenant.slug,
  name: tenant.name,
  dbName: 'superkafe_v2'
});
```

**Solution 3: Verify Query Not Bypassing Plugin**
```javascript
// WRONG - bypasses plugin
const items = await MenuItem.find({}).setOptions({ skipTenantFilter: true });

// CORRECT - uses plugin
const items = await MenuItem.find({});
```

**Solution 4: Emergency Fix - Add Manual Filter**
```javascript
// Temporary fix until plugin issue resolved
const tenantId = getTenantContext().id;
const items = await MenuItem.find({ tenantId });
```

### Issue 7: Cannot Save Documents - Missing tenantId

**Symptoms**:
- Error: "tenantId is required"
- Document save fails
- Validation error

**Possible Causes**:
1. Tenant context not set
2. Plugin not auto-stamping
3. Creating document outside request context

**Diagnostic Steps**:

```bash
# Check if tenant context exists
node -e "
  const { getTenantContext } = require('./backend/utils/tenantContext');
  console.log(getTenantContext());
"

# Check plugin configuration
cat backend/plugins/tenantScopingPlugin.js | grep "pre('save'"
```

**Solutions**:

**Solution 1: Set Tenant Context**
```javascript
const { setTenantContext } = require('../utils/tenantContext');

// Before creating document
setTenantContext({
  id: tenant._id.toString(),
  slug: tenant.slug,
  name: tenant.name,
  dbName: 'superkafe_v2'
});

const item = new MenuItem({ name: 'Test' });
await item.save();
```

**Solution 2: Manual tenantId for Scripts**
```javascript
// In scripts/seeders that run outside request context
const item = new MenuItem({
  name: 'Test',
  tenantId: tenant._id  // Manually set
});
await item.save();
```

---

## Performance Issues

### Issue 8: Slow Query Performance

**Symptoms**:
- Response times > 100ms
- Slow database queries
- High CPU usage

**Possible Causes**:
1. Missing indexes on tenantId
2. Large collection scans
3. Inefficient queries
4. Too much data returned

**Diagnostic Steps**:

```bash
# Check query performance
node scripts/verifyQueryPerformance.js

# Analyze slow queries
mongo superkafe_v2
> db.setProfilingLevel(2)
> db.system.profile.find().sort({millis: -1}).limit(5)

# Check if indexes used
> db.menuitems.find({tenantId: ObjectId("...")}).explain("executionStats")
```

**Solutions**:

**Solution 1: Create Missing Indexes**
```bash
# Run index verification
node scripts/verifyIndexes.js

# Create indexes manually if needed
mongo superkafe_v2
> db.menuitems.createIndex({ tenantId: 1 })
> db.menuitems.createIndex({ tenantId: 1, createdAt: -1 })
> db.orders.createIndex({ tenantId: 1, status: 1 })
```

**Solution 2: Optimize Query**
```javascript
// SLOW - returns all fields
const items = await MenuItem.find({ category: 'food' });

// FAST - project only needed fields
const items = await MenuItem.find(
  { category: 'food' },
  { name: 1, price: 1 }
);

// FAST - add pagination
const items = await MenuItem.find({ category: 'food' })
  .limit(20)
  .skip(page * 20);
```

**Solution 3: Add Caching**
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

async function getMenuItems(tenantId) {
  const cacheKey = `menu:${tenantId}`;
  
  // Check cache
  let items = cache.get(cacheKey);
  if (items) return items;
  
  // Query database
  items = await MenuItem.find({});
  
  // Store in cache
  cache.set(cacheKey, items);
  
  return items;
}
```

### Issue 9: High Memory Usage

**Symptoms**:
- Application memory growing
- Out of memory errors
- Slow performance over time

**Possible Causes**:
1. Memory leak in application
2. Large result sets not paginated
3. Connection pool issues
4. Cache growing unbounded

**Diagnostic Steps**:

```bash
# Check memory usage
pm2 monit

# Generate heap snapshot
node --inspect backend/server.js
# Then use Chrome DevTools

# Check for memory leaks
node --trace-warnings backend/server.js
```

**Solutions**:

**Solution 1: Add Pagination**
```javascript
// Paginate large result sets
async function getOrders(page = 0, limit = 50) {
  return await Order.find({})
    .limit(limit)
    .skip(page * limit)
    .sort({ createdAt: -1 });
}
```

**Solution 2: Limit Cache Size**
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({
  stdTTL: 300,
  maxKeys: 1000  // Limit cache size
});
```

**Solution 3: Restart Application**
```bash
# Temporary fix
pm2 restart all

# Schedule periodic restarts
pm2 start ecosystem.config.js --cron-restart="0 3 * * *"
```

---

## Migration Issues

### Issue 10: Migration Script Fails

**Symptoms**:
- Migration script exits with error
- Partial data migration
- Some tenants not migrated

**Possible Causes**:
1. Source database connection failure
2. Insufficient disk space
3. Memory exhaustion
4. Data validation errors

**Diagnostic Steps**:

```bash
# Check disk space
df -h

# Check memory
free -h

# Test source database connection
mongo superkafe_negoes --eval "db.stats()"

# Check migration logs
tail -f migration.log
```

**Solutions**:

**Solution 1: Increase Memory Limit**
```bash
NODE_OPTIONS="--max-old-space-size=4096" node scripts/migrateTenantData.js
```

**Solution 2: Migrate in Batches**
```javascript
// Modify migration script to process in batches
const batchSize = 100;
for (let i = 0; i < documents.length; i += batchSize) {
  const batch = documents.slice(i, i + batchSize);
  await TargetModel.insertMany(batch);
  console.log(`Migrated ${i + batch.length}/${documents.length}`);
}
```

**Solution 3: Resume Failed Migration**
```javascript
// Add resume capability
const lastMigratedId = await getLastMigratedId();
const documents = await sourceCollection.find({
  _id: { $gt: lastMigratedId }
}).toArray();
```

### Issue 11: Missing tenantId After Migration

**Symptoms**:
- Documents without tenantId field
- Queries return no results
- Validation errors

**Possible Causes**:
1. Migration script didn't stamp tenantId
2. Manual data insertion
3. Script error during migration

**Diagnostic Steps**:

```bash
# Find documents without tenantId
mongo superkafe_v2 --eval "
  db.menuitems.find({ tenantId: { \$exists: false } }).count()
"

# Check migration logs
grep "tenantId" migration.log
```

**Solutions**:

**Solution 1: Fix Missing tenantIds**
```bash
# Identify tenant for orphaned documents
# Then update manually
mongo superkafe_v2
> db.menuitems.updateMany(
    { tenantId: { $exists: false } },
    { $set: { tenantId: ObjectId("tenant_id_here") } }
  )
```

**Solution 2: Re-run Migration for Affected Tenant**
```bash
node scripts/migrateTenantData.js --tenant=negoes --force
```

---

## Application Startup Issues

### Issue 12: Application Won't Start

**Symptoms**:
- Application crashes on startup
- Process exits immediately
- No server listening

**Possible Causes**:
1. Invalid environment variables
2. Database connection failure
3. Port already in use
4. Syntax error in code

**Diagnostic Steps**:

```bash
# Check environment variables
node backend/utils/envValidator.js

# Test database connection
mongo "$MONGODB_URI"

# Check if port in use
lsof -i :3000

# Check for syntax errors
node --check backend/server.js

# View startup logs
pm2 logs --err
```

**Solutions**:

**Solution 1: Fix Environment Variables**
```bash
# Verify all required vars present
cat .env

# Required variables:
# MONGODB_URI=mongodb://...
# NODE_ENV=production
# PORT=3000
# JWT_SECRET=...
```

**Solution 2: Kill Process on Port**
```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

**Solution 3: Fix Code Errors**
```bash
# Check for syntax errors
npm run lint

# Run tests
npm test

# Start in debug mode
DEBUG=* npm start
```

### Issue 13: Health Check Fails

**Symptoms**:
- /health endpoint returns unhealthy
- Database connection shows disconnected
- Load balancer marks instance as down

**Possible Causes**:
1. Database connection lost
2. Health check endpoint misconfigured
3. Application not fully started

**Diagnostic Steps**:

```bash
# Test health endpoint
curl http://localhost:3000/health

# Check database connection
mongo superkafe_v2 --eval "db.stats()"

# Check application logs
pm2 logs | grep health
```

**Solutions**:

**Solution 1: Restart Application**
```bash
pm2 restart all
sleep 10
curl http://localhost:3000/health
```

**Solution 2: Fix Database Connection**
```bash
# Verify MONGODB_URI
echo $MONGODB_URI

# Test connection
mongo "$MONGODB_URI"

# Restart MongoDB if needed
sudo systemctl restart mongod
```

---

## Debugging Tools

### Enable Debug Logging

```bash
# Set debug environment variable
DEBUG=* npm start

# Or specific modules
DEBUG=mongoose:*,app:* npm start
```

### Monitor Application

```bash
# Real-time logs
pm2 logs --lines 100

# Monitor resources
pm2 monit

# Process list
pm2 list
```

### Database Debugging

```bash
# Enable MongoDB profiling
mongo superkafe_v2
> db.setProfilingLevel(2)

# View slow queries
> db.system.profile.find().sort({millis: -1}).limit(10)

# Check current operations
> db.currentOp()
```

### Network Debugging

```bash
# Test connectivity
telnet localhost 27017

# Check open connections
netstat -an | grep 27017

# Monitor network traffic
tcpdump -i any port 27017
```

---

## Getting Help

### Before Asking for Help

1. Check this troubleshooting guide
2. Review application logs
3. Check database logs
4. Search existing issues
5. Gather diagnostic information

### Information to Provide

When reporting an issue, include:

```
**Environment**:
- OS: 
- Node.js version:
- MongoDB version:
- Application version:

**Issue Description**:
[Detailed description]

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happens]

**Logs**:
```
[Relevant log excerpts]
```

**Diagnostic Output**:
```
[Output from diagnostic commands]
```
```

### Support Channels

- **Documentation**: Check `backend/docs/` directory
- **Team Chat**: #engineering-support
- **On-Call**: See deployment checklist for contacts
- **MongoDB Support**: For database-specific issues

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-15  
**Maintained By**: DevOps Team  
**Feedback**: Submit improvements via pull request
