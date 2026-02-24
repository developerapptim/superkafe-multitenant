const tenantResolver = require('../../middleware/tenantResolver');
const Tenant = require('../../models/Tenant');
const { getTenantContext, setTenantContext } = require('../../utils/tenantContext');

// Mock dependencies
jest.mock('../../models/Tenant');
jest.mock('../../utils/tenantContext');

describe('tenantResolver Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Clear tenant cache before each test
    const { clearTenantCache } = require('../../middleware/tenantResolver');
    clearTenantCache();

    // Setup request, response, and next function
    req = {
      headers: {},
      path: '/api/test',
      method: 'GET',
      ip: '127.0.0.1'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();
  });

  describe('Requirement 3.3: Attach tenant context to request object', () => {
    it('should attach req.tenant with metadata after resolving tenant', async () => {
      // Arrange
      const mockTenant = {
        _id: 'tenant123',
        name: 'Test Cafe',
        slug: 'test-cafe',
        dbName: 'superkafe_v2',
        isActive: true
      };

      req.headers['x-tenant-slug'] = 'test-cafe';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTenant)
      });

      // Act
      await tenantResolver(req, res, next);

      // Assert - Verify req.tenant is set with correct structure
      expect(req.tenant).toBeDefined();
      expect(req.tenant).toEqual({
        id: mockTenant._id.toString(),
        name: mockTenant.name,
        slug: mockTenant.slug,
        dbName: 'superkafe_v2' // Always unified database
      });
      expect(setTenantContext).toHaveBeenCalledWith(req.tenant);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Requirement 3.4: Provide tenant metadata and set tenant context', () => {
    it('should attach req.tenant and call setTenantContext', async () => {
      // Arrange
      const mockTenant = {
        _id: 'tenant456',
        name: 'Another Cafe',
        slug: 'another-cafe',
        dbName: 'superkafe_v2',
        isActive: true
      };

      req.headers['x-tenant-slug'] = 'another-cafe';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTenant)
      });

      // Act
      await tenantResolver(req, res, next);

      // Assert - Verify tenant metadata is available and context is set
      expect(req.tenant).toBeDefined();
      expect(req.tenant.dbName).toBe('superkafe_v2');
      expect(setTenantContext).toHaveBeenCalledWith(req.tenant);
      expect(next).toHaveBeenCalled();
    });

    it('should call setTenantContext with tenant metadata', async () => {
      // Arrange
      const mockTenant = {
        _id: 'tenant789',
        name: 'Third Cafe',
        slug: 'third-cafe',
        dbName: 'superkafe_v2',
        isActive: true
      };

      req.headers['x-tenant-slug'] = 'third-cafe';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTenant)
      });

      // Act
      await tenantResolver(req, res, next);

      // Assert - Verify tenant context is set
      expect(req.tenant).toBeDefined();
      expect(setTenantContext).toHaveBeenCalledWith({
        id: mockTenant._id.toString(),
        name: mockTenant.name,
        slug: mockTenant.slug,
        dbName: 'superkafe_v2'
      });
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return 400 if x-tenant-slug header is missing', async () => {
      // Arrange - no x-tenant-slug header

      // Act
      await tenantResolver(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Header x-tenant-slug atau x-tenant-id wajib disertakan',
        code: 'TENANT_HEADER_MISSING'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 if tenant is not found', async () => {
      // Arrange
      req.headers['x-tenant-slug'] = 'nonexistent-cafe';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      });

      // Act
      await tenantResolver(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Tenant tidak ditemukan atau tidak aktif',
        code: 'TENANT_NOT_FOUND'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if tenant is inactive', async () => {
      // Arrange
      const mockTenant = {
        _id: 'tenant999',
        name: 'Inactive Cafe',
        slug: 'inactive-cafe',
        dbName: 'superkafe_v2',
        isActive: false,
        status: 'suspended'
      };

      req.headers['x-tenant-slug'] = 'inactive-cafe';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTenant)
      });

      // Act
      await tenantResolver(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Tenant tidak ditemukan atau tidak aktif',
        code: 'TENANT_INACTIVE'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 on cross-tenant access attempt', async () => {
      // Arrange
      const mockTenant = {
        _id: 'tenant888',
        name: 'Target Cafe',
        slug: 'target-cafe',
        dbName: 'superkafe_v2',
        isActive: true
      };

      req.headers['x-tenant-slug'] = 'target-cafe';
      req.user = {
        id: 'user123',
        email: 'user@attacker.com',
        tenant: 'attacker-cafe' // Different tenant
      };

      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTenant)
      });

      // Act
      await tenantResolver(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized access to tenant data',
        code: 'CROSS_TENANT_ACCESS'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 500 if tenant resolution fails', async () => {
      // Arrange
      req.headers['x-tenant-slug'] = 'test-cafe';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      });

      // Act
      await tenantResolver(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Terjadi kesalahan saat memproses tenant',
        code: 'TENANT_RESOLUTION_ERROR'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Caching', () => {
    it('should cache tenant lookups', async () => {
      // Arrange
      const mockTenant = {
        _id: 'tenant123',
        name: 'Cached Cafe',
        slug: 'cached-cafe',
        dbName: 'superkafe_v2',
        isActive: true
      };

      req.headers['x-tenant-slug'] = 'cached-cafe';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTenant)
      });

      // Act - First request
      await tenantResolver(req, res, next);
      
      // Reset mocks for second request
      jest.clearAllMocks();
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTenant)
      });

      // Act - Second request (should use cache)
      const req2 = {
        headers: { 'x-tenant-slug': 'cached-cafe' },
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1'
      };
      const res2 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next2 = jest.fn();

      await tenantResolver(req2, res2, next2);

      // Assert - Database should not be queried on second request
      expect(Tenant.findOne).not.toHaveBeenCalled();
      expect(req2.tenant).toBeDefined();
      expect(next2).toHaveBeenCalled();
    });

    it('should handle case-insensitive cache keys', async () => {
      // Arrange
      const mockTenant = {
        _id: 'tenant123',
        name: 'Case Test Cafe',
        slug: 'case-test',
        dbName: 'superkafe_v2',
        isActive: true
      };

      req.headers['x-tenant-slug'] = 'Case-Test';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTenant)
      });

      // Act - First request with mixed case
      await tenantResolver(req, res, next);
      
      // Reset mocks
      jest.clearAllMocks();

      // Act - Second request with different case (should use cache)
      const req2 = {
        headers: { 'x-tenant-slug': 'CASE-TEST' },
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1'
      };
      const res2 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next2 = jest.fn();

      await tenantResolver(req2, res2, next2);

      // Assert - Should use cache despite different case
      expect(Tenant.findOne).not.toHaveBeenCalled();
      expect(req2.tenant).toBeDefined();
      expect(next2).toHaveBeenCalled();
    });
  });
});
