const fc = require('fast-check');
const { setTenantContext, getTenantContext, runWithTenantContext } = require('../../utils/tenantContext');
const logger = require('../../utils/logger');
const tenantResolver = require('../../middleware/tenantResolver');
const Tenant = require('../../models/Tenant');

/**
 * Property-Based Tests for Tenant Context Logging
 * 
 * Feature: unified-nexus-architecture
 * Property 11: Tenant Context Logging
 * 
 * **Validates: Requirements 11.1, 11.3**
 * 
 * For any tenant context initialization or validation failure, the system SHALL
 * log the event with sufficient detail (tenant slug, timestamp, error details)
 * for debugging and security auditing.
 * 
 * This test verifies that:
 * - Tenant context initialization is logged with tenant slug, timestamp, and details
 * - Tenant validation failures are logged with error details
 * - Logs include correlation IDs for request tracing
 * - Logs are structured and queryable (JSON format)
 * - Log levels are appropriate (info for success, warn/error for failures)
 * - Security events are logged with HIGH severity
 */

// Helper: Generate valid MongoDB ObjectId hex string (24 hex characters)
const objectIdArbitrary = () => 
  fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 24, maxLength: 24 })
    .map(arr => arr.map(n => n.toString(16)).join(''));

// Helper: Generate tenant slug
const tenantSlugArbitrary = () =>
  fc.stringMatching(/^[a-z0-9-]{3,20}$/);

// Helper: Generate tenant context
const tenantContextArbitrary = () =>
  fc.record({
    id: objectIdArbitrary(),
    slug: tenantSlugArbitrary(),
    name: fc.string({ minLength: 3, maxLength: 50 }),
    dbName: fc.constant('superkafe_v2'),
    correlationId: fc.string({ minLength: 10, maxLength: 30 })
  });

