const Reservation = require('../models/Reservation');
const Table = require('../models/Table');

// POST /api/reservations — Buat reservasi baru
exports.createReservation = async (req, res) => {
    try {
        const { customerName, customerPhone, pax, eventType, notes, reservationTime, createdBy, tableId } = req.body;

        // Validasi field wajib
        if (!customerName || !customerPhone || !pax || !reservationTime) {
            return res.status(400).json({ error: 'Nama, No. HP, Jumlah Orang, dan Waktu wajib diisi' });
        }

        const reservationData = {
            id: `rsv_${Date.now()}`,
            customerName,
            customerPhone,
            pax: parseInt(pax),
            eventType: eventType || 'Nongkrong',
            notes: notes || '',
            reservationTime: new Date(reservationTime),
            createdBy: createdBy || 'customer',
            status: 'pending'
        };

        // Jika staf langsung assign meja → status approved
        if (createdBy === 'staff' && tableId) {
            const table = await Table.findOne({ id: tableId });
            if (!table) return res.status(404).json({ error: 'Meja tidak ditemukan' });
            if (table.status !== 'available') return res.status(400).json({ error: 'Meja tidak tersedia' });

            // Update meja jadi reserved
            table.status = 'reserved';
            await table.save();

            reservationData.status = 'approved';
            reservationData.tableId = table.id;
            reservationData.tableNumber = table.number;
        }

        const newReservation = new Reservation(reservationData);
        await newReservation.save();

        res.status(201).json(newReservation);
    } catch (err) {
        console.error('Create Reservation Error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
};

// GET /api/reservations — Daftar reservasi (filter by status)
exports.getReservations = async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};

        if (status && status !== 'all') {
            query.status = status;
        }

        const reservations = await Reservation.find(query)
            .sort({ reservationTime: 1 })
            .lean();

        res.json(reservations);
    } catch (err) {
        console.error('Get Reservations Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// PUT /api/reservations/:id/approve — Approve + assign meja
exports.approveReservation = async (req, res) => {
    try {
        const { id } = req.params;
        const { tableId } = req.body;

        if (!tableId) return res.status(400).json({ error: 'Pilih meja untuk reservasi' });

        // Cari reservasi
        const reservation = await Reservation.findOne({ id });
        if (!reservation) return res.status(404).json({ error: 'Reservasi tidak ditemukan' });
        if (reservation.status !== 'pending') return res.status(400).json({ error: 'Reservasi sudah diproses' });

        // Cari meja
        const table = await Table.findOne({ id: tableId });
        if (!table) return res.status(404).json({ error: 'Meja tidak ditemukan' });
        if (table.status !== 'available') return res.status(400).json({ error: 'Meja tidak tersedia' });

        // Update meja jadi reserved
        table.status = 'reserved';
        await table.save();

        // Update reservasi
        reservation.status = 'approved';
        reservation.tableId = table.id;
        reservation.tableNumber = table.number;
        await reservation.save();

        res.json(reservation);
    } catch (err) {
        console.error('Approve Reservation Error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
};

// PUT /api/reservations/:id/reject — Reject reservasi
exports.rejectReservation = async (req, res) => {
    try {
        const { id } = req.params;

        const reservation = await Reservation.findOne({ id });
        if (!reservation) return res.status(404).json({ error: 'Reservasi tidak ditemukan' });
        if (reservation.status !== 'pending') return res.status(400).json({ error: 'Reservasi sudah diproses' });

        reservation.status = 'rejected';
        await reservation.save();

        res.json(reservation);
    } catch (err) {
        console.error('Reject Reservation Error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
};
