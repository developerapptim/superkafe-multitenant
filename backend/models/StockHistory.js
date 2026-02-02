const mongoose = require('mongoose');

// StockHistory Model (expanded for restock moving average)
const StockHistorySchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    ing_id: String,
    ingId: String, // Alternative field name
    ingName: String,
    type: { type: String, enum: ['in', 'out', 'opname', 'restock'] },
    qty: Number,
    hargaBeli: Number,
    modalLama: Number,
    modalBaru: Number,
    stokSebelum: Number,
    stokSesudah: Number,
    note: String,
    date: String,
    time: String,
    timestamp: { type: Number, default: Date.now }
});

module.exports = mongoose.model('StockHistory', StockHistorySchema);
