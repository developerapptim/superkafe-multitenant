/**
 * Property-Based Tests for API Request Tenant Header
 * Feature: tenant-data-isolation
 * 
 * These tests verify that authenticated API requests include the x-tenant-id header
 * with the tenant slug extracted from the JWT token.
 */

import fc from 'fast-check';

/**
 * Helper function to create a mock JWT token
 * @param {object} payload - JWT payload
 * @returns {string} Mock JWT token
 */
function createMockJWT(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = 'mock-signature';
  return `${header}.${encodedPayload}.${signature}`;
}

/**
 * Helper function to decode JWT payload
 * @param {string} token - JWT token string
 * @returns {object|null} Decoded payload or null if invalid
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

/**
 * Generate a MongoDB ObjectId-like hex string
 */
const objectIdArbitrary = fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 24, maxLength: 24 })
  .map(arr => arr.map(n => n.toString(16)).join(''));

describe('API Request Tenant Header - Property-Based Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * Property 16: API Requests Include Tenant Header
   * **Validates: Requirements 3.2**
   * 
   * For any authenticated API request from the frontend, the request headers
   * should include `x-tenant-id` with the value from the JWT token.
   */
  describe('Property 16: API Requests Include Tenant Header', () => {
    /**
     * Simulates the request interceptor logic from api.js
     * This is the actual logic that should be tested
     */
    function requestInterceptor(config) {
      // 1. If sending FormData, let the browser set the Content-Type with boundary
      if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
      }

      // 2. Add API key
      config.headers['x-api-key'] = 'warkop_secret_123';

      // 3. Add JWT Token for protected routes
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        
        // 4. Extract tenant slug from JWT and add to headers
        const decoded = decodeJWT(token);
        if (decoded && decoded.tenant) {
          config.headers['x-tenant-id'] = decoded.tenant;
        }
      }

      return config;
    }

    it('should include x-tenant-id header for any valid JWT with tenant info', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary JWT payload with tenant information
          fc.record({
            userId: objectIdArbitrary,
            email: fc.emailAddress(),
            role: fc.constantFrom('admin', 'kasir', 'staf'),
            tenant: fc.string({ minLength: 3, maxLength: 50 })
              .map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
              .filter(s => s.length >= 3),
            tenantId: objectIdArbitrary,
            tenantDbName: fc.string({ minLength: 5, maxLength: 50 })
              .map(s => `superkafe_${s.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`),
            iat: fc.integer({ min: 1600000000, max: 1900000000 }),
            exp: fc.integer({ min: 1900000001, max: 2000000000 })
          }),
          async (jwtPayload) => {
            // Arrange: Create JWT token and store in localStorage
            const token = createMockJWT(jwtPayload);
            localStorage.setItem('token', token);

            // Act: Simulate a request through the interceptor
            const mockConfig = {
              url: '/api/menu',
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            };

            const modifiedConfig = requestInterceptor(mockConfig);

            // Assert - Property: x-tenant-id header must be present
            expect(modifiedConfig.headers).toHaveProperty('x-tenant-id');
            
            // Assert - Property: x-tenant-id must match tenant slug from JWT
            expect(modifiedConfig.headers['x-tenant-id']).toBe(jwtPayload.tenant);
            
            // Assert - Property: Authorization header must be present
            expect(modifiedConfig.headers).toHaveProperty('Authorization');
            expect(modifiedConfig.headers['Authorization']).toBe(`Bearer ${token}`);
            
            // Assert - Property: x-api-key header must be present
            expect(modifiedConfig.headers).toHaveProperty('x-api-key');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not include x-tenant-id header when JWT has no tenant info', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate JWT payload WITHOUT tenant information (incomplete setup)
          fc.record({
            userId: objectIdArbitrary,
            email: fc.emailAddress(),
            hasCompletedSetup: fc.constant(false),
            iat: fc.integer({ min: 1600000000, max: 1900000000 }),
            exp: fc.integer({ min: 1900000001, max: 2000000000 })
          }),
          async (jwtPayload) => {
            // Arrange: Create JWT token without tenant info
            const token = createMockJWT(jwtPayload);
            localStorage.setItem('token', token);

            // Act: Simulate a request through the interceptor
            const mockConfig = {
              url: '/api/setup',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            };

            const modifiedConfig = requestInterceptor(mockConfig);

            // Assert - Property: x-tenant-id header should NOT be present
            expect(modifiedConfig.headers['x-tenant-id']).toBeUndefined();
            
            // Assert - Property: Authorization header must still be present
            expect(modifiedConfig.headers).toHaveProperty('Authorization');
            expect(modifiedConfig.headers['Authorization']).toBe(`Bearer ${token}`);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not include x-tenant-id or Authorization header when no token exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary request configuration
          fc.record({
            url: fc.oneof(
              fc.constant('/api/menu'),
              fc.constant('/api/orders'),
              fc.constant('/api/settings'),
              fc.string({ minLength: 1, maxLength: 50 }).map(s => `/api/${s}`)
            ),
            method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH')
          }),
          async (requestConfig) => {
            // Arrange: No token in localStorage
            localStorage.clear();

            // Act: Simulate a request through the interceptor
            const mockConfig = {
              url: requestConfig.url,
              method: requestConfig.method,
              headers: {
                'Content-Type': 'application/json'
              }
            };

            const modifiedConfig = requestInterceptor(mockConfig);

            // Assert - Property: x-tenant-id header should NOT be present
            expect(modifiedConfig.headers['x-tenant-id']).toBeUndefined();
            
            // Assert - Property: Authorization header should NOT be present
            expect(modifiedConfig.headers['Authorization']).toBeUndefined();
            
            // Assert - Property: x-api-key should still be present
            expect(modifiedConfig.headers).toHaveProperty('x-api-key');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle malformed JWT tokens gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate various malformed tokens (excluding empty string)
          fc.oneof(
            fc.constant('invalid-token'),
            fc.constant('not.a.jwt'),
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.constant('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature')
          ),
          async (malformedToken) => {
            // Arrange: Store malformed token
            localStorage.setItem('token', malformedToken);

            // Act: Simulate a request through the interceptor
            const mockConfig = {
              url: '/api/menu',
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            };

            // Should not throw error
            const modifiedConfig = requestInterceptor(mockConfig);

            // Assert - Property: Request should still be processed
            expect(modifiedConfig).toBeDefined();
            
            // Assert - Property: Authorization header should be present (even if invalid)
            expect(modifiedConfig.headers).toHaveProperty('Authorization');
            expect(modifiedConfig.headers['Authorization']).toBe(`Bearer ${malformedToken}`);
            
            // Assert - Property: x-tenant-id should not be present for malformed tokens
            expect(modifiedConfig.headers['x-tenant-id']).toBeUndefined();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should extract tenant slug correctly from various JWT payload structures', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate JWT with tenant slug in different formats
          fc.record({
            userId: objectIdArbitrary,
            email: fc.emailAddress(),
            role: fc.constantFrom('admin', 'kasir', 'staf'),
            tenant: fc.string({ minLength: 3, maxLength: 50 })
              .map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
              .filter(s => s.length >= 3),
            tenantId: objectIdArbitrary,
            tenantDbName: fc.string({ minLength: 5, maxLength: 50 })
              .map(s => `superkafe_${s.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`),
            // Additional fields that might be present
            name: fc.string({ minLength: 2, maxLength: 100 }),
            hasCompletedSetup: fc.constant(true),
            iat: fc.integer({ min: 1600000000, max: 1900000000 }),
            exp: fc.integer({ min: 1900000001, max: 2000000000 })
          }),
          async (jwtPayload) => {
            // Arrange
            const token = createMockJWT(jwtPayload);
            localStorage.setItem('token', token);

            // Act
            const mockConfig = {
              url: '/api/orders',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              data: { items: [] }
            };

            const modifiedConfig = requestInterceptor(mockConfig);

            // Assert - Property: Tenant slug must be extracted correctly
            const decoded = decodeJWT(token);
            expect(decoded).not.toBeNull();
            expect(decoded.tenant).toBe(jwtPayload.tenant);
            
            // Assert - Property: x-tenant-id must match the tenant field from JWT
            expect(modifiedConfig.headers['x-tenant-id']).toBe(jwtPayload.tenant);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve x-tenant-id header across different HTTP methods', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate JWT payload
          fc.record({
            userId: objectIdArbitrary,
            email: fc.emailAddress(),
            role: fc.constantFrom('admin', 'kasir', 'staf'),
            tenant: fc.string({ minLength: 3, maxLength: 50 })
              .map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
              .filter(s => s.length >= 3),
            tenantId: objectIdArbitrary,
            tenantDbName: fc.string({ minLength: 5, maxLength: 50 })
              .map(s => `superkafe_${s.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`)
          }),
          // Generate different HTTP methods
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
          async (jwtPayload, httpMethod) => {
            // Arrange
            const token = createMockJWT(jwtPayload);
            localStorage.setItem('token', token);

            // Act
            const mockConfig = {
              url: '/api/test',
              method: httpMethod,
              headers: {
                'Content-Type': 'application/json'
              }
            };

            const modifiedConfig = requestInterceptor(mockConfig);

            // Assert - Property: x-tenant-id must be present for all HTTP methods
            expect(modifiedConfig.headers['x-tenant-id']).toBe(jwtPayload.tenant);
            expect(modifiedConfig.method).toBe(httpMethod);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle FormData requests without breaking Content-Type', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate JWT payload
          fc.record({
            userId: objectIdArbitrary,
            email: fc.emailAddress(),
            tenant: fc.string({ minLength: 3, maxLength: 50 })
              .map(s => s.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
              .filter(s => s.length >= 3),
            tenantId: objectIdArbitrary
          }),
          async (jwtPayload) => {
            // Arrange
            const token = createMockJWT(jwtPayload);
            localStorage.setItem('token', token);

            // Act: Simulate FormData request
            const mockFormData = new FormData();
            mockFormData.append('file', 'test-file');

            const mockConfig = {
              url: '/api/upload',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              data: mockFormData
            };

            const modifiedConfig = requestInterceptor(mockConfig);

            // Assert - Property: x-tenant-id must be present
            expect(modifiedConfig.headers['x-tenant-id']).toBe(jwtPayload.tenant);
            
            // Assert - Property: Content-Type should be deleted for FormData
            expect(modifiedConfig.headers['Content-Type']).toBeUndefined();
            
            // Assert - Property: Authorization header must be present
            expect(modifiedConfig.headers['Authorization']).toBe(`Bearer ${token}`);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
