# Bugfix Requirements Document

## Introduction

Saat mendaftarkan tenant baru "Sulkopi", sistem masih membuat database terpisah `superkafe_sulkopi` meskipun arsitektur Unified Nexus sudah diimplementasikan. Seharusnya, proses registrasi HANYA menulis data ke database terpusat `superkafe_v2` tanpa membuat database baru. Bug ini melanggar prinsip single-database architecture dan menyebabkan polusi database di VPS.

**Dampak:**
- Database sampah terus bertambah di VPS (superkafe_sulkopi, superkafe_main, superkafe_negoes, dll)
- Beban VPS meningkat karena banyak database yang tidak terpakai
- Melanggar arsitektur Unified Nexus yang sudah dirancang
- Potensi kebingungan dalam maintenance dan monitoring

**Bukti:**
- Screenshot MongoDB Compass menunjukkan database `superkafe_sulkopi` tercipta setelah registrasi
- Database legacy lain masih ada: `superkafe_main`, `superkafe_negoes`
- Database yang benar `superkafe_v2` sudah ada dan seharusnya menjadi satu-satunya database

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN registering a new tenant "Sulkopi" through the registration endpoint THEN the system creates a separate database `superkafe_sulkopi` in MongoDB

1.2 WHEN the tenant registration process completes THEN both `superkafe_v2` (correct) and `superkafe_sulkopi` (incorrect) databases exist in MongoDB

1.3 WHEN seeding initial data during tenant registration THEN the system writes data to the wrong database `superkafe_sulkopi` instead of only to `superkafe_v2`

### Expected Behavior (Correct)

2.1 WHEN registering a new tenant "Sulkopi" through the registration endpoint THEN the system SHALL write tenant record ONLY to the `superkafe_v2` database without creating any new database

2.2 WHEN the tenant registration process completes THEN ONLY the `superkafe_v2` database SHALL exist (no `superkafe_sulkopi` database SHALL be created)

2.3 WHEN seeding initial data during tenant registration THEN the system SHALL write all data (settings, admin user, menu) ONLY to collections in `superkafe_v2` database with proper `tenantId` scoping

2.4 WHEN checking MongoDB after registration THEN the system SHALL NOT have created any database with pattern `superkafe_{slug}`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN registering a tenant with valid data THEN the system SHALL CONTINUE TO create the tenant record in the `tenants` collection with correct fields (name, slug, dbName, status, trialExpiresAt)

3.2 WHEN seeding initial data THEN the system SHALL CONTINUE TO create default settings, admin user, and menu items with proper tenant isolation via `tenantId` field

3.3 WHEN using tenant context during registration THEN the system SHALL CONTINUE TO use `runWithTenantContext()` to ensure proper tenant scoping for all database operations

3.4 WHEN accessing tenant data after registration THEN the system SHALL CONTINUE TO query data from `superkafe_v2` using `tenantId` filter for proper isolation

3.5 WHEN the tenant resolver middleware processes requests THEN the system SHALL CONTINUE TO set `req.tenant.dbName` to `'superkafe_v2'` (hardcoded)

3.6 WHEN existing tenants access the system THEN the system SHALL CONTINUE TO work correctly with data stored in `superkafe_v2` database
