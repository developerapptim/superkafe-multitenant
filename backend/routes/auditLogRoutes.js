const express = require('express');
const router = express.Router();
const AuditLogController = require('../controllers/AuditLogController');
const { checkJwt } = require('../middleware/auth');

router.get('/', checkJwt, AuditLogController.getAuditLogs);
router.post('/', checkJwt, AuditLogController.createAuditLog);

module.exports = router;
