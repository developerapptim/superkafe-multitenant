const Voucher = require('../models/Voucher');
const Banner = require('../models/Banner');
const logActivity = require('../utils/activityLogger');

// ========== VOUCHER CRUD ==========

// GET /api/vouchers - Daftar semua voucher
const getVouchers = async (req, res) => {
    try {
        const vouchers = await Voucher.find().sort({ createdAt: -1 });
        res.json(vouchers);
    } catch (err) {
        console.error('Error getVouchers:', err);
        res.status(500).json({ error: 'Gagal memuat voucher' });
    }
};

// POST /api/vouchers - Buat voucher baru
const createVoucher = async (req, res) => {
    try {
        const { code, discount_type, discount_value, min_purchase, max_discount, quota, valid_until } = req.body;

        // Validasi duplikat kode
        const existing = await Voucher.findOne({ code: code.toUpperCase().trim() });
        if (existing) {
            return res.status(400).json({ error: 'Kode voucher sudah digunakan' });
        }

        const voucher = new Voucher({
            code: code.toUpperCase().trim(),
            discount_type,
            discount_value: Number(discount_value),
            min_purchase: Number(min_purchase) || 0,
            max_discount: discount_type === 'percent' ? (Number(max_discount) || null) : null,
            quota: Number(quota) || 0,
            valid_until: new Date(valid_until),
        });

        await voucher.save();

        await logActivity({
            req,
            action: 'CREATE_VOUCHER',
            module: 'MARKETING',
            description: `Membuat voucher ${voucher.code} (${discount_type} ${discount_value})`
        });

        res.status(201).json(voucher);
    } catch (err) {
        console.error('Error createVoucher:', err);
        res.status(500).json({ error: 'Gagal membuat voucher' });
    }
};

// PUT /api/vouchers/:id - Update voucher
const updateVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, discount_type, discount_value, min_purchase, max_discount, quota, valid_until } = req.body;

        const voucher = await Voucher.findById(id);
        if (!voucher) return res.status(404).json({ error: 'Voucher tidak ditemukan' });

        // Cek duplikat kode jika berubah
        if (code && code.toUpperCase().trim() !== voucher.code) {
            const existing = await Voucher.findOne({ code: code.toUpperCase().trim() });
            if (existing) return res.status(400).json({ error: 'Kode voucher sudah digunakan' });
            voucher.code = code.toUpperCase().trim();
        }

        if (discount_type) voucher.discount_type = discount_type;
        if (discount_value !== undefined) voucher.discount_value = Number(discount_value);
        if (min_purchase !== undefined) voucher.min_purchase = Number(min_purchase);
        if (max_discount !== undefined) voucher.max_discount = (voucher.discount_type === 'percent') ? (Number(max_discount) || null) : null;
        if (quota !== undefined) voucher.quota = Number(quota);
        if (valid_until) voucher.valid_until = new Date(valid_until);

        await voucher.save();
        res.json(voucher);
    } catch (err) {
        console.error('Error updateVoucher:', err);
        res.status(500).json({ error: 'Gagal mengupdate voucher' });
    }
};

// PATCH /api/vouchers/:id/toggle - Toggle aktif/nonaktif
const toggleVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const voucher = await Voucher.findById(id);
        if (!voucher) return res.status(404).json({ error: 'Voucher tidak ditemukan' });

        voucher.is_active = !voucher.is_active;
        await voucher.save();

        res.json(voucher);
    } catch (err) {
        console.error('Error toggleVoucher:', err);
        res.status(500).json({ error: 'Gagal mengubah status voucher' });
    }
};

// DELETE /api/vouchers/:id - Hapus voucher
const deleteVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        await Voucher.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleteVoucher:', err);
        res.status(500).json({ error: 'Gagal menghapus voucher' });
    }
};

// ========== APPLY VOUCHER (Customer) ==========

