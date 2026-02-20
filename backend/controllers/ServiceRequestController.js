const ServiceRequest = require('../models/ServiceRequest');

// POST /api/service-request
const createRequest = async (req, res) => {
    try {
        const { table_number, request_type, note } = req.body;

        if (!table_number || !request_type) {
            return res.status(400).json({ error: 'Table number and request type are required' });
        }

        const newRequest = new ServiceRequest({
            table_number,
            request_type,
            note: note || ''
        });

        await newRequest.save();

        res.status(201).json({ message: 'Request submitted successfully', data: newRequest });
    } catch (error) {
        console.error('Create Service Request Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// GET /api/service-request/pending
const getPendingRequests = async (req, res) => {
    try {
        const requests = await ServiceRequest.find({ status: 'pending' }).sort({ created_at: 1 });
        res.json(requests);
    } catch (error) {
        console.error('Get Pending Requests Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// PUT /api/service-request/:id/complete
const completeRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await ServiceRequest.findByIdAndUpdate(
            id,
            { status: 'completed' },
            { new: true }
        );

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json({ message: 'Request marked as completed', data: request });
    } catch (error) {
        console.error('Complete Request Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
  createRequest,
  getPendingRequests,
  completeRequest
};
