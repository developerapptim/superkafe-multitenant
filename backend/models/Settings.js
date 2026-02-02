const mongoose = require('mongoose');

// Settings Model (singleton)
const SettingsSchema = new mongoose.Schema({
    key: { type: String, default: 'businessSettings', unique: true },
    name: String,
    tagline: String,
    phone: String,
    address: String,
    openTime: String,
    closeTime: String,
    wifiName: String,
    wifiPassword: String,
    tax: { type: Number, default: 11 },
    logo: String, // Base64
    apiKey: String,
    customUnits: { type: [String], default: ['gram', 'ml', 'pcs', 'ekor', 'buah', 'ikat', 'kg', 'liter', 'box', 'kaleng'] },

    // Payment Settings
    bankAccount: String,     // e.g. "1234567890"
    bankName: String,        // e.g. "BCA - John Doe"
    bankAccountName: String, // New: Bank Account Holder Name
    ewalletNumber: String,   // e.g. "081234567890"
    ewalletType: String,     // e.g. "OVO/Dana/GoPay"
    ewalletName: String,     // New: Account Holder Name
    isCashPrepaymentRequired: { type: Boolean, default: false }, // New: Cash Prepayment Toggle
    allowStaffEditInventory: { type: Boolean, default: false }, // New: Allow Staff to Add/Edit Inventory & Recipes
    enableQris: { type: Boolean, default: true }, // New: Enable QRIS Toggle
    qrisImage: String,       // Base64 QRIS image
    notificationSoundUrl: String, // URL to custom notification sound

    // Loyalty Program Settings
    loyaltySettings: {
        pointRatio: { type: Number, default: 10000 },    // Rp 10.000 = 1 poin
        tierThresholds: {
            silver: { type: Number, default: 500000 },     // Rp 500k → Silver
            gold: { type: Number, default: 2000000 }       // Rp 2jt → Gold
        },
        enableLoyalty: { type: Boolean, default: true }
    },

    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', SettingsSchema);
