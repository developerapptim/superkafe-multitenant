const express = require('express');
const router = express.Router();
const SettingsController = require('../controllers/SettingsController');
const { checkJwt } = require('../middleware/auth');

// Public
router.get('/public', SettingsController.getPublicSettings);

// Protected
router.use(checkJwt);

router.get('/', SettingsController.getSettings);
router.post('/', SettingsController.updateSettings);
router.put('/', SettingsController.updateSettings); // Alias

// Unit Management
router.post('/units', SettingsController.addUnit);
router.delete('/units/:unitName', SettingsController.removeUnit);

// Sound Upload Configuration
const multer = require('multer');

// Use Memory Storage to get buffer
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Accept audio files only
    if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('Only audio files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/upload-sound', upload.single('soundFile'), SettingsController.uploadSound);

module.exports = router;
