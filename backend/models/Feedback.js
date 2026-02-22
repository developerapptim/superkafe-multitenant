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

// Apply tenant scoping plugin for automatic tenant isolation
FeedbackSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('Feedback', FeedbackSchema);
