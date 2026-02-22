const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directories exist
const publicDir = path.join(__dirname, '../public');
const uploadsDir = path.join(publicDir, 'uploads');

// Create all necessary subdirectories
const directories = {
    payments: path.join(uploadsDir, 'payments'),
    audio: path.join(uploadsDir, 'audio'),
    restore: path.join(uploadsDir, 'restore'),
    imports: path.join(uploadsDir, 'imports'),
    images: {
        menu: path.join(uploadsDir, 'images', 'menu'),
        banners: path.join(uploadsDir, 'images', 'banners'),
        profiles: path.join(uploadsDir, 'images', 'profiles'),
        general: path.join(uploadsDir, 'images', 'general')
    }
};

// Create all directories
Object.values(directories).forEach(dir => {
    if (typeof dir === 'string') {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } else {
        Object.values(dir).forEach(subDir => {
            if (!fs.existsSync(subDir)) {
                fs.mkdirSync(subDir, { recursive: true });
            }
        });
    }
});

// Helper function to generate unique filename
const generateUniqueFilename = (originalname, prefix = 'file') => {
    const ext = path.extname(originalname);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${prefix}-${timestamp}-${random}${ext}`;
};

// 1. Payment Proof Storage (LOCAL DISK)
const paymentStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, directories.payments),
    filename: (req, file, cb) => {
        const uniqueName = generateUniqueFilename(file.originalname, 'payment');
        cb(null, uniqueName);
    }
});

exports.uploadPayment = multer({
    storage: paymentStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files allowed'), false);
        }
    }
});

// 2. Audio Storage (UNCHANGED)
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, directories.audio),
    filename: (req, file, cb) => {
        const uniqueName = generateUniqueFilename(file.originalname, 'sound');
        cb(null, uniqueName);
    }
});

exports.uploadAudio = multer({
    storage: audioStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files allowed'), false);
        }
    }
});

// 3. Restore Storage (UNCHANGED)
const restoreStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, directories.restore),
    filename: (req, file, cb) => {
        cb(null, `restore-${Date.now()}.json`);
    }
});

exports.uploadRestore = multer({ storage: restoreStorage });

// 4. Excel Storage (UNCHANGED)
const excelStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, directories.imports),
    filename: (req, file, cb) => {
        const uniqueName = generateUniqueFilename(file.originalname, 'import');
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

// 5. Banner Storage (LOCAL DISK - MIGRATED FROM CLOUDINARY)
const bannerStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, directories.images.banners),
    filename: (req, file, cb) => {
        const uniqueName = generateUniqueFilename(file.originalname, 'banner');
        cb(null, uniqueName);
    }
});

exports.uploadBanner = multer({
    storage: bannerStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files allowed'), false);
        }
    }
});

// 6. Menu Image Storage (NEW - LOCAL DISK - TENANT NAMESPACED)
const menuImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use tenant ID from request context for namespacing
        const tenantId = req.tenant?.id || 'default';
        const tenantDir = path.join(directories.images.menu, tenantId);
        
        // Create tenant-specific directory if it doesn't exist
        if (!fs.existsSync(tenantDir)) {
            fs.mkdirSync(tenantDir, { recursive: true });
        }
        
        cb(null, tenantDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = generateUniqueFilename(file.originalname, 'menu');
        cb(null, uniqueName);
    }
});

exports.uploadMenuImage = multer({
    storage: menuImageStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG, GIF, WebP) allowed'), false);
        }
    }
});

// 7. Profile Image Storage (NEW - LOCAL DISK - TENANT NAMESPACED)
const profileImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use tenant ID from request context for namespacing
        const tenantId = req.tenant?.id || 'default';
        const tenantDir = path.join(directories.images.profiles, tenantId);
        
        // Create tenant-specific directory if it doesn't exist
        if (!fs.existsSync(tenantDir)) {
            fs.mkdirSync(tenantDir, { recursive: true });
        }
        
        cb(null, tenantDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = generateUniqueFilename(file.originalname, 'profile');
        cb(null, uniqueName);
    }
});

exports.uploadProfileImage = multer({
    storage: profileImageStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG, WebP) allowed'), false);
        }
    }
});

// 8. General Image Storage (NEW - LOCAL DISK - TENANT NAMESPACED)
const generalImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use tenant ID from request context for namespacing
        const tenantId = req.tenant?.id || 'default';
        const tenantDir = path.join(directories.images.general, tenantId);
        
        // Create tenant-specific directory if it doesn't exist
        if (!fs.existsSync(tenantDir)) {
            fs.mkdirSync(tenantDir, { recursive: true });
        }
        
        cb(null, tenantDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = generateUniqueFilename(file.originalname, 'image');
        cb(null, uniqueName);
    }
});

exports.uploadGeneralImage = multer({
    storage: generalImageStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files allowed'), false);
        }
    }
});
