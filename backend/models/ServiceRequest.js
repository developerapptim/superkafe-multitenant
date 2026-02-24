const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

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

// Tenant-scoped compound indexes for optimal query performance
ServiceRequestSchema.index({ tenantId: 1, created_at: -1 }); // Time-based queries per tenant
ServiceRequestSchema.index({ tenantId: 1, status: 1 }); // Status-based queries per tenant

// Apply tenant scoping plugin for automatic tenant isolation
ServiceRequestSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('ServiceRequest', ServiceRequestSchema);
