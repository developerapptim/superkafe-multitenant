const Setting = require('../models/Setting');

exports.getSettings = async (req, res) => {
    try {
        const settings = await Setting.find();
        // Convert array to object key-value for easier frontend consumption
        const settingsMap = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });
        res.json(settingsMap);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const updates = req.body;

        // Case 1: Single update (legacy or specific usage: { key, value })
        if (updates.key && updates.value !== undefined) {
            const setting = await Setting.findOneAndUpdate(
                { key: updates.key },
                { $set: { value: updates.value, updatedAt: new Date() } },
                { upsert: true, new: true }
            );
            return res.json({ success: true, setting });
        }

        // Case 2: Bulk update (frontend sends entire settings object)
        const promises = Object.keys(updates).map(async (key) => {
            return Setting.findOneAndUpdate(
                { key },
                { $set: { value: updates[key], updatedAt: new Date() } },
                { upsert: true, new: true }
            );
        });

        await Promise.all(promises);
        res.json({ success: true, message: 'Settings updated' });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.addUnit = async (req, res) => {
    try {
        const { unit } = req.body;
        if (!unit) return res.status(400).json({ error: 'Unit name is required' });

        let setting = await Setting.findOne({ key: 'customUnits' });
        let units = setting && Array.isArray(setting.value) ? setting.value : [];

        // Avoid duplicates
        if (!units.includes(unit)) {
            units.push(unit);
            units.sort();

            await Setting.findOneAndUpdate(
                { key: 'customUnits' },
                { $set: { value: units, updatedAt: new Date() } },
                { upsert: true, new: true }
            );
        }

        res.json({ success: true, customUnits: units });
    } catch (err) {
        console.error('Add unit error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.removeUnit = async (req, res) => {
    try {
        const { unitName } = req.params;

        let setting = await Setting.findOne({ key: 'customUnits' });
        let units = setting && Array.isArray(setting.value) ? setting.value : [];

        if (units.includes(unitName)) {
            units = units.filter(u => u !== unitName);

            await Setting.findOneAndUpdate(
                { key: 'customUnits' },
                { $set: { value: units, updatedAt: new Date() } },
                { upsert: true, new: true }
            );
        }

        res.json({ success: true, customUnits: units });
    } catch (err) {
        console.error('Remove unit error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
