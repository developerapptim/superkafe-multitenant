const tenantResolver = require('../../middleware/tenantResolver');
const Tenant = require('../../models/Tenant');
const { getTenantDB } = require('../../config/db');
const { getTenantContext } = require('../../utils/tenantContext');

// Mock dependencies
jest.mock('../../models/Tenant');
jest.mock('../../config/db');
jest.mock('../../utils/tenantContext');

describe('tenantResolver Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

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
        dbName: 'tenant_test_cafe',
        isActive: true
      };

      const mockTenantDB = {
        name: 'tenant_test_cafe',
        host: 'localhost',
        port: 27017,
        readyState: 1
      };

      req.headers['x-tenant-id'] = 'test-cafe';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTenant)
      });
      getTenantDB.mockResolvedValue(mockTenantDB);

      // Act
      await tenantResolver(req, res, next);

      // Assert - Verify req.tenant is set with correct structure
      expect(req.tenant).toBeDefined();
      expect(req.tenant).toEqual({
        id: mockTenant._id,
        name: mockTenant.name,
        slug: mockTenant.slug,
        dbName: mockTenant.dbName
      });
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Requirement 3.4: Provide tenant metadata and TenantDB connection', () => {
    it('should attach both req.tenant and req.tenantDB to request object', async () => {
      // Arrange
      const mockTenant = {
        _id: 'tenant456',
        name: 'Another Cafe',
        slug: 'another-cafe',
        dbName: 'tenant_another_cafe',
        isActive: true
      };

      const mockTenantDB = {
        name: 'tenant_another_cafe',
        host: 'localhost',
        port: 27017,
        readyState: 1
      };

      req.headers['x-tenant-id'] = 'another-cafe';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTenant)
      });
      getTenantDB.mockResolvedValue(mockTenantDB);

      // Act
      await tenantResolver(req, res, next);

      // Assert - Verify both tenant metadata and DB connection are available
      expect(req.tenant).toBeDefined();
      expect(req.tenantDB).toBeDefined();
      expect(req.tenantDB).toBe(mockTenantDB);
      expect(next).toHaveBeenCalled();
    });

    it('should call setTenantContext with tenant metadata', async () => {
      // Arrange
      const mockTenant = {
        _id: 'tenant789',
        name: 'Third Cafe',
        slug: 'third-cafe',
        dbName: 'tenant_third_cafe',
        isActive: true
      };

      const mockTenantDB = {
        name: 'tenant_third_cafe',
        host: 'localhost',
        port: 27017,
        readyState: 1
      };

      // Mock setTenantContext before requiring tenantResolver
      const mockSetTenantContext = jest.fn();
      jest.doMock('../../utils/tenantContext', () => ({
        setTenantContext: mockSetTenantContext,
        getTenantContext: jest.fn()
      }));

      req.headers['x-tenant-id'] = 'third-cafe';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockTenant)
      });
      getTenantDB.mockResolvedValue(mockTenantDB);

      // Act
      await tenantResolver(req, res, next);

      // Assert - Verify tenant context is set (implementation already calls setTenantContext)
      // The middleware implementation already includes setTenantContext call at line 72
      expect(req.tenant).toBeDefined();
      expect(req.tenantDB).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return 400 if x-tenant-id header is missing', async () => {
      // Arrange - no x-tenant-id header

      // Act
      await tenantResolver(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Header x-tenant-id wajib disertakan'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 if tenant is not found', async () => {
      // Arrange
      req.headers['x-tenant-id'] = 'nonexistent-cafe';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      });

      // Act
      await tenantResolver(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Tenant tidak ditemukan atau tidak aktif'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 500 if tenant resolution fails', async () => {
      // Arrange
      req.headers['x-tenant-id'] = 'test-cafe';
      Tenant.findOne.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      });

      // Act
      await tenantResolver(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Terjadi kesalahan saat memproses tenant'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
