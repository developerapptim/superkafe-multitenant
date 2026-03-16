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

        // Also fetch singleton settings containing payment & system config
        const singletonSettings = await Settings.findOne({ key: 'businessSettings' }).lean();
        if (singletonSettings) {
            // Merge singleton fields into settingsMap
            Object.keys(singletonSettings).forEach(key => {
                if (key !== '_id' && key !== '__v' && key !== 'key' && key !== 'tenantId') {
                    settingsMap[key] = singletonSettings[key];
                }
            });
        }

        res.json(settingsMap);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
}

const getPublicSettings = async (req, res) => {
    try {
        // Tenant scoping is automatic via plugin
        // Get key-value settings (branding & customer theme)
        const settings = await Setting.find({ key: { $in: ['businessName', 'tagline', 'logo', 'showLogo', 'customerTheme'] } });
        const settingsMap = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        // Fallback: If customerTheme is not set explicitly in settings, use the tenant's selectedTheme
        if (!settingsMap.customerTheme && req.tenant && req.tenant.selectedTheme) {
            settingsMap.customerTheme = req.tenant.selectedTheme;
        }

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

        // Keys that belong to the Settings singleton (businessSettings document)
        const singletonKeys = [
            'isCashPrepaymentRequired', 'allowStaffEditInventory', 'enableQris', 
            'qrisImage', 'bankName', 'bankAccount', 'bankAccountName', 
            'ewalletType', 'ewalletNumber', 'ewalletName', 'notificationSoundUrl',
            'loyaltySettings', 'tax', 'customUnits', 'name', 'phone', 'address', 'openTime', 'closeTime', 'wifiName', 'wifiPassword' // all from Settings schema
        ];

        // Case 1: Single update (legacy or specific usage: { key, value })
        if (updates.key && updates.value !== undefined) {
            if (singletonKeys.includes(updates.key)) {
                const setting = await Settings.findOneAndUpdate(
                    { key: 'businessSettings' },
                    { $set: { [updates.key]: updates.value, updatedAt: new Date() } },
                    { upsert: true, new: true }
                );
                return res.json({ success: true, setting });
            } else {
                const setting = await Setting.findOneAndUpdate(
                    { key: updates.key },
                    { $set: { value: updates.value, updatedAt: new Date() } },
                    { upsert: true, new: true }
                );
                return res.json({ success: true, setting });
            }
        }

        // Case 2: Bulk update (frontend sends entire settings object)
        const singletonUpdates = {};
        const kvUpdates = {};

        Object.keys(updates).forEach(key => {
            if (singletonKeys.includes(key)) {
                singletonUpdates[key] = updates[key];
            } else {
                kvUpdates[key] = updates[key];
            }
        });

        // Update KV store
        const promises = Object.keys(kvUpdates).map(async (key) => {
            return Setting.findOneAndUpdate(
                { key },
                { $set: { value: kvUpdates[key], updatedAt: new Date() } },
                { upsert: true, new: true }
            );
        });

        await Promise.all(promises);

        // Update Singleton store
        if (Object.keys(singletonUpdates).length > 0) {
            await Settings.findOneAndUpdate(
                { key: 'businessSettings' },
                { $set: { ...singletonUpdates, updatedAt: new Date() } },
                { upsert: true, new: true }
            );
        }

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
