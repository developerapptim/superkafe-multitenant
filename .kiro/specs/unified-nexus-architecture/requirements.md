# Dokumen Requirements: Unified Nexus Architecture

## Pendahuluan

Unified Nexus Architecture adalah transformasi arsitektur besar-besaran dari sistem multi-database yang terfragmentasi menjadi arsitektur single database multitenancy untuk platform SuperKafe - sistem manajemen restoran berbasis SaaS.

### Masalah Saat Ini

Sistem saat ini mengalami "polusi database" di VPS karena:
- Database dibuat secara dinamis per tenant
- Logika switching database tersebar di seluruh codebase
- Isolasi tenant tidak konsisten
- Manajemen koneksi yang kompleks

### Solusi Target

Single database (superkafe_v2) dengan isolasi tenant di level aplikasi menggunakan:
- Sumber koneksi terpusat (db.js)
- Plugin auto-scoping tenant otomatis
- Middleware tenant resolver yang optimal
- Script inisialisasi zero-to-one

## Glossary

- **System**: Platform SuperKafe secara keseluruhan
- **Tenant**: Restoran individual yang menggunakan platform
- **Database_Connection**: Koneksi ke database superkafe_v2
- **Tenant_Scoping_Plugin**: Plugin Mongoose yang otomatis menambahkan filter tenantId
- **Tenant_Resolver**: Middleware yang memvalidasi identitas tenant
- **AsyncLocalStorage**: Mekanisme Node.js untuk tracking context per request
- **Init_Universe**: Script seed untuk inisialisasi tenant pertama
- **Legacy_Database**: Database lama yang dibuat per tenant
- **Unified_Database**: Database tunggal superkafe_v2
- **Tenant_Slug**: Identifier unik tenant (contoh: 'negoes')
- **Admin_User**: User dengan role administrator
- **Menu_Category**: Kategori menu dalam sistem

## Requirements

### Requirement 1: Sentralisasi Koneksi Database

**User Story:** Sebagai System Administrator, saya ingin sistem hanya terhubung ke satu database superkafe_v2, sehingga tidak ada lagi database sampah yang dibuat secara dinamis di VPS.

#### Acceptance Criteria

1. THE Database_Connection SHALL connect exclusively to superkafe_v2 database
2. WHEN the application starts, THE System SHALL establish a single connection to Unified_Database
3. THE System SHALL NOT create new databases dynamically for any tenant
4. THE System SHALL NOT switch between multiple databases during runtime
5. WHEN querying data, THE Database_Connection SHALL always use superkafe_v2 database
6. THE System SHALL remove all legacy multi-database creation logic from codebase

### Requirement 2: Implementasi Automatic Tenant Scoping

**User Story:** Sebagai Developer, saya ingin semua query database otomatis di-filter berdasarkan tenantId tanpa harus menambahkan filter manual, sehingga kode lebih bersih dan tidak ada risiko kebocoran data antar tenant.

#### Acceptance Criteria

1. WHEN a Mongoose model is defined, THE Tenant_Scoping_Plugin SHALL be automatically applied
2. WHEN saving a document, THE Tenant_Scoping_Plugin SHALL automatically stamp the tenantId field
3. WHEN querying documents, THE Tenant_Scoping_Plugin SHALL automatically filter by current tenantId
4. THE Tenant_Scoping_Plugin SHALL use AsyncLocalStorage to retrieve current tenant context
5. WHEN no tenant context exists, THE Tenant_Scoping_Plugin SHALL throw an error preventing data access
6. THE Tenant_Scoping_Plugin SHALL work transparently without requiring manual parameter passing
7. WHEN updating documents, THE Tenant_Scoping_Plugin SHALL ensure tenantId cannot be modified
8. WHEN deleting documents, THE Tenant_Scoping_Plugin SHALL only delete documents matching current tenantId

### Requirement 3: Optimasi Tenant Resolver Middleware

**User Story:** Sebagai Developer, saya ingin middleware tenant resolver yang efisien memvalidasi identitas tenant dari header request, sehingga hanya tenant yang terdaftar dan aktif yang dapat mengakses sistem.