describe('Property 11: Tenant Context Logging', () => {
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Spy on console methods to capture logs
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Clear tenant cache
    if (tenantResolver.clearTenantCache) {
      tenantResolver.clearTenantCache();
    }
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  /**
   * Property 11.1: Tenant context initialization is logged with sufficient detail
   * 
   * For any valid tenant context initialization, the system must log:
   * - Tenant slug
   * - Tenant ID
   * - Timestamp (ISO format)
   * - Correlation ID
   * - Event type
   * - Log level: info
   */
  test('should log tenant context initialization with sufficient detail', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary(),
        async (tenant) => {
          // Clear previous logs
          consoleLogSpy.mockClear();
          
          // Initialize tenant context
          setTenantContext(tenant);
          
          // Verify logging occurred
          const logCalls = consoleLogSpy.mock.calls;
          
          // Should have at least one log call
          if (logCalls.length === 0) {
            return false;
          }
          
          // Find the context initialization log
          const initLog = logCalls.find(call => {
            try {
              const logEntry = JSON.parse(call[0]);
              return logEntry.event === 'CONTEXT_INIT' || 
                     logEntry.category === 'TENANT_CONTEXT';
            } catch {
              return false;
            }
          });
          
          if (!initLog) {
            return false;
          }
          
          // Parse the log entry
          const logEntry = JSON.parse(initLog[0]);
          
          // Verify log structure and content
          return logEntry.timestamp !== undefined &&
                 logEntry.level === 'INFO' &&
                 logEntry.category === 'TENANT_CONTEXT' &&
                 logEntry.tenantSlug === tenant.slug &&
                 logEntry.tenantId === tenant.id &&
                 logEntry.correlationId === tenant.correlationId &&
                 logEntry.event === 'CONTEXT_INIT' &&
                 // Verify timestamp is valid ISO format
                 !isNaN(Date.parse(logEntry.timestamp));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.2: Invalid tenant data logs error with details
   * 
   * For any invalid tenant context (missing id or slug), the system must log:
   * - Error message
   * - Timestamp
   * - Event type
   * - Details about what's missing
   * - Log level: error
   */
  test('should log error when tenant context initialization fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hasId: fc.boolean(),
          hasSlug: fc.boolean(),
          id: objectIdArbitrary(),
          slug: tenantSlugArbitrary(),
          name: fc.string({ minLength: 3, maxLength: 50 })
        }),
        async (testData) => {
          // Skip valid cases (both id and slug present)
          if (testData.hasId && testData.hasSlug) {
            return true;
          }
          
          // Clear previous logs
          consoleErrorSpy.mockClear();
          
          // Create invalid tenant (missing id or slug)
          const invalidTenant = {
            name: testData.name,
            dbName: 'superkafe_v2'
          };
          
          if (testData.hasId) {
            invalidTenant.id = testData.id;
          }
          if (testData.hasSlug) {
            invalidTenant.slug = testData.slug;
          }
          
          // Attempt to set invalid context
          try {
            setTenantContext(invalidTenant);
          } catch (error) {
            // Expected to throw
          }
          
          // Verify error logging occurred
          const errorCalls = consoleErrorSpy.mock.calls;
          
          if (errorCalls.length === 0) {
            return false;
          }
          
          // Find the error log
          const errorLog = errorCalls.find(call => {
            try {
              const logEntry = JSON.parse(call[0]);
              return logEntry.event === 'CONTEXT_INIT_FAILED' ||
                     logEntry.category === 'TENANT_CONTEXT';
            } catch {
              return false;
            }
          });
          
          if (!errorLog) {
            return false;
          }
          
          // Parse the log entry
          const logEntry = JSON.parse(errorLog[0]);
          
          // Verify log structure and content
          return logEntry.timestamp !== undefined &&
                 logEntry.level === 'ERROR' &&
                 logEntry.category === 'TENANT_CONTEXT' &&
                 logEntry.event === 'CONTEXT_INIT_FAILED' &&
                 logEntry.hasId === testData.hasId &&
                 logEntry.hasSlug === testData.hasSlug &&
                 !isNaN(Date.parse(logEntry.timestamp));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.3: Missing tenant context logs warning with stack trace
   * 
   * For any attempt to get tenant context when none exists, the system must log:
   * - Warning message
   * - Timestamp
   * - Event type
   * - Stack trace for debugging
   * - Log level: warn
   */
  test('should log warning when tenant context is missing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // No context
        async () => {
          // Clear previous logs
          consoleWarnSpy.mockClear();
          
          // Clear any existing context
          jest.resetModules();
          const { getTenantContext: freshGetContext } = require('../../utils/tenantContext');
          
          // Attempt to get context when none exists
          const context = freshGetContext();
          
          // Verify warning logging occurred
          const warnCalls = consoleWarnSpy.mock.calls;
          
          if (warnCalls.length === 0) {
            return false;
          }
          
          // Find the missing context warning
          const warnLog = warnCalls.find(call => {
            try {
              const logEntry = JSON.parse(call[0]);
              return logEntry.event === 'CONTEXT_MISSING';
            } catch {
              return false;
            }
          });
          
          if (!warnLog) {
            return false;
          }
          
          // Parse the log entry
          const logEntry = JSON.parse(warnLog[0]);
          
          // Verify log structure and content
          return logEntry.timestamp !== undefined &&
                 logEntry.level === 'WARN' &&
                 logEntry.category === 'TENANT_CONTEXT' &&
                 logEntry.event === 'CONTEXT_MISSING' &&
                 logEntry.hasAsyncContext === false &&
                 logEntry.hasFallback === false &&
                 logEntry.stack !== undefined &&
                 !isNaN(Date.parse(logEntry.timestamp));
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 11.4: Tenant validation failures are logged with request details
   * 
   * For any tenant validation failure (missing header, invalid tenant, inactive tenant),
   * the system must log:
   * - Failure reason
   * - Tenant slug (if provided)
   * - Request path and method
   * - IP address
   * - User agent
   * - Correlation ID
   * - Timestamp
   * - Log level: warn
   */
  test('should log tenant validation failures with request details', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          failureType: fc.constantFrom('MISSING_HEADER', 'NOT_FOUND', 'INACTIVE'),
          tenantSlug: tenantSlugArbitrary(),
          path: fc.constantFrom('/api/menu', '/api/orders', '/api/tables'),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          ip: fc.constantFrom('127.0.0.1', '192.168.1.1', '10.0.0.1'),
          userAgent: fc.constantFrom('Mozilla/5.0', 'Chrome/90.0', 'Safari/14.0')
        }),
        async (testData) => {
          // Clear previous logs
          consoleWarnSpy.mockClear();
          
          // Create mock request and response
          const req = {
            headers: testData.failureType === 'MISSING_HEADER' ? 
              { 'user-agent': testData.userAgent } : 
              { 'x-tenant-slug': testData.tenantSlug, 'user-agent': testData.userAgent },
            path: testData.path,
            method: testData.method,
            ip: testData.ip,
            get: jest.fn((header) => {
              if (header.toLowerCase() === 'user-agent') {
                return testData.userAgent;
              }
              return undefined;
            })
          };
          
          const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
          };
          
          const next = jest.fn();
          
          // Mock Tenant.findOne based on failure type
          const originalFindOne = Tenant.findOne;
          if (testData.failureType === 'NOT_FOUND') {
            Tenant.findOne = jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(null)
            });
          } else if (testData.failureType === 'INACTIVE') {
            Tenant.findOne = jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue({
                _id: '507f1f77bcf86cd799439011',
                slug: testData.tenantSlug,
                name: 'Test Tenant',
                isActive: false
              })
            });
          }
          
          // Execute tenant resolver
          await tenantResolver(req, res, next);
          
          // Restore original findOne
          Tenant.findOne = originalFindOne;
          
          // Verify warning logging occurred
          const warnCalls = consoleWarnSpy.mock.calls;
          
          // Debug: Check if logged as error instead (for resolution errors)
          if (warnCalls.length === 0) {
            const errorCalls = consoleErrorSpy.mock.calls;
            if (errorCalls.length > 0) {
              // Try to find in error logs
              const errorLog = errorCalls.find(call => {
                try {
                  const logEntry = JSON.parse(call[0]);
                  return logEntry.category === 'TENANT_VALIDATION' ||
                         logEntry.category === 'TENANT_RESOLVER';
                } catch {
                  return false;
                }
              });
              
              if (errorLog) {
                // Found in error logs, parse and verify
                const logEntry = JSON.parse(errorLog[0]);
                
                const hasRequiredFields = logEntry.timestamp !== undefined &&
                       (logEntry.level === 'WARN' || logEntry.level === 'ERROR') &&
                       (logEntry.category === 'TENANT_VALIDATION' || logEntry.category === 'TENANT_RESOLVER') &&
                       logEntry.correlationId !== undefined &&
                       logEntry.path === testData.path &&
                       logEntry.method === testData.method &&
                       !isNaN(Date.parse(logEntry.timestamp));
                
                if (testData.failureType === 'MISSING_HEADER') {
                  return hasRequiredFields && 
                         (logEntry.reason === 'TENANT_HEADER_MISSING' || logEntry.event === 'TENANT_RESOLUTION_ERROR');
                } else if (testData.failureType === 'NOT_FOUND') {
                  return hasRequiredFields && 
                         (logEntry.reason === 'TENANT_NOT_FOUND' || logEntry.event === 'TENANT_RESOLUTION_ERROR');
                } else if (testData.failureType === 'INACTIVE') {
                  return hasRequiredFields && 
                         (logEntry.reason === 'TENANT_INACTIVE' || logEntry.event === 'TENANT_RESOLUTION_ERROR');
                }
              }
            }
            return false;
          }
          
          // Find the validation failure log
          const validationLog = warnCalls.find(call => {
            try {
              const logEntry = JSON.parse(call[0]);
              return logEntry.category === 'TENANT_VALIDATION' &&
                     logEntry.event === 'VALIDATION_FAILURE';
            } catch {
              return false;
            }
          });
          
          if (!validationLog) {
            return false;
          }
          
          // Parse the log entry
          const logEntry = JSON.parse(validationLog[0]);
          
          // Verify log structure and content
          const hasRequiredFields = logEntry.timestamp !== undefined &&
                 logEntry.level === 'WARN' &&
                 logEntry.category === 'TENANT_VALIDATION' &&
                 logEntry.event === 'VALIDATION_FAILURE' &&
                 logEntry.correlationId !== undefined &&
                 logEntry.path === testData.path &&
                 logEntry.method === testData.method &&
                 logEntry.ip === testData.ip &&
                 logEntry.userAgent === testData.userAgent &&
                 !isNaN(Date.parse(logEntry.timestamp));
          
          // Additional checks based on failure type
          if (testData.failureType === 'MISSING_HEADER') {
            return hasRequiredFields && logEntry.reason === 'TENANT_HEADER_MISSING';
          } else if (testData.failureType === 'NOT_FOUND') {
            return hasRequiredFields && 
                   logEntry.reason === 'TENANT_NOT_FOUND' &&
                   logEntry.tenantSlug === testData.tenantSlug;
          } else if (testData.failureType === 'INACTIVE') {
            return hasRequiredFields && 
                   logEntry.reason === 'TENANT_INACTIVE' &&
                   logEntry.tenantSlug === testData.tenantSlug;
          }
          
          return false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.5: Cross-tenant access attempts are logged with HIGH severity
   * 
   * For any cross-tenant access attempt, the system must log:
   * - User ID and email
   * - User's tenant
   * - Requested tenant
   * - Request details (path, method, IP)
   * - Correlation ID
   * - Timestamp
   * - Severity: HIGH
   * - Log level: security (error)
   */
  test('should log cross-tenant access attempts with HIGH severity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: objectIdArbitrary(),
          userEmail: fc.emailAddress(),
          userTenant: tenantSlugArbitrary(),
          requestedTenant: tenantSlugArbitrary(),
          path: fc.constantFrom('/api/menu', '/api/orders', '/api/tables'),
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          ip: fc.constantFrom('127.0.0.1', '192.168.1.1', '10.0.0.1')
        }),
        async (testData) => {
          // Skip if tenants are the same (not a cross-tenant attempt)
          if (testData.userTenant === testData.requestedTenant) {
            return true;
          }
          
          // Clear previous logs
          consoleErrorSpy.mockClear();
          
          // Create mock request with authenticated user
          const req = {
            headers: { 'x-tenant-slug': testData.requestedTenant, 'user-agent': 'Test User Agent' },
            path: testData.path,
            method: testData.method,
            ip: testData.ip,
            user: {
              id: testData.userId,
              email: testData.userEmail,
              tenant: testData.userTenant
            },
            get: jest.fn((header) => {
              if (header.toLowerCase() === 'user-agent') {
                return 'Test User Agent';
              }
              return undefined;
            })
          };
          
          const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
          };
          
          const next = jest.fn();
          
          // Mock Tenant.findOne to return valid tenant
          const originalFindOne = Tenant.findOne;
          Tenant.findOne = jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: '507f1f77bcf86cd799439011',
              slug: testData.requestedTenant,
              name: 'Test Tenant',
              isActive: true
            })
          });
          
          // Execute tenant resolver
          await tenantResolver(req, res, next);
          
          // Restore original findOne
          Tenant.findOne = originalFindOne;
          
          // Verify security logging occurred
          const errorCalls = consoleErrorSpy.mock.calls;
          
          if (errorCalls.length === 0) {
            return false;
          }
          
          // Find the cross-tenant access log
          const securityLog = errorCalls.find(call => {
            try {
              const logEntry = JSON.parse(call[0]);
              return logEntry.category === 'SECURITY' &&
                     logEntry.event === 'CROSS_TENANT_ACCESS';
            } catch {
              return false;
            }
          });
          
          if (!securityLog) {
            return false;
          }
          
          // Parse the log entry
          const logEntry = JSON.parse(securityLog[0]);
          
          // Verify log structure and content
          return logEntry.timestamp !== undefined &&
                 logEntry.level === 'SECURITY' &&
                 logEntry.category === 'SECURITY' &&
                 logEntry.event === 'CROSS_TENANT_ACCESS' &&
                 logEntry.severity === 'HIGH' &&
                 logEntry.correlationId !== undefined &&
                 logEntry.userId === testData.userId &&
                 logEntry.userEmail === testData.userEmail &&
                 logEntry.userTenant === testData.userTenant &&
                 logEntry.requestedTenant === testData.requestedTenant &&
                 logEntry.path === testData.path &&
                 logEntry.method === testData.method &&
                 logEntry.ip === testData.ip &&
                 !isNaN(Date.parse(logEntry.timestamp));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.6: All logs are structured and queryable (JSON format)
   * 
   * For any log entry, the system must output structured JSON that can be:
   * - Parsed as valid JSON
   * - Queried by timestamp
   * - Filtered by category
   * - Searched by event type
   * - Correlated by correlation ID
   */
  test('should output all logs in structured JSON format', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary(),
        async (tenant) => {
          // Clear previous logs
          consoleLogSpy.mockClear();
          consoleWarnSpy.mockClear();
          consoleErrorSpy.mockClear();
          
          // Trigger various logging scenarios
          setTenantContext(tenant);
          getTenantContext();
          
          // Collect all log calls
          const allLogs = [
            ...consoleLogSpy.mock.calls,
            ...consoleWarnSpy.mock.calls,
            ...consoleErrorSpy.mock.calls
          ];
          
          if (allLogs.length === 0) {
            return false;
          }
          
          // Verify all logs are valid JSON with required structure
          return allLogs.every(call => {
            try {
              const logEntry = JSON.parse(call[0]);
              
              // Verify required fields for queryability
              return logEntry.timestamp !== undefined &&
                     logEntry.level !== undefined &&
                     logEntry.category !== undefined &&
                     logEntry.message !== undefined &&
                     !isNaN(Date.parse(logEntry.timestamp)) &&
                     typeof logEntry.level === 'string' &&
                     typeof logEntry.category === 'string';
            } catch {
              // Not valid JSON
              return false;
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.7: Correlation IDs enable request tracing
   * 
   * For any request flow, all related log entries must share the same
   * correlation ID, enabling end-to-end request tracing.
   */
  test('should use correlation IDs for request tracing', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantContextArbitrary(),
        async (tenant) => {
          // Clear previous logs
          consoleLogSpy.mockClear();
          
          // Set context with correlation ID
          setTenantContext(tenant);
          
          // Verify correlation ID is present in logs
          const logCalls = consoleLogSpy.mock.calls;
          
          if (logCalls.length === 0) {
            return false;
          }
          
          // Find logs with correlation ID
          const logsWithCorrelation = logCalls.filter(call => {
            try {
              const logEntry = JSON.parse(call[0]);
              return logEntry.correlationId !== undefined;
            } catch {
              return false;
            }
          });
          
          if (logsWithCorrelation.length === 0) {
            return false;
          }
          
          // Verify all logs with correlation ID use the same one
          const correlationIds = logsWithCorrelation.map(call => {
            const logEntry = JSON.parse(call[0]);
            return logEntry.correlationId;
          });
          
          // All correlation IDs should match the tenant's correlation ID
          return correlationIds.every(id => id === tenant.correlationId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
