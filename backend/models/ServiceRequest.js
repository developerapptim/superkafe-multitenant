const mongoose = require('mongoose');

const ServiceRequestSchema = new mongoose.Schema({
    table_number: {
        type: String,
        required: true
    },
    request_type: {
        type: String,
        enum: ['Bill', 'Alat Makan', 'Panggil', 'Bersihkan', 'Lainnya'],
        required: true
    },
    note: {
        type: String,
        required: false
    },
    status: {
        type: String,
        enum: ['pending', 'completed'],
        default: 'pending'
    },
    created_at: {
        type: Date,
        default: Date.now,
        expires: 86400 // 24 hours
    }
});

module.exports = mongoose.model('ServiceRequest', ServiceRequestSchema);
