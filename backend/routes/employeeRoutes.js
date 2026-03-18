const express = require('express');
const router = express.Router();
const EmployeeController = require('../controllers/EmployeeController');
const { checkJwt } = require('../middleware/auth');
const tenantResolver = require('../middleware/tenantResolver');

// Public Login
router.post('/login', EmployeeController.login);

// Protected Management (tenantResolver ensures Employee queries are tenant-scoped)
router.get('/', checkJwt, tenantResolver, EmployeeController.getEmployees);
router.post('/', checkJwt, tenantResolver, EmployeeController.createEmployee);
router.put('/:id', checkJwt, tenantResolver, EmployeeController.updateEmployee);
router.delete('/:id', checkJwt, tenantResolver, EmployeeController.deleteEmployee);


module.exports = router;