// POST /api/cart/apply-voucher
const applyVoucher = async (req, res) => {
    try {
        const { code, subtotal } = req.body;

        if (!code || !subtotal) {
            return res.status(400).json({ error: 'Kode voucher dan subtotal diperlukan' });
        }

        const voucher = await Voucher.findOne({ code: code.toUpperCase().trim() });

        // Validasi 1: Kode ada?
        if (!voucher) {
            return res.status(404).json({ error: 'Kode voucher tidak ditemukan' });
        }

        // Validasi 2: Aktif?
        if (!voucher.is_active) {
            return res.status(400).json({ error: 'Voucher sudah tidak aktif' });
        }

        // Validasi 3: Belum expired?
        if (new Date() > new Date(voucher.valid_until)) {
            return res.status(400).json({ error: 'Voucher sudah kedaluwarsa' });
        }

        // Validasi 4: Kuota habis?
        if (voucher.quota > 0 && voucher.used_count >= voucher.quota) {
            return res.status(400).json({ error: 'Kuota voucher sudah habis' });
        }

        // Validasi 5: Min purchase?
        if (subtotal < voucher.min_purchase) {
            const formatted = new Intl.NumberFormat('id-ID').format(voucher.min_purchase);
            return res.status(400).json({ error: `Minimum belanja Rp ${formatted}` });
        }

        // Hitung diskon
        let discount = 0;
        if (voucher.discount_type === 'percent') {
            discount = Math.round(subtotal * (voucher.discount_value / 100));
            // Terapkan max_discount jika ada
            if (voucher.max_discount && discount > voucher.max_discount) {
                discount = voucher.max_discount;
            }
        } else {
            // Nominal langsung
            discount = voucher.discount_value;
        }

        // Diskon tidak boleh melebihi subtotal
        if (discount > subtotal) {
            discount = subtotal;
        }

        res.json({
            success: true,
            code: voucher.code,
            discount_type: voucher.discount_type,
            discount_value: voucher.discount_value,
            discount, // Nominal potongan akhir
            total_after_discount: subtotal - discount
        });
    } catch (err) {
        console.error('Error applyVoucher:', err);
        res.status(500).json({ error: 'Gagal memproses voucher' });
    }
};

// ========== BANNER CRUD ==========

// GET /api/banners - Daftar banner (public)
const getBanners = async (req, res) => {
    try {
        const { active_only } = req.query;
        const filter = active_only === 'true' ? { is_active: true } : {};
        const banners = await Banner.find(filter).sort({ order: 1, createdAt: -1 });
        res.json(banners);
    } catch (err) {
        console.error('Error getBanners:', err);
        res.status(500).json({ error: 'Gagal memuat banner' });
    }
};

// POST /api/banners - Upload banner baru (dengan multer)
const createBanner = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Gambar banner wajib diupload' });
        }

        // Upload ke Cloudinary
        const cloudinary = require('../utils/cloudinary');
        const streamUpload = (buffer) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: 'superkafe-banners',
                        resource_type: 'image',
                        transformation: [
                            { width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
                        ]
                    },
                    (error, result) => {
                        if (result) resolve(result);
                        else reject(error);
                    }
                );
                stream.write(buffer);
                stream.end();
            });
        };

        const uploadResult = await streamUpload(req.file.buffer);

        const { title } = req.body;
        const lastBanner = await Banner.findOne().sort({ order: -1 });
        const nextOrder = lastBanner ? (lastBanner.order + 1) : 0;

        const banner = new Banner({
            image_url: uploadResult.secure_url,
            title: title || '',
            order: nextOrder,
        });

        await banner.save();

        await logActivity({
            req,
            action: 'CREATE_BANNER',
            module: 'MARKETING',
            description: `Upload banner promo: ${title || 'Tanpa judul'}`
        });

        res.status(201).json(banner);
    } catch (err) {
        console.error('Error createBanner:', err);
        res.status(500).json({ error: 'Gagal mengupload banner' });
    }
};

// DELETE /api/banners/:id - Hapus banner
const deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;
        await Banner.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleteBanner:', err);
        res.status(500).json({ error: 'Gagal menghapus banner' });
    }
};

module.exports = {
  getVouchers,
  createVoucher,
  updateVoucher,
  toggleVoucher,
  deleteVoucher,
  applyVoucher,
  getBanners,
  createBanner,
  deleteBanner
};
