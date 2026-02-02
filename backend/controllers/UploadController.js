const Settings = require('../models/Settings');

exports.uploadSound = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const soundUrl = `/uploads/audio/${req.file.filename}`;

        // Update settings
        await Settings.findOneAndUpdate(
            { key: 'businessSettings' },
            { $set: { notificationSoundUrl: soundUrl } },
            { upsert: true, new: true }
        );

        res.json({ success: true, soundUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
