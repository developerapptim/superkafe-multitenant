/**
 * Property-Based Tests for File Upload Path Namespacing
 * 
 * **Property 14: File Upload Path Namespacing**
 * For any file uploaded through the system, the storage path should include 
 * the tenantId as a namespace component (e.g., `uploads/{category}/{tenantId}/{filename}`)
 * 
 * **Validates: Requirements 2.7**
 */

const fc = require('fast-check');
const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const uploadRoutes = require('../../routes/uploadRoutes');

// Helper: Generate valid MongoDB ObjectId hex string (24 hex characters)
const objectIdArbitrary = () => 
  fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 24, maxLength: 24 })
    .map(arr => arr.map(n => n.toString(16)).join(''));

// Mock tenant resolver middleware
jest.mock('../../middleware/tenantResolver', () => ({
  resolveTenant: (req, res, next) => {
    const tenantSlug = req.headers['x-tenant-id'];
    if (tenantSlug && req.mockTenantId) {
      req.tenant = {
        id: req.mockTenantId,
        slug: tenantSlug,
        name: 'Test Cafe',
        dbName: 'test_cafe_db'
      };
    }
    next();
  }
}));

// Mock auth middleware
jest.mock('../../middleware/auth', () => ({
  checkApiKey: (req, res, next) => {
    next();
  }
}));

