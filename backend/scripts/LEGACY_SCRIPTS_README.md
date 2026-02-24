# Legacy Scripts - Multi-Database Architecture

This directory contains legacy scripts from the old multi-database architecture. These scripts are **NO LONGER USED** in the unified Nexus architecture.

## Deprecated Scripts

### 1. `migrateMenuToTenant.js`
**Status:** DEPRECATED  
**Reason:** This script was used to migrate menu data from one database to another in the multi-database architecture. In the unified architecture, all data is in `superkafe_v2` database with tenant scoping.

**Replacement:** Use `initUniverse.js` for initial tenant setup.

### 2. `seedTenant.js`
**Status:** DEPRECATED  
**Reason:** This script created tenant-specific databases and seeded them with data. In the unified architecture, we use a single database with tenant scoping.

**Replacement:** Use `initUniverse.js` for creating the first tenant with seed data.

## Current Scripts (Unified Architecture)

### Active Scripts:
- `initUniverse.js` - Initialize the first tenant in the unified database
- `verifyDatabase.js` - Verify database connection and tenant data
- `verifyIndexes.js` - Verify tenant-scoped indexes
- `cleanupFailedTenant.js` - Clean up failed tenant registrations
- `deleteReservedSlugTenants.js` - Remove tenants with reserved slugs
- `checkReservedSlugs.js` - Check for reserved slug conflicts
- `listTenants.js` - List all tenants in the unified database
- `checkTenantStatus.js` - Check tenant status and configuration

## Migration Notes

If you need to migrate from the old multi-database architecture to the unified architecture:

1. **Backup all tenant databases** before migration
2. **Run data migration script** (to be created) to consolidate data into `superkafe_v2`
3. **Verify data integrity** using `verifyDatabase.js`
4. **Verify indexes** using `verifyIndexes.js`
5. **Test tenant isolation** using property-based tests

## Architecture Change Summary

**Old Architecture (Multi-Database):**
- Each tenant had its own database (e.g., `superkafe_negoes`, `superkafe_zonamapan`)
- Dynamic database creation using `getTenantDB()`
- Database switching logic in controllers
- Complex connection management

**New Architecture (Unified Single Database):**
- Single database: `superkafe_v2`
- Tenant isolation via `tenantId` field
- Automatic tenant scoping using Mongoose plugin
- Centralized connection management
- AsyncLocalStorage for tenant context propagation

## Questions?

For questions about the unified architecture, see:
- `.kiro/specs/unified-nexus-architecture/design.md`
- `.kiro/specs/unified-nexus-architecture/requirements.md`
- `SINGLE_DATABASE_ARCHITECTURE.md`
