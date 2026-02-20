const Reservation = require('../models/Reservation');
const Table = require('../models/Table');

// POST /api/reservations — Buat reservasi baru
const createReservation = async (req, res) => {
    try {
        const { customerName, customerPhone, pax, eventType, notes, reservationTime, createdBy, tableId, tableIds } = req.body;

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
            status: 'pending',
            tableIds: [],
            tableNumbers: []
        };

        // Jika staf langsung assign meja → status approved
        // Support both single tableId and array tableIds
        const targetTableIds = tableIds || (tableId ? [tableId] : []);

        if (createdBy === 'staff' && targetTableIds.length > 0) {
            const tables = await Table.find({ id: { $in: targetTableIds } });

            if (tables.length !== targetTableIds.length) {
                return res.status(404).json({ error: 'Salah satu meja tidak ditemukan' });
            }

            // Check availability
            const unavailable = tables.filter(t => t.status !== 'available');
            if (unavailable.length > 0) {
                return res.status(400).json({ error: `Meja ${unavailable.map(t => t.number).join(', ')} tidak tersedia` });
            }

            // Update status meja jadi reserved
            await Table.updateMany(
                { id: { $in: targetTableIds } },
                { $set: { status: 'reserved' } }
            );

            reservationData.status = 'approved';
            reservationData.tableIds = tables.map(t => t.id);
            reservationData.tableNumbers = tables.map(t => t.number);
            // Legacy support
            reservationData.tableId = tables[0].id;
            reservationData.tableNumber = tables[0].number;
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
const getReservations = async (req, res) => {
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

// PUT /api/reservations/:id/approve — Approve + assign meja (Single or Multiple)
const approveReservation = async (req, res) => {
    try {
        const { id } = req.params;
        const { tableId, tableIds } = req.body;

        // Support both single tableId and array tableIds
        // If neither is provided, error
        const targetTableIds = tableIds || (tableId ? [tableId] : []);

        if (targetTableIds.length === 0) {
            return res.status(400).json({ error: 'Pilih minimal satu meja untuk reservasi' });
        }

        // Cari reservasi
        const reservation = await Reservation.findOne({ id });
        if (!reservation) return res.status(404).json({ error: 'Reservasi tidak ditemukan' });
        if (reservation.status !== 'pending') return res.status(400).json({ error: 'Reservasi sudah diproses' });

        // Cari semua meja
        const tables = await Table.find({ id: { $in: targetTableIds } });

        if (tables.length !== targetTableIds.length) {
            return res.status(404).json({ error: 'Salah satu meja tidak ditemukan' });
        }

        // Check availability
        const unavailable = tables.filter(t => t.status !== 'available');
        if (unavailable.length > 0) {
            return res.status(400).json({
                error: `Meja ${unavailable.map(t => t.number).join(', ')} tidak tersedia`
            });
        }

        // Update status meja jadi reserved
        await Table.updateMany(
            { id: { $in: targetTableIds } },
            { $set: { status: 'reserved' } }
        );

        // Update reservasi
        reservation.status = 'approved';
        reservation.tableIds = tables.map(t => t.id);
        reservation.tableNumbers = tables.map(t => t.number);

        // Legacy fields (use first table)
        reservation.tableId = tables[0].id;
        reservation.tableNumber = tables[0].number;

        await reservation.save();

        res.json(reservation);
    } catch (err) {
        console.error('Approve Reservation Error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
};

// PUT /api/reservations/:id/reject — Reject reservasi
const rejectReservation = async (req, res) => {
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

module.exports = {
  createReservation,
  getReservations,
  approveReservation,
  rejectReservation
};
