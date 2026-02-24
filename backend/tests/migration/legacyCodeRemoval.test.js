const fs = require('fs');
const path = require('path');

/**
 * Legacy Code Removal Verification Tests
 * 
 * These tests verify that all legacy multi-database code has been removed
 * from the codebase as part of the Unified Nexus Architecture migration.
 * 
 * Task: 8.4 Write unit test for legacy code removal verification
 * Requirements: 6.1, 6.2, 6.3, 6.5
 * 
 * Test Coverage:
 * - Requirement 6.1: Remove dynamic database creation functions
 *   - Verifies getTenantDB() removed from controllers, services, routes, middleware, utils
 *   - Verifies getTenantDB not exported from db.js
 * 
 * - Requirement 6.2: Remove database switching logic
 *   - Verifies useDb() for tenant switching removed
 *   - Verifies createConnection() for tenants removed
 *   - Verifies mongoose.connection.useDb() removed from controllers and services
 * 
 * - Requirement 6.3: Remove tenant-specific database name references
 *   - Verifies superkafe_v2 is the only database name
 *   - Verifies no dynamic database name construction
 * 
 * - Requirement 6.5: Verify zero references to legacy patterns
 *   - Verifies closeTenantDB() removed
 *   - Verifies closeAllTenantConnections() removed
 *   - Verifies tenant connection caching removed
 * 
 * - Unified Architecture Verification
 *   - Verifies runWithTenantContext usage
 *   - Verifies direct model imports
 *   - Verifies connectMainDB as primary connection
 *   - Verifies models use tenantScopingPlugin
 * 
 * - Legacy Scripts Documentation
 *   - Verifies deprecated scripts are documented
 */

