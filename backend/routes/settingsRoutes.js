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

module.exports = router;
