const express = require('express');
const router = express.Router();
const ExportController = require('../controllers/ExportController');
const { checkApiKey, checkJwt } = require('../middleware/auth');

// Using middleware if needed, but the frontend might not pass verifyToken properly for blob requests
// Though frontend uses api.get which injects token, so it should be fine.
router.use(checkApiKey);
router.use(checkJwt);

router.get('/:type', ExportController.exportData);

module.exports = router;
