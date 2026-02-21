/**
 * DEPRECATED - Cloudinary Configuration
 * Sistem sudah migrasi ke local storage
 * File ini di-comment untuk backward compatibility
 * Jika ada error, restore dari cloudinary.js.backup
 */

// const cloudinary = require('cloudinary').v2;

// cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET
// });

// module.exports = cloudinary;

// Temporary export untuk prevent errors
module.exports = {
  uploader: {
    upload_stream: () => {
      throw new Error('Cloudinary is deprecated. Use local storage instead.');
    }
  }
};
