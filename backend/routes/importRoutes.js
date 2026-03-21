const express = require('express');
const router = express.Router();
const ImportController = require('../controllers/ImportController');
const { checkApiKey, checkJwt } = require('../middleware/auth');
const { uploadExcel } = require('../middleware/uploadMiddleware');

// Using middleware if needed
router.use(checkApiKey);
router.use(checkJwt);

router.post('/:type', uploadExcel.single('file'), ImportController.importData);

module.exports = router;
