const ActivityLog = require('../models/ActivityLog');

/**
 * Log user activity
 * @param {Object} params
 * @param {Object} params.req - Express request object (to extract user)
 * @param {string} params.action - Action name (e.g. 'ADD_ITEM')
 * @param {string} params.module - Module name (e.g. 'INVENTORY')
 * @param {string} params.description - Human readable description
 * @param {Object} [params.metadata] - Optional metadata
 */
const logActivity = async ({ req, action, module, description, metadata = {} }) => {
    try {
        const user = req.user || { id: 'system', name: 'System', role: 'system' };

        // If user data sits in req.body for some reason (rare fallback)
        const userData = {
            id: user.id || user.userId,
            name: user.name || user.username || 'Unknown',
            role: user.role || 'unknown'
        };

        const log = new ActivityLog({
            action,
            module,
            description,
            user: userData,
            metadata
        });

        await log.save();
        console.log(`[Activity] ${userData.name}: ${description}`);
    } catch (err) {
        console.error('[ActivityLog Error]', err);
        // Do not block main execution flow
    }
};

module.exports = logActivity;
