const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Allow system actions or if user is deleted
    },
    userName: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true,
        uppercase: true
    },
    target: {
        type: String,
        required: true
    },
    details: {
        type: String,
        required: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
