const Feedback = require('../models/Feedback');

// POST /api/feedback
const createFeedback = async (req, res) => {
    try {
        const { name, message, rating } = req.body;

        if (!message || !rating) {
            return res.status(400).json({ error: 'Message and rating are required' });
        }

        const newFeedback = new Feedback({
            name: name || 'Anonymous',
            message,
            rating
        });

        await newFeedback.save();

        res.status(201).json({ message: 'Feedback submitted successfully', data: newFeedback });
    } catch (error) {
        console.error('Create Feedback Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// GET /api/feedback
const getAllFeedback = async (req, res) => {
    try {
        const feedbacks = await Feedback.find().sort({ created_at: -1 });
        res.json(feedbacks);
    } catch (error) {
        console.error('Get Feedback Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
  createFeedback,
  getAllFeedback
};
