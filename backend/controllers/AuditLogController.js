const AuditLog = require('../models/AuditLog');

// Get all audit logs (with pagination support if needed later)
const getAuditLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find()
            .sort({ timestamp: -1 })
            .limit(100); // Limit to last 100 logs for performance
        res.json(logs);
    } catch (err) {
        console.error('Error fetching audit logs:', err);
        res.status(500).json({ error: 'Gagal mengambil audit logs' });
    }
};

// Create a new audit log entry
const createAuditLog = async (req, res) => {
    try {
        const { userId, userName, role, action, target, details } = req.body;

        const newLog = new AuditLog({
            userId,
            userName,
            role,
            action,
            target,
            details
        });

        await newLog.save();
        res.status(201).json(newLog);
    } catch (err) {
        console.error('Error creating audit log:', err);
        res.status(500).json({ error: 'Gagal membuat audit log' });
    }
};

// Internal helper to create log from other controllers
const logAction = async (user, action, target, details) => {
    try {
        await AuditLog.create({
            userId: user._id || user.id,
            userName: user.name || user.username || 'System',
            role: user.role || 'System',
            action,
            target,
            details
        });
    } catch (err) {
        console.error('Failed to save audit log:', err);
        // Don't throw error to prevent blocking main action
    }
};

module.exports = {
  getAuditLogs,
  createAuditLog,
  logAction
};
