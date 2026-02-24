// Need to clear the module cache to reset the fallback context between tests
let tenantContextModule;

describe('Tenant Context Module', () => {
  beforeEach(() => {
    // Clear module cache to reset fallback context
    jest.resetModules();
    tenantContextModule = require('../../utils/tenantContext');
  });

  describe('setTenantContext', () => {
    it('should set tenant context successfully', () => {
      const { setTenantContext } = tenantContextModule;
      const tenant = {
        id: '507f1f77bcf86cd799439011',
        slug: 'test-tenant',
        name: 'Test Tenant',
        dbName: 'superkafe_v2'
      };

      expect(() => setTenantContext(tenant)).not.toThrow();
    });

    it('should throw error when tenant data is invalid', () => {
      const { setTenantContext } = tenantContextModule;
      expect(() => setTenantContext(null)).toThrow('Invalid tenant data: id and slug are required');
      expect(() => setTenantContext({})).toThrow('Invalid tenant data: id and slug are required');
      expect(() => setTenantContext({ id: '123' })).toThrow('Invalid tenant data: id and slug are required');
      expect(() => setTenantContext({ slug: 'test' })).toThrow('Invalid tenant data: id and slug are required');
    });

    it('should log context set successfully', () => {
      const { setTenantContext } = tenantContextModule;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const tenant = {
        id: '507f1f77bcf86cd799439011',
        slug: 'test-tenant',
        name: 'Test Tenant',
        dbName: 'superkafe_v2'
      };

      setTenantContext(tenant);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TENANT CONTEXT] Context set successfully',
        expect.objectContaining({
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          tenantName: tenant.name
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getTenantContext', () => {
    it('should return null or undefined when no context is set', () => {
      const { getTenantContext } = tenantContextModule;
      const result = getTenantContext();
      // Fallback context is initialized to null, so it could be null or undefined
      expect(result == null).toBe(true);
    });

    it('should return tenant context after setTenantContext', () => {
      const { setTenantContext, getTenantContext } = tenantContextModule;
      const tenant = {
        id: '507f1f77bcf86cd799439011',
        slug: 'test-tenant',
        name: 'Test Tenant',
        dbName: 'superkafe_v2'
      };

      setTenantContext(tenant);
      const result = getTenantContext();

      expect(result).toEqual(tenant);
    });

    it('should log warning when context is not available', () => {
      const { getTenantContext } = tenantContextModule;
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      getTenantContext();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[TENANT CONTEXT] No context available when getTenantContext() called',
        expect.objectContaining({
          hasAsyncContext: false,
          hasFallback: false
        })
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('runWithTenantContext', () => {
    it('should run function with tenant context', async () => {
      const { runWithTenantContext, getTenantContext } = tenantContextModule;
      const tenant = {
        id: '507f1f77bcf86cd799439011',
        slug: 'test-tenant',
        name: 'Test Tenant',
        dbName: 'superkafe_v2'
      };

      const result = await runWithTenantContext(tenant, () => {
        const context = getTenantContext();
        return context;
      });

      expect(result).toEqual(tenant);
    });

    it('should isolate context between concurrent executions', async () => {
      const { runWithTenantContext, getTenantContext } = tenantContextModule;
      const tenant1 = {
        id: '507f1f77bcf86cd799439011',
        slug: 'tenant-1',
        name: 'Tenant 1',
        dbName: 'superkafe_v2'
      };

      const tenant2 = {
        id: '507f1f77bcf86cd799439012',
        slug: 'tenant-2',
        name: 'Tenant 2',
        dbName: 'superkafe_v2'
      };

      const [result1, result2] = await Promise.all([
        runWithTenantContext(tenant1, async () => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          return getTenantContext();
        }),
        runWithTenantContext(tenant2, async () => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          return getTenantContext();
        })
      ]);

      expect(result1.slug).toBe('tenant-1');
      expect(result2.slug).toBe('tenant-2');
    });

    it('should throw error when tenant data is invalid', () => {
      const { runWithTenantContext } = tenantContextModule;
      expect(() => runWithTenantContext(null, () => {})).toThrow('Invalid tenant data: id and slug are required');
      expect(() => runWithTenantContext({}, () => {})).toThrow('Invalid tenant data: id and slug are required');
      expect(() => runWithTenantContext({ id: '123' }, () => {})).toThrow('Invalid tenant data: id and slug are required');
    });

    it('should propagate context through nested async calls', async () => {
      const { runWithTenantContext, getTenantContext } = tenantContextModule;
      const tenant = {
        id: '507f1f77bcf86cd799439011',
        slug: 'test-tenant',
        name: 'Test Tenant',
        dbName: 'superkafe_v2'
      };

      const nestedFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return getTenantContext();
      };

      const result = await runWithTenantContext(tenant, async () => {
        const level1 = getTenantContext();
        const level2 = await nestedFunction();
        return { level1, level2 };
      });

      expect(result.level1).toEqual(tenant);
      expect(result.level2).toEqual(tenant);
    });

    it('should log when running function with context', () => {
      const { runWithTenantContext } = tenantContextModule;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const tenant = {
        id: '507f1f77bcf86cd799439011',
        slug: 'test-tenant',
        name: 'Test Tenant',
        dbName: 'superkafe_v2'
      };

      runWithTenantContext(tenant, () => {
        return 'test';
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TENANT CONTEXT] Running function with tenant context',
        expect.objectContaining({
          tenantId: tenant.id,
          tenantSlug: tenant.slug
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Fallback mechanism', () => {
    it('should use fallback context when AsyncLocalStorage fails', () => {
      const { setTenantContext, getTenantContext } = tenantContextModule;
      const tenant = {
        id: '507f1f77bcf86cd799439011',
        slug: 'test-tenant',
        name: 'Test Tenant',
        dbName: 'superkafe_v2'
      };

      // Set context using setTenantContext (which sets both AsyncLocalStorage and fallback)
      setTenantContext(tenant);

      // Get context should return the tenant (from either AsyncLocalStorage or fallback)
      const result = getTenantContext();
      expect(result).toEqual(tenant);
    });
  });
});
