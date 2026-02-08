const express = require('express');
const router = express.Router();
const FeedbackController = require('../controllers/FeedbackController');

// POST /api/feedback: Create new feedback
router.post('/', FeedbackController.createFeedback);

// GET /api/feedback: Get all feedback
router.get('/', FeedbackController.getAllFeedback);

module.exports = router;
