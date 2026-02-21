/**
 * Image Controller
 * Handle general image uploads untuk berbagai keperluan
 * Menggunakan local disk storage
 */

/**
 * POST /api/images/menu
 * Upload menu item image
 */
const uploadMenuImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded'
      });
    }

    // File sudah disimpan oleh multer ke disk
    const imageUrl = `/uploads/images/menu/${req.file.filename}`;
    
    console.log('[IMAGE] Menu image uploaded:', imageUrl);

    res.json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('[IMAGE ERROR] Upload menu image failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload menu image'
    });
  }
};

/**
 * POST /api/images/profile
 * Upload profile image
 */
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded'
      });
    }

    const imageUrl = `/uploads/images/profiles/${req.file.filename}`;
    
    console.log('[IMAGE] Profile image uploaded:', imageUrl);

    res.json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('[IMAGE ERROR] Upload profile image failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload profile image'
    });
  }
};

/**
 * POST /api/images/general
 * Upload general purpose image
 */
const uploadGeneralImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded'
      });
    }

    const imageUrl = `/uploads/images/general/${req.file.filename}`;
    
    console.log('[IMAGE] General image uploaded:', imageUrl);

    res.json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('[IMAGE ERROR] Upload general image failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload general image'
    });
  }
};

/**
 * DELETE /api/images/:category/:filename
 * Delete image file (optional - untuk cleanup)
 */
const deleteImage = async (req, res) => {
  try {
    const { category, filename } = req.params;
    const fs = require('fs');
    const path = require('path');

    // Validate category
    const allowedCategories = ['menu', 'banners', 'profiles', 'general', 'payments'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid image category'
      });
    }

    // Build file path
    let filePath;
    if (category === 'payments') {
      filePath = path.join(__dirname, '../public/uploads/payments', filename);
    } else {
      filePath = path.join(__dirname, '../public/uploads/images', category, filename);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Image file not found'
      });
    }

    // Delete file
    fs.unlinkSync(filePath);
    
    console.log('[IMAGE] Image deleted:', filePath);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('[IMAGE ERROR] Delete image failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete image'
    });
  }
};

module.exports = {
  uploadMenuImage,
  uploadProfileImage,
  uploadGeneralImage,
  deleteImage
};
