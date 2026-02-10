/**
 * Script Migrasi Gambar Base64 → Cloudinary
 * 
 * Mengonversi semua gambar Base64 di collection MenuItems
 * menjadi URL Cloudinary secara otomatis.
 * 
 * Jalankan: cd backend && node scripts/migrateImages.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

// ─── Konfigurasi Cloudinary ───
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Import Model ───
const MenuItem = require('../models/MenuItem');

// ─── Fungsi Utama ───
async function migrateImages() {
    console.log('🚀 Memulai migrasi gambar Base64 → Cloudinary...\n');

    // 1. Koneksi ke MongoDB
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Terhubung ke MongoDB\n');
    } catch (err) {
        console.error('❌ Gagal terhubung ke MongoDB:', err.message);
        process.exit(1);
    }

    // 2. Cari semua dokumen dengan imageUrl yang diawali 'data:image'
    const items = await MenuItem.find({
        imageUrl: { $regex: /^data:image/ }
    });

    if (items.length === 0) {
        console.log('ℹ️  Tidak ada gambar Base64 yang perlu dimigrasi. Database sudah bersih!');
        await mongoose.connection.close();
        console.log('🔒 Koneksi database ditutup.');
        return;
    }

    console.log(`📦 Ditemukan ${items.length} produk dengan gambar Base64.\n`);

    let berhasil = 0;
    let gagal = 0;

    // 3. Looping satu per satu
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const nomorUrut = i + 1;

        try {
            // Upload Base64 ke Cloudinary
            const result = await cloudinary.uploader.upload(item.imageUrl, {
                folder: 'menu-migrasi',
                resource_type: 'image',
            });

            // Dapatkan secure_url
            const secureUrl = result.secure_url;

            // Update dokumen: timpa imageUrl dengan URL Cloudinary
            item.imageUrl = secureUrl;
            await item.save();

            berhasil++;
            console.log(`✅ Berhasil migrasi: ${item.name} (${nomorUrut}/${items.length})`);
        } catch (err) {
            gagal++;
            console.error(`❌ Gagal migrasi: ${item.name} (${nomorUrut}/${items.length}) - ${err.message}`);
        }
    }

    // 4. Ringkasan
    console.log('\n' + '═'.repeat(50));
    console.log('📊 RINGKASAN MIGRASI');
    console.log('═'.repeat(50));
    console.log(`   Total produk   : ${items.length}`);
    console.log(`   ✅ Berhasil     : ${berhasil}`);
    console.log(`   ❌ Gagal        : ${gagal}`);
    console.log('═'.repeat(50));

    // 5. Tutup koneksi
    await mongoose.connection.close();
    console.log('\n🔒 Koneksi database ditutup. Migrasi selesai!');
}

// ─── Eksekusi ───
migrateImages().catch((err) => {
    console.error('❌ Error fatal:', err);
    mongoose.connection.close().finally(() => process.exit(1));
});
