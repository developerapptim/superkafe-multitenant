const mongoose = require('mongoose');

/**
 * User Model (Pre-Tenant)
 * 
 * User yang sudah register tapi belum setup tenant.
 * Setelah setup tenant selesai, data akan dipindah ke Employee di tenant database.
 */
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    // Null untuk Google auth
    default: null
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    default: null
  },
  // Google Auth Fields
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  // OTP for email verification (local auth only)
  otpCode: {
    type: String,
    default: null
  },
  otpExpiry: {
    type: Date,
    default: null
  },
  // Tenant Setup Status
  hasCompletedSetup: {
    type: Boolean,
    default: false
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    default: null
  },
  tenantSlug: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index untuk performa
UserSchema.index({ email: 1 });
UserSchema.index({ googleId: 1 });
UserSchema.index({ hasCompletedSetup: 1 });
UserSchema.index({ tenantSlug: 1 });

module.exports = mongoose.model('User', UserSchema);