describe('Property Tests: File Upload Path Namespacing', () => {
  let app;
  const testUploadDir = path.join(__dirname, '../../public/uploads/images');
  const uploadedFiles = []; // Track files for cleanup

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Middleware to inject mock tenant ID
    app.use((req, res, next) => {
      if (req.headers['x-mock-tenant-id']) {
        req.mockTenantId = req.headers['x-mock-tenant-id'];
      }
      next();
    });
    
    app.use('/api/upload', uploadRoutes);
  });

  afterEach(() => {
    // Clean up all uploaded test files
    uploadedFiles.forEach(({ category, tenantId, filename }) => {
      const filePath = path.join(testUploadDir, category, tenantId, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
    
    // Clear the tracking array
    uploadedFiles.length = 0;
  });

  afterAll(() => {
    // Clean up tenant directories
    const categories = ['menu', 'profiles', 'general'];
    categories.forEach(category => {
      const categoryDir = path.join(testUploadDir, category);
      if (fs.existsSync(categoryDir)) {
        const tenantDirs = fs.readdirSync(categoryDir);
        tenantDirs.forEach(tenantDir => {
          const fullPath = path.join(categoryDir, tenantDir);
          if (fs.statSync(fullPath).isDirectory()) {
            try {
              fs.rmSync(fullPath, { recursive: true, force: true });
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        });
      }
    });
  });

  /**
   * Property 14.1: All file uploads include tenantId in storage path
   * 
   * For any valid tenantId and file category, the uploaded file should be stored
   * in a path that includes the tenantId as a namespace component.
   */
  test('Property 14.1: All uploads include tenantId in path', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random tenant IDs (MongoDB ObjectId format - 24 hex characters)
        objectIdArbitrary(),
        // Generate random file categories
        fc.constantFrom('menu', 'profile', 'general'),
        // Generate random filenames
        fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, 'a') || 'file'),
        
        async (tenantId, category, baseFilename) => {
          const filename = `${baseFilename}.jpg`;
          const endpoint = `/api/upload/images/${category}`;
          
          const response = await request(app)
            .post(endpoint)
            .set('x-tenant-id', 'test-cafe')
            .set('x-mock-tenant-id', tenantId)
            .attach('image', Buffer.from('test image data'), filename);

          // Should succeed
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
          
          // Path should include tenantId
          const imageUrl = response.body.imageUrl;
          expect(imageUrl).toContain(tenantId);
          
          // Path format should be: /uploads/images/{category}/{tenantId}/{filename}
          const categoryPlural = category === 'profile' ? 'profiles' : category;
          const expectedPathPattern = new RegExp(`/uploads/images/${categoryPlural}/${tenantId}/.+\\.jpg`);
          expect(imageUrl).toMatch(expectedPathPattern);
          
          // Track for cleanup
          uploadedFiles.push({
            category: categoryPlural,
            tenantId,
            filename: response.body.filename
          });
        }
      ),
      { numRuns: 20 } // Run 20 iterations with different tenant IDs and categories
    );
  });

  /**
   * Property 14.2: Different tenants get isolated storage paths
   * 
   * For any two different tenantIds uploading files in the same category,
   * the files should be stored in different directories.
   */
  test('Property 14.2: Different tenants get isolated paths', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate two different tenant IDs
        fc.tuple(
          objectIdArbitrary(),
          objectIdArbitrary()
        ).filter(([id1, id2]) => id1 !== id2),
        // Same category for both
        fc.constantFrom('menu', 'profile', 'general'),
        
        async ([tenantId1, tenantId2], category) => {
          const endpoint = `/api/upload/images/${category}`;
          
          // Upload file for tenant 1
          const response1 = await request(app)
            .post(endpoint)
            .set('x-tenant-id', 'cafe-1')
            .set('x-mock-tenant-id', tenantId1)
            .attach('image', Buffer.from('tenant 1 image'), 'test1.jpg');

          // Upload file for tenant 2
          const response2 = await request(app)
            .post(endpoint)
            .set('x-tenant-id', 'cafe-2')
            .set('x-mock-tenant-id', tenantId2)
            .attach('image', Buffer.from('tenant 2 image'), 'test2.jpg');

          expect(response1.status).toBe(200);
          expect(response2.status).toBe(200);
          
          const path1 = response1.body.imageUrl;
          const path2 = response2.body.imageUrl;
          
          // Paths should be different
          expect(path1).not.toBe(path2);
          
          // Each path should contain its respective tenantId
          expect(path1).toContain(tenantId1);
          expect(path2).toContain(tenantId2);
          
          // Paths should NOT contain the other tenant's ID
          expect(path1).not.toContain(tenantId2);
          expect(path2).not.toContain(tenantId1);
          
          // Track for cleanup
          const categoryPlural = category === 'profile' ? 'profiles' : category;
          uploadedFiles.push(
            { category: categoryPlural, tenantId: tenantId1, filename: response1.body.filename },
            { category: categoryPlural, tenantId: tenantId2, filename: response2.body.filename }
          );
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property 14.3: File storage path matches returned URL path
   * 
   * For any uploaded file, the actual file system path should match
   * the URL path returned in the response.
   */
  test('Property 14.3: Storage path matches returned URL', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArbitrary(),
        fc.constantFrom('menu', 'profile', 'general'),
        
        async (tenantId, category) => {
          const endpoint = `/api/upload/images/${category}`;
          
          const response = await request(app)
            .post(endpoint)
            .set('x-tenant-id', 'test-cafe')
            .set('x-mock-tenant-id', tenantId)
            .attach('image', Buffer.from('test image'), 'test.jpg');

          expect(response.status).toBe(200);
          
          const imageUrl = response.body.imageUrl;
          const filename = response.body.filename;
          
          // Convert URL to file system path
          const categoryPlural = category === 'profile' ? 'profiles' : category;
          const expectedFilePath = path.join(testUploadDir, categoryPlural, tenantId, filename);
          
          // File should exist at the expected path
          expect(fs.existsSync(expectedFilePath)).toBe(true);
          
          // URL should match the file structure
          expect(imageUrl).toBe(`/uploads/images/${categoryPlural}/${tenantId}/${filename}`);
          
          // Track for cleanup
          uploadedFiles.push({ category: categoryPlural, tenantId, filename });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 14.4: Tenant directory is created automatically
   * 
   * For any tenantId that doesn't have an existing directory,
   * the upload should create the directory automatically.
   */
  test('Property 14.4: Tenant directory created automatically', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate unique tenant IDs
        objectIdArbitrary(),
        fc.constantFrom('menu', 'profile', 'general'),
        
        async (tenantId, category) => {
          const categoryPlural = category === 'profile' ? 'profiles' : category;
          const tenantDir = path.join(testUploadDir, categoryPlural, tenantId);
          
          // Ensure directory doesn't exist before upload
          if (fs.existsSync(tenantDir)) {
            fs.rmSync(tenantDir, { recursive: true, force: true });
          }
          
          expect(fs.existsSync(tenantDir)).toBe(false);
          
          // Upload file
          const endpoint = `/api/upload/images/${category}`;
          const response = await request(app)
            .post(endpoint)
            .set('x-tenant-id', 'test-cafe')
            .set('x-mock-tenant-id', tenantId)
            .attach('image', Buffer.from('test image'), 'test.jpg');

          expect(response.status).toBe(200);
          
          // Directory should now exist
          expect(fs.existsSync(tenantDir)).toBe(true);
          
          // File should be in the directory
          const filename = response.body.filename;
          const filePath = path.join(tenantDir, filename);
          expect(fs.existsSync(filePath)).toBe(true);
          
          // Track for cleanup
          uploadedFiles.push({ category: categoryPlural, tenantId, filename });
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Property 14.5: All file categories use tenant namespacing
   * 
   * For any file category (menu, profile, general), uploads should
   * consistently use tenant namespacing in the storage path.
   */
  test('Property 14.5: All categories use tenant namespacing', async () => {
    await fc.assert(
      fc.asyncProperty(
        objectIdArbitrary(),
        
        async (tenantId) => {
          const categories = [
            { endpoint: 'menu', plural: 'menu' },
            { endpoint: 'profile', plural: 'profiles' },
            { endpoint: 'general', plural: 'general' }
          ];
          
          const results = [];
          
          for (const { endpoint, plural } of categories) {
            const response = await request(app)
              .post(`/api/upload/images/${endpoint}`)
              .set('x-tenant-id', 'test-cafe')
              .set('x-mock-tenant-id', tenantId)
              .attach('image', Buffer.from(`${endpoint} image`), `${endpoint}.jpg`);

            expect(response.status).toBe(200);
            
            results.push({
              category: endpoint,
              url: response.body.imageUrl,
              filename: response.body.filename
            });
            
            // Track for cleanup
            uploadedFiles.push({ category: plural, tenantId, filename: response.body.filename });
          }
          
          // All URLs should contain the tenantId
          results.forEach(result => {
            expect(result.url).toContain(tenantId);
            
            // Verify path format
            const categoryPlural = result.category === 'profile' ? 'profiles' : result.category;
            expect(result.url).toMatch(
              new RegExp(`/uploads/images/${categoryPlural}/${tenantId}/.+\\.jpg`)
            );
          });
        }
      ),
      { numRuns: 10 }
    );
  });
});
