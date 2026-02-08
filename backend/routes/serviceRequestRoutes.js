const express = require('express');
const router = express.Router();
const ServiceRequestController = require('../controllers/ServiceRequestController');

// POST /api/service-request: Create new request
router.post('/', ServiceRequestController.createRequest);

// GET /api/service-request/pending: Get pending requests
router.get('/pending', ServiceRequestController.getPendingRequests);

// PUT /api/service-request/:id/complete: Mark request as completed
router.put('/:id/complete', ServiceRequestController.completeRequest);

module.exports = router;
