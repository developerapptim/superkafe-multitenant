const Setting = require('../models/Setting');
const Settings = require('../models/Settings');

const getSettings = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin
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
}

const getPublicSettings = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin
        // Get key-value settings (branding)
        const settings = await Setting.find({ key: { $in: ['businessName', 'tagline', 'logo', 'showLogo'] } });
        const settingsMap = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        // Also get singleton Settings for loyalty & payment info needed by customer app
        const singletonSettings = await Settings.findOne({ key: 'businessSettings' }).lean();
        if (singletonSettings) {
            settingsMap.loyaltySettings = singletonSettings.loyaltySettings;
            settingsMap.isCashPrepaymentRequired = singletonSettings.isCashPrepaymentRequired;
            settingsMap.qrisImage = singletonSettings.qrisImage;
            settingsMap.bankAccount = singletonSettings.bankAccount;
            settingsMap.bankName = singletonSettings.bankName;
            settingsMap.bankAccountName = singletonSettings.bankAccountName;
            settingsMap.ewalletType = singletonSettings.ewalletType;
            settingsMap.ewalletNumber = singletonSettings.ewalletNumber;
            settingsMap.ewalletName = singletonSettings.ewalletName;
        }

        res.json(settingsMap);
    } catch (err) {
        console.error('Get public settings error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const updateSettings = async (req, res) => {
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

const addUnit = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin
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

const removeUnit = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin
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

const uploadSound = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No sound file uploaded' });
        }

        // Convert buffer to Base64 Data URI
        const base64Audio = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

        // Update setting
        await Setting.findOneAndUpdate(
            { key: 'notificationSoundUrl' }, // We keep the key name for compatibility
            { $set: { value: base64Audio, updatedAt: new Date() } },
            { upsert: true, new: true }
        );

        res.json({ success: true, soundUrl: base64Audio });
    } catch (err) {
        console.error('Upload sound error:', err);
        res.status(500).json({ error: 'Server error during upload' });
    }
};

module.exports = {
  getSettings,
  getPublicSettings,
  updateSettings,
  addUnit,
  removeUnit,
  uploadSound
};