#### Acceptance Criteria

1. WHEN a request arrives, THE Tenant_Resolver SHALL extract tenant slug from x-tenant-slug header
2. WHEN tenant slug is missing, THE Tenant_Resolver SHALL return 400 Bad Request error
3. WHEN tenant slug is provided, THE Tenant_Resolver SHALL validate against tenants collection in Unified_Database
4. WHEN tenant is not found, THE Tenant_Resolver SHALL return 404 Tenant Not Found error
5. WHEN tenant is inactive, THE Tenant_Resolver SHALL return 403 Forbidden error
6. WHEN tenant is valid and active, THE Tenant_Resolver SHALL store tenant context in AsyncLocalStorage
7. THE Tenant_Resolver SHALL NOT query Legacy_Database for tenant validation
8. THE Tenant_Resolver SHALL cache tenant information to minimize database queries

### Requirement 4: Transformasi Mongoose Models

**User Story:** Sebagai Developer, saya ingin semua Mongoose models menggunakan Tenant_Scoping_Plugin, sehingga isolasi tenant terjamin di seluruh aplikasi.

#### Acceptance Criteria

1. WHEN defining a Mongoose schema, THE System SHALL include tenantId field as required
2. WHEN applying plugins, THE System SHALL apply Tenant_Scoping_Plugin to all tenant-scoped models
3. THE System SHALL ensure tenantId field is indexed for query performance
4. WHEN a model does not require tenant scoping, THE System SHALL explicitly document the exception
5. THE System SHALL validate that all existing models have been migrated to use Tenant_Scoping_Plugin
6. WHEN creating indexes, THE System SHALL include tenantId in compound indexes where appropriate

### Requirement 5: Script Inisialisasi Zero-to-One

**User Story:** Sebagai System Administrator, saya ingin script seed yang membuat tenant pertama 'Negoes' dengan admin user dan menu dasar, sehingga sistem siap digunakan setelah deployment.

#### Acceptance Criteria

1. WHEN initUniverse script runs, THE Init_Universe SHALL create tenant 'Negoes' in Unified_Database
2. WHEN creating tenant, THE Init_Universe SHALL register main Admin_User with valid credentials
3. WHEN seeding data, THE Init_Universe SHALL create basic Menu_Category entries
4. THE Init_Universe SHALL validate that superkafe_v2 database exists before seeding
5. WHEN tenant 'Negoes' already exists, THE Init_Universe SHALL skip creation and report status
6. WHEN seeding completes, THE Init_Universe SHALL output success confirmation with created data summary
7. THE Init_Universe SHALL NOT create any Legacy_Database instances
8. WHEN errors occur, THE Init_Universe SHALL rollback all changes and report detailed error messages

### Requirement 6: Pembersihan Legacy Code

**User Story:** Sebagai Developer, saya ingin semua kode legacy multi-database dihapus dari codebase, sehingga tidak ada confusion dan maintenance lebih mudah.

#### Acceptance Criteria

1. THE System SHALL remove all dynamic database creation functions from codebase
2. THE System SHALL remove all database switching logic from controllers and services
3. THE System SHALL remove all references to tenant-specific database names
4. THE System SHALL update all database connection references to use centralized Database_Connection
5. WHEN searching codebase, THE System SHALL have zero references to legacy database creation patterns
6. THE System SHALL remove unused database connection utilities
7. THE System SHALL update documentation to reflect new single database architecture

### Requirement 7: Validasi Data Isolation

**User Story:** Sebagai Tenant User, saya ingin memastikan data saya tidak dapat diakses oleh tenant lain, sehingga privasi dan keamanan data terjamin.

#### Acceptance Criteria

1. WHEN querying data, THE System SHALL only return documents matching current tenant context
2. WHEN attempting cross-tenant access, THE System SHALL prevent data leakage
3. WHEN saving data, THE System SHALL ensure tenantId is immutable after creation
4. WHEN performing aggregations, THE System SHALL automatically include tenantId filter
5. THE System SHALL validate tenant isolation through automated property-based tests
6. WHEN admin operations are performed, THE System SHALL explicitly require elevated permissions for cross-tenant access

