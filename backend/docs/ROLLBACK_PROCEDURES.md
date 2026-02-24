# Rollback Procedures: Unified Nexus Architecture

## Overview

This document provides detailed procedures for rolling back from the Unified Nexus Architecture to the legacy multi-database system in case of critical issues during or after migration.

**IMPORTANT**: Rollback should only be initiated when critical issues cannot be resolved quickly and are impacting production operations.

---

## Table of Contents

1. [Rollback Decision Criteria](#rollback-decision-criteria)
2. [Pre-Rollback Checklist](#pre-rollback-checklist)
3. [Rollback Procedures](#rollback-procedures)
4. [Post-Rollback Verification](#post-rollback-verification)
5. [Rollback Scenarios](#rollback-scenarios)

---

## Rollback Decision Criteria

### When to Rollback

Initiate rollback if any of the following occur:

#### Critical Issues (Immediate Rollback)
- **Data Loss**: Missing or corrupted data affecting multiple tenants
- **Security Breach**: Cross-tenant data leakage detected
- **System Unavailability**: Application down for > 15 minutes
- **Data Integrity**: Widespread data corruption or inconsistency

#### Severe Issues (Rollback within 1 hour)
- **Performance Degradation**: Response times > 5x baseline
- **High Error Rate**: Error rate > 10% of requests
- **Tenant Isolation Failure**: Multiple tenants accessing wrong data
- **Database Connection Failures**: Persistent connection issues

#### Moderate Issues (Consider Rollback)
- **Feature Breakage**: Critical features not working for multiple tenants
- **Performance Issues**: Response times 2-5x baseline
- **Intermittent Errors**: Error rate 5-10% of requests

### When NOT to Rollback

Do NOT rollback for:
- **Minor Bugs**: Issues affecting single tenant or non-critical features
- **Performance Tuning**: Issues that can be resolved with index optimization
- **Configuration Issues**: Problems that can be fixed with config changes
- **Transient Errors**: Temporary issues that resolve themselves

### Decision Authority

Rollback decisions must be approved by:
- **Critical Issues**: Any senior engineer or on-call lead
- **Severe Issues**: Engineering manager or technical lead
- **Moderate Issues**: Engineering manager and product owner

---

## Pre-Rollback Checklist

Before initiating rollback, complete these steps:

### 1. Assess the Situation

```bash
# Check application health
curl http://localhost:3000/health

# Check error logs
tail -n 100 logs/error.log

# Check database connectivity
mongo superkafe_v2 --eval "db.stats()"

# Check active connections
pm2 list
```

### 2. Document the Issue

Create an incident report:

```markdown
## Incident Report

**Date/Time**: 2024-01-15 14:30:00 UTC
**Severity**: Critical
**Reporter**: [Your Name]

**Issue Description**:
[Detailed description of the problem]

**Impact**:
- Affected Tenants: [List or "All"]
- Affected Features: [List]
- User Impact: [Description]

**Attempted Fixes**:
1. [What was tried]
2. [Results]

**Rollback Decision**:
- Approved By: [Name]
- Reason: [Why rollback is necessary]
- Time: [When rollback will start]
```

### 3. Notify Stakeholders

```bash
# Send notification to team
# Include:
# - Issue description
# - Rollback timeline
# - Expected downtime
# - Action items
```

### 4. Verify Backup Availability

```bash
# Check backup location
ls -lh /backup/pre-migration-*/

# Verify backup integrity
mongorestore --uri="mongodb://localhost:27017" \
  --dir=/backup/pre-migration-20240115 \
  --dryRun

# Confirm backup timestamp
cat /backup/pre-migration-20240115/backup-info.txt
```

### 5. Prepare Rollback Environment

```bash
# Ensure sufficient disk space
df -h

# Verify legacy code is available
git log --oneline | grep "pre-migration"
git show pre-migration-tag

# Check legacy environment variables
cat .env.legacy
```

---

## Rollback Procedures

### Phase 1: Stop Current System (5 minutes)

#### Step 1.1: Stop Application

```bash
# Stop all application instances
pm2 stop all

# Verify all stopped
pm2 list

# Kill any remaining Node processes
pkill -f "node.*server.js"

# Verify no processes running
ps aux | grep node
```

#### Step 1.2: Prevent New Connections

```bash
# If using load balancer, remove from pool
# Example for nginx:
sudo systemctl stop nginx

# Or mark as down in load balancer config
```

#### Step 1.3: Create Current State Backup

```bash
# Backup current unified database state
mkdir -p /backup/rollback-$(date +%Y%m%d-%H%M%S)
mongodump --uri="$MONGODB_URI" \
  --out=/backup/rollback-$(date +%Y%m%d-%H%M%S)/unified-state

# This allows forward-migration later if needed
```

---

### Phase 2: Restore Legacy Databases (30-60 minutes)

#### Step 2.1: Restore Tenant Databases

```bash
# Restore all tenant databases from backup
cd /backup/pre-migration-20240115

# Restore each tenant database
for db_dir in superkafe_*; do
  echo "Restoring $db_dir..."
  mongorestore --uri="mongodb://localhost:27017" \
    --db="$db_dir" \
    --dir="./$db_dir" \
    --drop
done

# Verify restoration
mongo --eval "db.adminCommand('listDatabases').databases.forEach(function(d) { 
  if (d.name.startsWith('superkafe_')) { 
    print(d.name + ': ' + d.sizeOnDisk); 
  } 
})"
```

#### Step 2.2: Verify Data Integrity

```bash
# Count documents in restored databases
node scripts/verifyRestoredData.js
```

Create `scripts/verifyRestoredData.js`:

```javascript
const mongoose = require('mongoose');

async function verifyRestoration() {
  const tenantDatabases = [
    'superkafe_negoes',
    'superkafe_tenant2',
    'superkafe_tenant3'
  ];
  
  console.log('=== Restoration Verification ===\n');
  
  for (const dbName of tenantDatabases) {
    const conn = await mongoose.createConnection(
      `mongodb://localhost:27017/${dbName}`,
      { useNewUrlParser: true, useUnifiedTopology: true }
    );
    
    console.log(`Database: ${dbName}`);
    
    const collections = await conn.db.listCollections().toArray();
    
    for (const coll of collections) {
      const count = await conn.db.collection(coll.name).countDocuments();
      console.log(`  ${coll.name}: ${count} documents`);
    }
    
    await conn.close();
    console.log('');
  }
}

verifyRestoration().then(() => process.exit(0));
```

#### Step 2.3: Restore Indexes

```bash
# Verify indexes are restored
mongo superkafe_negoes --eval "db.menuitems.getIndexes()"

# If indexes missing, recreate them
mongo superkafe_negoes
> db.menuitems.createIndex({ category: 1 })
> db.orders.createIndex({ createdAt: -1 })
```

---

### Phase 3: Revert Application Code (15 minutes)

#### Step 3.1: Checkout Legacy Code

```bash
# Identify pre-migration commit
git log --oneline --grep="pre-migration"

# Or use tag
git tag | grep migration

# Checkout legacy code
git checkout pre-migration-tag

# Or create rollback branch
git checkout -b rollback-$(date +%Y%m%d) pre-migration-commit
```

#### Step 3.2: Restore Legacy Configuration

```bash
# Restore legacy environment variables
cp .env.legacy .env

# Verify legacy configuration
cat .env | grep MONGODB

# Should show legacy connection pattern, not unified URI
```

#### Step 3.3: Install Legacy Dependencies

```bash
# Install dependencies for legacy code
npm ci --production

# Verify installation
npm list --depth=0
```

---

### Phase 4: Restart Legacy System (15 minutes)

#### Step 4.1: Start Application

```bash
# Start application with legacy code
pm2 start ecosystem.config.js --env production

# Monitor startup logs
pm2 logs --lines 50
```

**Look for**:
```
[INFO] Connecting to tenant databases...
[INFO] Database connections established
[INFO] Server listening on port 3000
```

#### Step 4.2: Verify Database Connections

```bash
# Test database connectivity
node scripts/testLegacyConnections.js
```

Create `scripts/testLegacyConnections.js`:

```javascript
const { getTenantDB } = require('./config/db');

async function testConnections() {
  const tenants = ['negoes', 'tenant2', 'tenant3'];
  
  for (const tenant of tenants) {
    try {
      const db = await getTenantDB(tenant);
      const collections = await db.db.listCollections().toArray();
      console.log(`[SUCCESS] ${tenant}: ${collections.length} collections`);
    } catch (error) {
      console.error(`[ERROR] ${tenant}:`, error.message);
    }
  }
}

testConnections();
```

#### Step 4.3: Enable Traffic

```bash
# Re-enable load balancer
sudo systemctl start nginx

# Or mark as up in load balancer config

# Verify traffic flowing
curl http://localhost:3000/health
```

---

### Phase 5: Verification (30 minutes)

#### Step 5.1: Functional Testing

```bash
# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@negoes.com","password":"admin123","tenant":"negoes"}'

# Test data retrieval
curl http://localhost:3000/api/menu?tenant=negoes

# Test data creation
curl -X POST http://localhost:3000/api/menu \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Item","price":10000,"tenant":"negoes"}'
```

#### Step 5.2: Verify Multi-Tenant Functionality

```bash
# Test multiple tenants
for tenant in negoes tenant2 tenant3; do
  echo "Testing $tenant..."
  curl http://localhost:3000/api/menu?tenant=$tenant
done
```

#### Step 5.3: Check Error Logs

```bash
# Monitor for errors
tail -f logs/error.log

# Check for database errors
grep -i "database\|connection\|mongo" logs/error.log | tail -20

# Should see normal operation, no critical errors
```

#### Step 5.4: Performance Check

```bash
# Test response times
for i in {1..10}; do
  curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/menu?tenant=negoes
done

# Average should be < 100ms
```

---

## Post-Rollback Verification

### Verification Checklist

- [ ] All tenant databases restored and accessible
- [ ] Application started successfully with legacy code
- [ ] Authentication working for all tenants
- [ ] Data retrieval working for all tenants
- [ ] Data creation working for all tenants
- [ ] No critical errors in logs
- [ ] Response times within acceptable range
- [ ] All critical features functional

### Monitoring

Monitor the system for 2-4 hours after rollback:

```bash
# Monitor application logs
pm2 logs

# Monitor error rate
watch -n 10 'grep -c ERROR logs/application.log'

# Monitor response times
node scripts/monitorPerformance.js

# Monitor database connections
mongo --eval "db.serverStatus().connections"
```

### User Communication

After successful rollback:

1. **Notify Users**: Inform users that system is restored
2. **Explain Impact**: Describe what happened and resolution
3. **Data Status**: Confirm data integrity and any data loss
4. **Next Steps**: Explain plan for addressing root cause

---

## Rollback Scenarios

### Scenario 1: Data Loss Detected

**Situation**: Missing data discovered after migration

**Rollback Steps**:
1. Immediately stop application (Phase 1)
2. Restore all tenant databases (Phase 2)
3. Revert application code (Phase 3)
4. Restart and verify data completeness (Phase 4-5)

**Post-Rollback**:
- Audit migration script for data loss cause
- Verify backup integrity
- Plan corrected migration

### Scenario 2: Cross-Tenant Data Leakage

**Situation**: Tenant A can see Tenant B's data

**Rollback Steps**:
1. **IMMEDIATE**: Stop application to prevent further leakage
2. Document affected tenants and data accessed
3. Restore databases (Phase 2)
4. Revert code (Phase 3)
5. Restart with legacy system (Phase 4)

**Post-Rollback**:
- Security audit of affected data
- Notify affected tenants
- Review tenant scoping plugin implementation
- Add additional isolation tests

### Scenario 3: Performance Degradation

**Situation**: Response times 10x slower than baseline

**Rollback Steps**:
1. Attempt quick fixes first:
   - Verify indexes exist
   - Check connection pool settings
   - Review slow query log
2. If no improvement in 30 minutes, initiate rollback
3. Follow standard rollback procedure (Phases 1-5)

**Post-Rollback**:
- Analyze query performance
- Optimize indexes
- Review connection pooling
- Load test before re-migration

### Scenario 4: Database Connection Failures

**Situation**: Application cannot connect to unified database

**Rollback Steps**:
1. Verify database is running: `systemctl status mongod`
2. Check connection string: `echo $MONGODB_URI`
3. Test connection: `mongo "$MONGODB_URI"`
4. If database issue cannot be resolved quickly, rollback
5. Follow standard rollback procedure (Phases 1-5)

**Post-Rollback**:
- Investigate database connectivity issue
- Review network configuration
- Check firewall rules
- Verify database authentication

### Scenario 5: Partial Migration Failure

**Situation**: Some tenants migrated successfully, others failed

**Rollback Steps**:
1. Stop application (Phase 1)
2. Restore ALL tenant databases, including successfully migrated ones
3. Revert code (Phase 3)
4. Restart legacy system (Phase 4)
5. Verify all tenants functional (Phase 5)

**Post-Rollback**:
- Identify why some tenants failed
- Fix migration script
- Test migration on staging with all tenant patterns
- Re-attempt migration with corrected script

---

## Rollback Testing

### Pre-Migration Rollback Test

Before production migration, test rollback procedure:

```bash
# 1. Backup staging databases
mongodump --uri="mongodb://staging:27017" --out=/backup/staging-test

# 2. Perform migration on staging
node scripts/migrateTenantData.js

# 3. Verify migration successful
node scripts/validateMigration.js

# 4. Perform rollback
bash scripts/rollback.sh

# 5. Verify rollback successful
node scripts/verifyRestoredData.js

# 6. Document rollback time and any issues
```

### Rollback Drill

Conduct rollback drills quarterly:

1. **Schedule**: Announce drill to team
2. **Execute**: Follow rollback procedures
3. **Time**: Measure time for each phase
4. **Document**: Record issues and improvements
5. **Update**: Update procedures based on learnings

---

## Rollback Automation

### Automated Rollback Script

Create `scripts/rollback.sh`:

```bash
#!/bin/bash

set -e

echo "=== ROLLBACK PROCEDURE ==="
echo "Starting rollback at $(date)"

# Phase 1: Stop application
echo "[Phase 1] Stopping application..."
pm2 stop all
sleep 5

# Phase 2: Backup current state
echo "[Phase 2] Backing up current state..."
BACKUP_DIR="/backup/rollback-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/unified-state"

# Phase 3: Restore legacy databases
echo "[Phase 3] Restoring legacy databases..."
LEGACY_BACKUP="/backup/pre-migration-latest"

if [ ! -d "$LEGACY_BACKUP" ]; then
  echo "[ERROR] Legacy backup not found at $LEGACY_BACKUP"
  exit 1
fi

cd "$LEGACY_BACKUP"
for db_dir in superkafe_*; do
  echo "Restoring $db_dir..."
  mongorestore --uri="mongodb://localhost:27017" \
    --db="$db_dir" \
    --dir="./$db_dir" \
    --drop
done

# Phase 4: Revert code
echo "[Phase 4] Reverting application code..."
cd /app
git checkout pre-migration-tag
npm ci --production

# Phase 5: Restore configuration
echo "[Phase 5] Restoring configuration..."
cp .env.legacy .env

# Phase 6: Restart application
echo "[Phase 6] Restarting application..."
pm2 start ecosystem.config.js --env production

# Wait for startup
sleep 10

# Phase 7: Verify
echo "[Phase 7] Verifying rollback..."
HEALTH=$(curl -s http://localhost:3000/health | jq -r '.status')

if [ "$HEALTH" = "healthy" ]; then
  echo "[SUCCESS] Rollback completed successfully"
  echo "Completed at $(date)"
else
  echo "[ERROR] Health check failed after rollback"
  exit 1
fi
```

Make executable:
```bash
chmod +x scripts/rollback.sh
```

---

## Recovery After Rollback

### Root Cause Analysis

After rollback, conduct RCA:

1. **Identify Root Cause**: What caused the issue?
2. **Document Timeline**: When did issue start?
3. **Analyze Impact**: What was affected?
4. **Determine Prevention**: How to prevent recurrence?
5. **Create Action Items**: What needs to be fixed?

### Re-Migration Planning

Before attempting re-migration:

1. **Fix Root Cause**: Address issues that caused rollback
2. **Enhanced Testing**: Add tests for failure scenarios
3. **Staging Validation**: Test thoroughly on staging
4. **Gradual Rollout**: Consider phased migration
5. **Monitoring**: Enhanced monitoring for early detection

### Documentation Updates

Update documentation based on rollback experience:

1. **Rollback Procedures**: Add lessons learned
2. **Migration Guide**: Add warnings and checks
3. **Troubleshooting**: Add new issues encountered
4. **Runbook**: Update with new scenarios

---

## Emergency Contacts

### Escalation Path

1. **On-Call Engineer**: [Contact Info]
2. **Engineering Manager**: [Contact Info]
3. **CTO**: [Contact Info]
4. **Database Administrator**: [Contact Info]

### External Support

- **MongoDB Support**: [Support Portal URL]
- **Hosting Provider**: [Support Contact]
- **Backup Service**: [Support Contact]

---

## Appendix

### Rollback Checklist

Print and use during rollback:

```
[ ] Rollback decision approved
[ ] Stakeholders notified
[ ] Backup verified available
[ ] Application stopped
[ ] Current state backed up
[ ] Legacy databases restored
[ ] Data integrity verified
[ ] Application code reverted
[ ] Configuration restored
[ ] Dependencies installed
[ ] Application restarted
[ ] Health check passed
[ ] Functional tests passed
[ ] Performance verified
[ ] Monitoring active
[ ] Users notified
[ ] Incident report completed
```

### Rollback Metrics

Track these metrics for each rollback:

- **Total Rollback Time**: [Duration]
- **Downtime**: [Duration]
- **Data Loss**: [Yes/No, Amount]
- **Affected Tenants**: [Count]
- **Root Cause**: [Description]
- **Prevention**: [Action Items]

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-15  
**Maintained By**: DevOps Team  
**Review Frequency**: Quarterly
