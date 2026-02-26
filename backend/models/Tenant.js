const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/
  },
  dbName: {
    type: String,
    required: true
    // unique: true removed - In Unified Nexus Architecture, all tenants share the same database
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Trial & Subscription Fields
  status: {
    type: String,
    enum: ['trial', 'paid', 'expired', 'suspended'],
    default: 'trial'
  },
  trialExpiresAt: {
    type: Date,
    required: true,
    default: function() {
      // Set trial 10 hari dari sekarang
      const now = new Date();
      return new Date(now.getTime() + (10 * 24 * 60 * 60 * 1000));
    }
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null
  },
  // Theme Customization Fields
  selectedTheme: {
    type: String,
    enum: ['default', 'light-coffee'],
    default: 'default'
  },
  hasSeenThemePopup: {
    type: Boolean,
    default: false
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

// Index untuk performa query
// Case-insensitive unique index for slug to prevent duplicates like "Cafe-Kopi" and "cafe-kopi"
tenantSchema.index({ slug: 1 }, { 
  unique: true, 
  collation: { locale: 'en', strength: 2 } 
});
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ status: 1 });
tenantSchema.index({ trialExpiresAt: 1 });

// Virtual untuk cek apakah trial masih aktif
tenantSchema.virtual('isTrialActive').get(function() {
  if (this.status !== 'trial') return false;
  return new Date() < this.trialExpiresAt;
});

// Virtual untuk hitung sisa hari trial
tenantSchema.virtual('trialDaysRemaining').get(function() {
  if (this.status !== 'trial') return 0;
  const now = new Date();
  const diff = this.trialExpiresAt - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
});

// Method untuk cek apakah tenant bisa akses fitur
tenantSchema.methods.canAccessFeatures = function() {
  // Jika paid atau trial masih aktif, bisa akses
  if (this.status === 'paid') return true;
  if (this.status === 'trial' && new Date() < this.trialExpiresAt) return true;
  return false;
};

// Ensure virtuals are included in JSON
tenantSchema.set('toJSON', { virtuals: true });
tenantSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Tenant', tenantSchema);
