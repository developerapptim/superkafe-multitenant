const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    pax: { type: Number, required: true },
    eventType: { type: String, default: 'Nongkrong' }, // Rapat, Ulang Tahun, Nongkrong, Lainnya
    notes: { type: String, default: '' },
    reservationTime: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    tableId: { type: String, default: null }, // Deprecated, use tableIds
    tableNumber: { type: String, default: null }, // Deprecated, use tableNumbers
    tableIds: [{ type: String }], // Array of table IDs
    tableNumbers: [{ type: String }], // Array of table numbers
    createdBy: { type: String, enum: ['customer', 'staff'], default: 'customer' }
}, { timestamps: true });

module.exports = mongoose.models.Reservation || mongoose.model('Reservation', ReservationSchema);
