const XLSX = require('xlsx');
const MenuItem = require('../models/MenuItem');
const Ingredient = require('../models/Ingredient');
const fs = require('fs');

const importData = async (req, res) => {
    try {
        const { type } = req.params;
        const tenantId = req.tenant?.id;

        if (!req.file) {
            return res.status(400).json({ error: 'File tidak ditemukan' });
        }

        // Read the Excel file
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);

        let createdCount = 0;
        let updatedCount = 0;

        if (type === 'menu') {
            for (const row of data) {
                const idMenu = row['ID Menu']?.toString().trim();
                const namaMenu = row['Nama Menu']?.toString().trim();
                
                if (!namaMenu) continue; // Skip empty rows

                const menuData = {
                    name: namaMenu,
                    description: row['Deskripsi'] || '',
                    category: row['Kategori']?.toString().toLowerCase() || 'lainnya',
                    price: Number(row['Harga Ritel (Rp)']) || 0,
                    base_price: Number(row['Harga Coret (Rp)']) || 0,
                    label: row['Label']?.toString().toLowerCase() || 'none',
                    is_active: row['Status Ketersediaan']?.toString().toLowerCase() !== 'nonaktif',
                    tenant: tenantId
                };

                // Find existing by ID or Name
                let existingMenu = null;
                if (idMenu) {
                    existingMenu = await MenuItem.findOne({ $or: [{ id: idMenu }, { _id: idMenu.length === 24 ? idMenu : null }], tenant: tenantId });
                }
                if (!existingMenu) {
                    existingMenu = await MenuItem.findOne({ name: { $regex: new RegExp(`^${namaMenu}$`, 'i') }, tenant: tenantId });
                }

                if (existingMenu) {
                    await MenuItem.findByIdAndUpdate(existingMenu._id, menuData);
                    updatedCount++;
                } else {
                    menuData.id = `m${Date.now()}${Math.floor(Math.random() * 100)}`; // Basic ID generation
                    await MenuItem.create(menuData);
                    createdCount++;
                }
            }
        } else if (type === 'stock') {
            for (const row of data) {
                const idBahan = row['ID Bahan']?.toString().trim();
                const namaBahan = row['Nama Bahan']?.toString().trim();

                if (!namaBahan) continue;

                const stockData = {
                    nama: namaBahan,
                    satuan: row['Satuan Pakai'] || 'pcs',
                    satuan_prod: row['Satuan Pakai'] || 'pcs',
                    stok: Number(row['Stok Tersedia']) || 0,
                    stok_min: Number(row['Batas Minimum Stok']) || 0,
                    satuan_beli: row['Satuan Beli'] || 'pcs',
                    harga_beli: Number(row['Harga Beli (Rp)']) || 0,
                    harga_modal: Number(row['Harga Modal/Unit (Rp)']) || 0,
                    isi_prod: Number(row['Isi per Kemasan']) || 1,
                    use_konversi: row['Konversi Aktif']?.toString().toLowerCase() === 'ya',
                    tenant: tenantId
                };

                let existingStock = null;
                if (idBahan) {
                    existingStock = await Ingredient.findOne({ $or: [{ id: idBahan }, { _id: idBahan.length === 24 ? idBahan : null }], tenant: tenantId });
                }
                if (!existingStock) {
                    existingStock = await Ingredient.findOne({ nama: { $regex: new RegExp(`^${namaBahan}$`, 'i') }, tenant: tenantId });
                }

                if (existingStock) {
                    // Update existing
                    await Ingredient.findByIdAndUpdate(existingStock._id, stockData);
                    updatedCount++;
                } else {
                    // Insert new
                    stockData.id = `ing${Date.now()}${Math.floor(Math.random() * 100)}`;
                    await Ingredient.create(stockData);
                    createdCount++;
                }
            }
        } else {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Tipe import tidak valid' });
        }

        // Clean up uploaded file
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.json({ message: 'Import sukses', created: createdCount, updated: updatedCount });

    } catch (err) {
        console.error('Import error:', err);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Gagal melakukan import data: ' + err.message });
    }
};

module.exports = {
    importData
};
