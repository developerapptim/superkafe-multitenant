const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

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

// Tenant-scoped compound indexes for optimal query performance
auditLogSchema.index({ tenantId: 1, timestamp: -1 }); // Time-based queries per tenant

// Apply tenant scoping plugin for automatic tenant isolation
auditLogSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('AuditLog', auditLogSchema);
