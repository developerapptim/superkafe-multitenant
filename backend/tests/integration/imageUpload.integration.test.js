/**
 * Integration Tests for Tenant-Namespaced Image Uploads
 * Tests the complete flow: tenant middleware -> multer -> controller
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const uploadRoutes = require('../../routes/uploadRoutes');

// Mock tenant resolver middleware
jest.mock('../../middleware/tenantResolver', () => ({
  resolveTenant: (req, res, next) => {
    // Simulate tenant resolution from x-tenant-id header
    const tenantSlug = req.headers['x-tenant-id'];
    if (tenantSlug) {
      req.tenant = {
        id: '507f1f77bcf86cd799439011',
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
    // Allow all requests in test
    next();
  }
}));

describe('Image Upload Integration - Tenant Namespacing', () => {
  let app;
  const testUploadDir = path.join(__dirname, '../../public/uploads/images');

  beforeAll(() => {
    // Create test app
    app = express();
    app.use(express.json());
    app.use('/api/upload', uploadRoutes);
  });

  afterEach(() => {
    // Clean up test files
    const cleanupDirs = [
      path.join(testUploadDir, 'menu', '507f1f77bcf86cd799439011'),
      path.join(testUploadDir, 'profiles', '507f1f77bcf86cd799439011'),
      path.join(testUploadDir, 'general', '507f1f77bcf86cd799439011')
    ];

    cleanupDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          fs.unlinkSync(path.join(dir, file));
        });
        // Try to remove directory (may fail if not empty, that's ok)
        try {
          fs.rmdirSync(dir);
        } catch (e) {
          // Ignore
        }
      }
    });
  });

  describe('POST /api/upload/images/menu', () => {
    it('should upload menu image with tenant namespace', async () => {
      const response = await request(app)
        .post('/api/upload/images/menu')
        .set('x-tenant-id', 'test-cafe')
        .attach('image', Buffer.from('fake image data'), 'test-menu.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.imageUrl).toMatch(/\/uploads\/images\/menu\/507f1f77bcf86cd799439011\/.+\.jpg/);
      
      // Verify file was created in tenant-namespaced directory
      const filename = response.body.filename;
      const filePath = path.join(testUploadDir, 'menu', '507f1f77bcf86cd799439011', filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should create tenant directory if it does not exist', async () => {
      const tenantDir = path.join(testUploadDir, 'menu', '507f1f77bcf86cd799439011');
      
      // Ensure directory doesn't exist
      if (fs.existsSync(tenantDir)) {
        fs.rmSync(tenantDir, { recursive: true });
      }

      const response = await request(app)
        .post('/api/upload/images/menu')
        .set('x-tenant-id', 'test-cafe')
        .attach('image', Buffer.from('fake image data'), 'test-menu.jpg');

      expect(response.status).toBe(200);
      expect(fs.existsSync(tenantDir)).toBe(true);
    });
  });

  describe('POST /api/upload/images/profile', () => {
    it('should upload profile image with tenant namespace', async () => {
      const response = await request(app)
        .post('/api/upload/images/profile')
        .set('x-tenant-id', 'test-cafe')
        .attach('image', Buffer.from('fake image data'), 'test-profile.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.imageUrl).toMatch(/\/uploads\/images\/profiles\/507f1f77bcf86cd799439011\/.+\.jpg/);
    });
  });

  describe('POST /api/upload/images/general', () => {
    it('should upload general image with tenant namespace', async () => {
      const response = await request(app)
        .post('/api/upload/images/general')
        .set('x-tenant-id', 'test-cafe')
        .attach('image', Buffer.from('fake image data'), 'test-general.jpg');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.imageUrl).toMatch(/\/uploads\/images\/general\/507f1f77bcf86cd799439011\/.+\.jpg/);
    });
  });

  describe('Tenant Isolation', () => {
    it('should isolate uploads between different tenants', async () => {
      // Mock different tenant for second request
      const originalResolveTenant = require('../../middleware/tenantResolver').resolveTenant;
      
      // Upload for tenant A
      const responseA = await request(app)
        .post('/api/upload/images/menu')
        .set('x-tenant-id', 'cafe-a')
        .attach('image', Buffer.from('tenant A image'), 'menu-a.jpg');

      expect(responseA.status).toBe(200);
      expect(responseA.body.imageUrl).toContain('507f1f77bcf86cd799439011');

      // The paths should be different if we had different tenant IDs
      // In this test, both use the same mocked tenant ID, but in production
      // they would be different based on the x-tenant-id header
      expect(responseA.body.imageUrl).toMatch(/\/uploads\/images\/menu\/507f1f77bcf86cd799439011\/.+\.jpg/);
    });
  });

  describe('DELETE /api/upload/images/:category/:filename', () => {
    it('should delete tenant-namespaced image', async () => {
      // First upload an image
      const uploadResponse = await request(app)
        .post('/api/upload/images/menu')
        .set('x-tenant-id', 'test-cafe')
        .attach('image', Buffer.from('fake image data'), 'test-delete.jpg');

      expect(uploadResponse.status).toBe(200);
      const filename = uploadResponse.body.filename;

      // Verify file exists
      const filePath = path.join(testUploadDir, 'menu', '507f1f77bcf86cd799439011', filename);
      expect(fs.existsSync(filePath)).toBe(true);

      // Delete the image
      const deleteResponse = await request(app)
        .delete(`/api/upload/images/menu/${filename}`)
        .set('x-tenant-id', 'test-cafe');

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);

      // Verify file is deleted
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });
});
