/**
 * Unit Tests for ImageController
 * Tests tenant-namespaced file upload functionality
 */

const ImageController = require('../../controllers/ImageController');

describe('ImageController - Tenant Namespaced Uploads', () => {
  let req, res;

  beforeEach(() => {
    // Mock request object with tenant context
    req = {
      tenant: {
        id: '507f1f77bcf86cd799439011'
      },
      file: {
        filename: 'test-image-123.jpg',
        size: 1024,
        mimetype: 'image/jpeg'
      }
    };

    // Mock response object
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    // Clear console mocks
    console.log = jest.fn();
    console.error = jest.fn();
  });

  describe('uploadMenuImage', () => {
    it('should return tenant-namespaced path for menu image', async () => {
      await ImageController.uploadMenuImage(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        imageUrl: '/uploads/images/menu/507f1f77bcf86cd799439011/test-image-123.jpg',
        filename: 'test-image-123.jpg',
        size: 1024,
        mimetype: 'image/jpeg'
      });
    });

    it('should use default tenant when tenant context is missing', async () => {
      req.tenant = undefined;

      await ImageController.uploadMenuImage(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        imageUrl: '/uploads/images/menu/default/test-image-123.jpg',
        filename: 'test-image-123.jpg',
        size: 1024,
        mimetype: 'image/jpeg'
      });
    });

    it('should return 400 error when no file is uploaded', async () => {
      req.file = undefined;

      await ImageController.uploadMenuImage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No image file uploaded'
      });
    });
  });

  describe('uploadProfileImage', () => {
    it('should return tenant-namespaced path for profile image', async () => {
      await ImageController.uploadProfileImage(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        imageUrl: '/uploads/images/profiles/507f1f77bcf86cd799439011/test-image-123.jpg',
        filename: 'test-image-123.jpg',
        size: 1024,
        mimetype: 'image/jpeg'
      });
    });

    it('should use default tenant when tenant context is missing', async () => {
      req.tenant = undefined;

      await ImageController.uploadProfileImage(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        imageUrl: '/uploads/images/profiles/default/test-image-123.jpg',
        filename: 'test-image-123.jpg',
        size: 1024,
        mimetype: 'image/jpeg'
      });
    });
  });

  describe('uploadGeneralImage', () => {
    it('should return tenant-namespaced path for general image', async () => {
      await ImageController.uploadGeneralImage(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        imageUrl: '/uploads/images/general/507f1f77bcf86cd799439011/test-image-123.jpg',
        filename: 'test-image-123.jpg',
        size: 1024,
        mimetype: 'image/jpeg'
      });
    });

    it('should use default tenant when tenant context is missing', async () => {
      req.tenant = undefined;

      await ImageController.uploadGeneralImage(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        imageUrl: '/uploads/images/general/default/test-image-123.jpg',
        filename: 'test-image-123.jpg',
        size: 1024,
        mimetype: 'image/jpeg'
      });
    });
  });

  describe('deleteImage', () => {
    const fs = require('fs');
    const path = require('path');

    beforeEach(() => {
      // Mock fs methods
      fs.existsSync = jest.fn().mockReturnValue(true);
      fs.unlinkSync = jest.fn();
    });

    it('should delete tenant-namespaced menu image', async () => {
      req.params = {
        category: 'menu',
        filename: 'test-image-123.jpg'
      };

      await ImageController.deleteImage(req, res);

      expect(fs.unlinkSync).toHaveBeenCalled();
      const callArg = fs.unlinkSync.mock.calls[0][0];
      expect(callArg).toContain('menu');
      expect(callArg).toContain('507f1f77bcf86cd799439011');
      expect(callArg).toContain('test-image-123.jpg');

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Image deleted successfully'
      });
    });

    it('should delete tenant-namespaced profile image', async () => {
      req.params = {
        category: 'profiles',
        filename: 'test-image-123.jpg'
      };

      await ImageController.deleteImage(req, res);

      expect(fs.unlinkSync).toHaveBeenCalled();
      const callArg = fs.unlinkSync.mock.calls[0][0];
      expect(callArg).toContain('profiles');
      expect(callArg).toContain('507f1f77bcf86cd799439011');
    });

    it('should delete tenant-namespaced general image', async () => {
      req.params = {
        category: 'general',
        filename: 'test-image-123.jpg'
      };

      await ImageController.deleteImage(req, res);

      expect(fs.unlinkSync).toHaveBeenCalled();
      const callArg = fs.unlinkSync.mock.calls[0][0];
      expect(callArg).toContain('general');
      expect(callArg).toContain('507f1f77bcf86cd799439011');
    });

    it('should handle non-namespaced banners category', async () => {
      req.params = {
        category: 'banners',
        filename: 'test-banner.jpg'
      };

      await ImageController.deleteImage(req, res);

      expect(fs.unlinkSync).toHaveBeenCalled();
      const callArg = fs.unlinkSync.mock.calls[0][0];
      expect(callArg).toContain('banners');
      expect(callArg).not.toContain('507f1f77bcf86cd799439011');
    });

    it('should return 404 when file does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      req.params = {
        category: 'menu',
        filename: 'nonexistent.jpg'
      };

      await ImageController.deleteImage(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Image file not found'
      });
    });

    it('should return 400 for invalid category', async () => {
      req.params = {
        category: 'invalid',
        filename: 'test.jpg'
      };

      await ImageController.deleteImage(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid image category'
      });
    });
  });
});
