const express = require('express');
const router = express.Router();
const UploadController = require('../controllers/UploadController');
const ImageController = require('../controllers/ImageController');
const { 
  uploadAudio, 
  uploadMenuImage, 
  uploadProfileImage, 
  uploadGeneralImage 
} = require('../middleware/uploadMiddleware');
const { checkApiKey } = require('../middleware/auth');
const tenantResolver = require('../middleware/tenantResolver');

router.use(checkApiKey);
router.use(tenantResolver); // Add tenant resolution for namespaced uploads

// ===== AUDIO UPLOADS =====
// Settings Sound Upload
router.post('/settings/sound', uploadAudio.single('soundFile'), UploadController.uploadSound);

// ===== IMAGE UPLOADS =====
// Menu item images
router.post('/images/menu', uploadMenuImage.single('image'), ImageController.uploadMenuImage);

// Profile images
router.post('/images/profile', uploadProfileImage.single('image'), ImageController.uploadProfileImage);

// General purpose images
router.post('/images/general', uploadGeneralImage.single('image'), ImageController.uploadGeneralImage);

// Delete image (optional - untuk cleanup)
router.delete('/images/:category/:filename', ImageController.deleteImage);

module.exports = router;
