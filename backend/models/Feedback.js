const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const FeedbackSchema = new mongoose.Schema({
    name: {
        type: String,
        default: 'Anonymous'
    },
    message: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

// Tenant-scoped compound indexes for optimal query performance
FeedbackSchema.index({ tenantId: 1, created_at: -1 }); // Time-based queries per tenant

// Apply tenant scoping plugin for automatic tenant isolation
FeedbackSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('Feedback', FeedbackSchema);
