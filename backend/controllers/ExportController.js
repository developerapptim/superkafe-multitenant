const XLSX = require('xlsx');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Ingredient = require('../models/Ingredient');

const exportData = async (req, res) => {
    try {
        const { type } = req.params;
        const { startDate, endDate } = req.query;

        let data = [];
        let sheetName = 'Export';

        if (type === 'sales') {
            let filter = {};
            if (startDate && endDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                
                filter.timestamp = {
                    $gte: start.getTime(),
                    $lte: end.getTime()
                };
            }

            const orders = await Order.find(filter).sort({ timestamp: -1 }).lean();
            
            data = orders.map(o => ({
                'Order ID': o.id || o._id?.toString(),
                'Tanggal': new Date(o.timestamp || Date.now()).toLocaleString('id-ID'),
                'Nama Pelanggan': o.customerName || '-',
                'Nomor Meja': o.tableNumber || '-',
                'Total (Rp)': o.total || 0,
                'Diskon Voucher (Rp)': o.voucherDiscount || 0,
                'Subtotal (Rp)': o.subtotal || 0,
                'Status Pesanan': o.status || '-',
                'Status Pembayaran': o.paymentStatus || '-',
                'Metode Pembayaran': o.paymentMethod || '-',
                'Detail Item': (o.items || []).map(i => `${i.name || i.id} (${i.qty || i.count || 1})`).join(', ')
            }));
            sheetName = 'Laporan Penjualan';

        } else if (type === 'menu') {
            // 1. Fetch all menu items
            const menus = await MenuItem.find().lean();

            // 2. Aggregate sold counts from Orders (only done/paid orders)
            const soldAgg = await Order.aggregate([
                {
                    $match: {
                        $or: [
                            { status: 'done' },
                            { paymentStatus: 'paid' }
                        ]
                    }
                },
                { $unwind: '$items' },
                {
                    $group: {
                        _id: '$items.id',
                        totalSold: { $sum: { $ifNull: ['$items.qty', { $ifNull: ['$items.count', 1] }] } }
                    }
                }
            ]);

            // Build lookup map: menuId -> totalSold
            const soldMap = {};
            soldAgg.forEach(s => { soldMap[s._id] = s.totalSold; });

            data = menus.map(m => ({
                'ID Menu': m.id || m._id?.toString(),
                'Nama Menu': m.name || '-',
                'Deskripsi': m.description || '-',
                'Kategori': m.category || '-',
                'Harga Ritel (Rp)': m.price || 0,
                'Harga Coret (Rp)': m.base_price || '-',
                'Label': m.label || 'none',
                'Terjual': soldMap[m.id] || 0,
                'Status Ketersediaan': m.is_active ? 'Tersedia' : 'Nonaktif',
            }));
            sheetName = 'Data Menu';

        } else if (type === 'stock') {
            const stocks = await Ingredient.find().lean();
            data = stocks.map(s => ({
                'ID Bahan': s.id || s._id?.toString(),
                'Nama Bahan': s.nama || '-',
                'Satuan Pakai': s.satuan || s.satuan_prod || '-',
                'Stok Tersedia': s.stok || 0,
                'Batas Minimum Stok': s.stok_min || 0,
                'Satuan Beli': s.satuan_beli || '-',
                'Harga Beli (Rp)': s.harga_beli || 0,
                'Harga Modal/Unit (Rp)': s.harga_modal || 0,
                'Isi per Kemasan': s.isi_prod || 1,
                'Konversi Aktif': s.use_konversi ? 'Ya' : 'Tidak',
                'Estimasi Nilai Stok (Rp)': Math.round((s.stok || 0) * (s.harga_modal || 0)),
            }));
            sheetName = 'Laporan Stok';

        } else {
            return res.status(400).json({ error: 'Tipe export tidak valid' });
        }

        if (data.length === 0) {
            data = [{ info: 'Data kosong / Tidak ada data pada rentang waktu ini' }];
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Export_${type}_${Date.now()}.xlsx"`);
        res.send(buffer);

    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ error: 'Gagal melakukan export data: ' + err.message });
    }
};

module.exports = {
    exportData
};