describe('Legacy Code Removal Verification', () => {
  const backendDir = path.join(__dirname, '../..');
  const controllersDir = path.join(backendDir, 'controllers');
  const servicesDir = path.join(backendDir, 'services');
  const configDir = path.join(backendDir, 'config');

  /**
   * Helper function to search for pattern in file
   */
  const searchInFile = (filePath, pattern) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return pattern.test(content);
    } catch (error) {
      // File doesn't exist or can't be read
      return false;
    }
  };

  /**
   * Helper function to recursively search directory for pattern
   */
  const searchInDirectory = (dir, pattern, excludeDirs = []) => {
    const results = [];
    
    const searchRecursive = (currentDir) => {
      try {
        const files = fs.readdirSync(currentDir);
        
        for (const file of files) {
          const filePath = path.join(currentDir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            // Skip excluded directories
            if (!excludeDirs.includes(file)) {
              searchRecursive(filePath);
            }
          } else if (file.endsWith('.js')) {
            if (searchInFile(filePath, pattern)) {
              results.push(filePath);
            }
          }
        }
      } catch (error) {
        // Directory doesn't exist or can't be read
      }
    };
    
    searchRecursive(dir);
    return results;
  };

  describe('Requirement 6.1: Remove dynamic database creation functions', () => {
    it('should have zero references to getTenantDB() in controllers', () => {
      const pattern = /getTenantDB\s*\(/;
      const matches = searchInDirectory(controllersDir, pattern);
      
      expect(matches).toEqual([]);
    });

    it('should have zero references to getTenantDB() in services', () => {
      const pattern = /getTenantDB\s*\(/;
      const matches = searchInDirectory(servicesDir, pattern);
      
      expect(matches).toEqual([]);
    });

    it('should not export getTenantDB from db.js', () => {
      const dbConfigPath = path.join(configDir, 'db.js');
      const content = fs.readFileSync(dbConfigPath, 'utf8');
      
      // Check that getTenantDB is not in module.exports
      expect(content).not.toMatch(/module\.exports\s*=\s*{[^}]*getTenantDB/);
      expect(content).not.toMatch(/exports\.getTenantDB/);
    });

    it('should have zero references to getTenantDB() in routes', () => {
      const routesDir = path.join(backendDir, 'routes');
      const pattern = /getTenantDB\s*\(/;
      const matches = searchInDirectory(routesDir, pattern);
      
      expect(matches).toEqual([]);
    });

    it('should have zero references to getTenantDB() in middleware', () => {
      const middlewareDir = path.join(backendDir, 'middleware');
      const pattern = /getTenantDB\s*\(/;
      const matches = searchInDirectory(middlewareDir, pattern);
      
      expect(matches).toEqual([]);
    });

    it('should have zero references to getTenantDB() in utils', () => {
      const utilsDir = path.join(backendDir, 'utils');
      const pattern = /getTenantDB\s*\(/;
      const matches = searchInDirectory(utilsDir, pattern);
      
      expect(matches).toEqual([]);
    });
  });

  describe('Requirement 6.2: Remove database switching logic', () => {
    it('should have zero references to useDb() for tenant switching', () => {
      const pattern = /\.useDb\s*\(\s*tenant/i;
      const matches = searchInDirectory(backendDir, pattern, ['node_modules', 'tests', 'scripts']);
      
      expect(matches).toEqual([]);
    });

    it('should have zero references to createConnection() for tenants', () => {
      const pattern = /createConnection\s*\([^)]*tenant/i;
      const matches = searchInDirectory(backendDir, pattern, ['node_modules', 'tests', 'scripts']);
      
      expect(matches).toEqual([]);
    });

    it('should have zero references to mongoose.connection.useDb() in controllers', () => {
      const pattern = /mongoose\.connection\.useDb/;
      const matches = searchInDirectory(controllersDir, pattern);
      
      expect(matches).toEqual([]);
    });

    it('should have zero references to mongoose.connection.useDb() in services', () => {
      const pattern = /mongoose\.connection\.useDb/;
      const matches = searchInDirectory(servicesDir, pattern);
      
      expect(matches).toEqual([]);
    });
  });

  describe('Requirement 6.3: Remove tenant-specific database name references', () => {
    it('should use superkafe_v2 as the only database name in db.js', () => {
      const dbConfigPath = path.join(configDir, 'db.js');
      const content = fs.readFileSync(dbConfigPath, 'utf8');
      
      // Should reference superkafe_v2
      expect(content).toMatch(/superkafe_v2/);
      
      // Should not have dynamic database name construction
      expect(content).not.toMatch(/superkafe_\$\{/);
      expect(content).not.toMatch(/`superkafe_\${tenant/);
    });

    it('should not dynamically construct tenant database names in controllers', () => {
      const pattern = /superkafe_\$\{|`superkafe_\${tenant/;
      const matches = searchInDirectory(controllersDir, pattern);
      
      expect(matches).toEqual([]);
    });
  });

  describe('Requirement 6.5: Verify zero references to legacy patterns', () => {
    it('should have zero references to closeTenantDB()', () => {
      const pattern = /closeTenantDB\s*\(/;
      const matches = searchInDirectory(backendDir, pattern, ['node_modules', 'tests']);
      
      expect(matches).toEqual([]);
    });

    it('should have zero references to closeAllTenantConnections()', () => {
      const pattern = /closeAllTenantConnections\s*\(/;
      const matches = searchInDirectory(backendDir, pattern, ['node_modules', 'tests']);
      
      expect(matches).toEqual([]);
    });

    it('should have zero references to tenant connection caching', () => {
      const pattern = /tenantConnections\s*=|tenantConnectionCache/i;
      const matches = searchInDirectory(backendDir, pattern, ['node_modules', 'tests']);
      
      expect(matches).toEqual([]);
    });
  });

  describe('Unified Architecture Verification', () => {
    it('should use runWithTenantContext in controllers', () => {
      const pattern = /runWithTenantContext/;
      const matches = searchInDirectory(controllersDir, pattern);
      
      // Should have at least some controllers using runWithTenantContext
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should import Employee model directly in controllers', () => {
      const pattern = /require\(['"]\.\.\/models\/Employee['"]\)/;
      const matches = searchInDirectory(controllersDir, pattern);
      
      // Should have controllers importing Employee model directly
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should have connectMainDB as the primary connection function', () => {
      const dbConfigPath = path.join(configDir, 'db.js');
      const content = fs.readFileSync(dbConfigPath, 'utf8');
      
      // Should export connectMainDB
      expect(content).toMatch(/connectMainDB/);
      expect(content).toMatch(/module\.exports\s*=\s*{[^}]*connectMainDB/);
    });

    it('should import models directly without database parameter', () => {
      const pattern = /require\(['"]\.\.\/models\/\w+['"]\)\(.*db/i;
      const matches = searchInDirectory(controllersDir, pattern);
      
      // Should not pass database to model imports
      expect(matches).toEqual([]);
    });

    it('should use tenantScopingPlugin in models', () => {
      const modelsDir = path.join(backendDir, 'models');
      const pattern = /tenantScopingPlugin/;
      const matches = searchInDirectory(modelsDir, pattern);
      
      // Should have models using tenantScopingPlugin
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe('Legacy Scripts Documentation', () => {
    it('should have documentation for legacy scripts', () => {
      const legacyReadmePath = path.join(backendDir, 'scripts', 'LEGACY_SCRIPTS_README.md');
      
      expect(fs.existsSync(legacyReadmePath)).toBe(true);
    });

    it('should document deprecated scripts', () => {
      const legacyReadmePath = path.join(backendDir, 'scripts', 'LEGACY_SCRIPTS_README.md');
      const content = fs.readFileSync(legacyReadmePath, 'utf8');
      
      // Should mention deprecated scripts
      expect(content).toMatch(/migrateMenuToTenant/);
      expect(content).toMatch(/seedTenant/);
      expect(content).toMatch(/DEPRECATED/i);
    });
  });
});
