const express = require('express');
const router = express.Router();
const StatsController = require('../controllers/StatsController');
const { checkJwt } = require('../middleware/auth');
const tenantResolver = require('../middleware/tenantResolver');

router.use(checkJwt);
router.use(tenantResolver);

router.get('/', StatsController.getDashboardStats);

module.exports = router;