### Requirement 8: Performance Optimization

**User Story:** Sebagai System Administrator, saya ingin sistem berjalan dengan performa tinggi setelah migrasi ke single database, sehingga response time tetap cepat meskipun data dari banyak tenant berada dalam satu database.

#### Acceptance Criteria

1. WHEN querying tenant data, THE System SHALL utilize tenantId indexes for fast filtering
2. THE System SHALL maintain query response time under 100ms for typical operations
3. WHEN multiple tenants access simultaneously, THE System SHALL handle concurrent requests without degradation
4. THE System SHALL use connection pooling efficiently for Unified_Database
5. WHEN monitoring performance, THE System SHALL show improved metrics compared to legacy multi-database approach
6. THE System SHALL implement query optimization for tenant-scoped operations

### Requirement 9: Migration Safety

**User Story:** Sebagai DevOps Engineer, saya ingin proses migrasi dari multi-database ke single database aman dan dapat di-rollback, sehingga tidak ada data loss jika terjadi masalah.

#### Acceptance Criteria

1. WHEN migration starts, THE System SHALL create backup of all Legacy_Database instances
2. THE System SHALL validate data integrity before and after migration
3. WHEN migration fails, THE System SHALL provide rollback mechanism to restore Legacy_Database
4. THE System SHALL log all migration steps for audit trail
5. WHEN migration completes, THE System SHALL verify all tenant data is accessible in Unified_Database
6. THE System SHALL provide migration status dashboard showing progress per tenant
7. WHEN data conflicts occur, THE System SHALL handle them gracefully with clear error messages

### Requirement 10: Developer Experience

**User Story:** Sebagai Developer, saya ingin bekerja dengan arsitektur baru yang intuitif dan well-documented, sehingga onboarding developer baru cepat dan development velocity meningkat.

#### Acceptance Criteria

1. THE System SHALL provide comprehensive documentation for Unified Nexus Architecture
2. THE System SHALL include code examples for common tenant-scoped operations
3. WHEN writing new features, THE System SHALL provide clear patterns for tenant isolation
4. THE System SHALL include automated tests demonstrating correct usage of Tenant_Scoping_Plugin
5. THE System SHALL provide debugging tools for troubleshooting tenant context issues
6. WHEN errors occur, THE System SHALL provide clear error messages indicating tenant context problems
7. THE System SHALL include migration guide from legacy patterns to new architecture

### Requirement 11: Monitoring dan Observability

**User Story:** Sebagai DevOps Engineer, saya ingin monitoring yang jelas untuk single database architecture, sehingga dapat mendeteksi dan mengatasi masalah dengan cepat.

#### Acceptance Criteria

1. THE System SHALL log all tenant context initialization events
2. THE System SHALL track database connection pool metrics
3. WHEN tenant validation fails, THE System SHALL log detailed error information
4. THE System SHALL provide dashboard showing active tenants and their data volume
5. THE System SHALL alert when database connection issues occur
6. THE System SHALL track query performance per tenant
7. WHEN anomalies detected, THE System SHALL trigger alerts to operations team

### Requirement 12: Deployment Readiness

**User Story:** Sebagai DevOps Engineer, saya ingin sistem siap untuk deployment production dengan konfigurasi yang jelas, sehingga rollout ke production smooth dan predictable.

#### Acceptance Criteria

1. THE System SHALL provide environment-specific configuration for Unified_Database connection
2. THE System SHALL include health check endpoints validating database connectivity
3. WHEN deploying, THE System SHALL run Init_Universe script automatically if needed
4. THE System SHALL validate all required environment variables before starting
5. THE System SHALL provide deployment checklist documenting all migration steps
6. WHEN scaling horizontally, THE System SHALL handle multiple application instances sharing Unified_Database
7. THE System SHALL include rollback procedures in deployment documentation
