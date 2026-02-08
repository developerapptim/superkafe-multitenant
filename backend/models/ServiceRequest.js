const mongoose = require('mongoose');

const ServiceRequestSchema = new mongoose.Schema({
    table_number: {
        type: String,
        required: true
    },
    request_type: {
        type: String,
        enum: ['Bill', 'Alat Makan', 'Panggil', 'Bersihkan'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed'],
        default: 'pending'
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ServiceRequest', ServiceRequestSchema);
