const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

/**
 * GET /api/download-app
 * Public endpoint — downloads the SuperKafe APK with versioned filename.
 * 
 * No-Code Update Flow:
 * 1. Upload new superkafe.apk via FileZilla to ./backend/public/uploads/
 * 2. Edit app-version.json to update the version number
 * 3. No restart or code change needed
 */
router.get('/download-app', (req, res) => {
    try {
        // Deteksi apakah sedang jalan di Docker VPS (dimana volume dimount ke /app/public/uploads)
        // atau sedang jalan di local development (__dirname/../public/uploads)
        const dockerUploadsDir = '/app/public/uploads';
        const localUploadsDir = path.join(__dirname, '..', 'public', 'uploads');
        const uploadsDir = fs.existsSync(dockerUploadsDir) ? dockerUploadsDir : localUploadsDir;
        
        const versionFilePath = path.join(uploadsDir, 'app-version.json');
        const apkFilePath = path.join(uploadsDir, 'superkafe.apk');

        // 1. Check if APK file exists
        if (!fs.existsSync(apkFilePath)) {
            // Mengirim teks biasa (bukan JSON) agar NGINX tidak membajak layar 404 menjadi React UI
            return res.status(404).send('MAAF: File APK tidak ditemukan di server. Pastikan FileZilla telah terupload ke ./backend/public/uploads/superkafe.apk');
        }

        // 2. Read version from config file (fallback to 1.0.0 if missing)
        let version = '1.0.0';
        try {
            if (fs.existsSync(versionFilePath)) {
                const versionData = JSON.parse(fs.readFileSync(versionFilePath, 'utf-8'));
                version = versionData.version || '1.0.0';
            }
        } catch (parseErr) {
            console.warn('[Download] Failed to parse app-version.json, using default version:', parseErr.message);
        }

        // 3. Send file with versioned filename
        const downloadName = `superkafe-v${version}.apk`;
        res.download(apkFilePath, downloadName, (err) => {
            if (err) {
                console.error('[Download] Error sending APK:', err.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Gagal mengirim file APK.' });
                }
            }
        });
    } catch (err) {
        console.error('[Download] Unexpected error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
