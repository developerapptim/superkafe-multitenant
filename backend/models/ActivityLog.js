const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
    action: { type: String, required: true }, // e.g., 'ADD_MENU', 'OPEN_SHIFT'
    module: { type: String, required: true }, // e.g., 'INVENTORY', 'SHIFT'
    description: { type: String, required: true },
    user: {
        id: String,
        name: String,
        role: String
    },
    metadata: { type: mongoose.Schema.Types.Mixed }, // Flexible field for extra details (e.g. item ID, amount)
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
