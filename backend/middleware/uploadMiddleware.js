const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directories exist
const publicDir = path.join(__dirname, '../public');
const uploadsDir = path.join(publicDir, 'uploads', 'payments');
const audioDir = path.join(publicDir, 'uploads', 'audio');
const restoreDir = path.join(publicDir, 'uploads', 'restore');
const excelDir = path.join(publicDir, 'uploads', 'imports');

[uploadsDir, audioDir, restoreDir, excelDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 1. Payment Proof Storage
// 1. Payment Proof Storage (Memory Storage for Cloudinary)
const paymentStorage = multer.memoryStorage();
exports.uploadPayment = multer({
    storage: paymentStorage,
    limits: { fileSize: 10 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 }, // 10MB file, 50MB field
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files allowed'), false);
    }
});

// 2. Audio Storage
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, audioDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `sound-${Date.now()}${ext}`;
        cb(null, uniqueName);
    }
});
exports.uploadAudio = multer({
    storage: audioStorage,
    limits: { fileSize: 10 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 }, // 10MB file, 50MB field
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) cb(null, true);
        else cb(new Error('Only audio files allowed'), false);
    }
});

// 3. Restore Storage
const restoreStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, restoreDir),
    filename: (req, file, cb) => {
        cb(null, `restore-${Date.now()}.json`);
    }
});
exports.uploadRestore = multer({ storage: restoreStorage });

// 4. Excel Storage
const excelStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, excelDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `import-${Date.now()}${ext}`;
        cb(null, uniqueName);
    }
});
exports.uploadExcel = multer({
    storage: excelStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.includes('sheet') || file.mimetype.includes('excel') || file.originalname.endsWith('.xlsx')) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel (.xlsx) files allowed'), false);
        }
    }
});

// 5. Banner Storage (Memory Storage for Cloudinary)
const bannerStorage = multer.memoryStorage();
exports.uploadBanner = multer({
    storage: bannerStorage,
    limits: { fileSize: 10 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 }, // 10MB file, 50MB field
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files allowed'), false);
    }
});

