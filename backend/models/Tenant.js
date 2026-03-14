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

  // ===== FAQ Settings =====
  faqs: [{
    question: { type: String, required: true },
    answer: { type: String, required: true },
    isActive: { type: Boolean, default: true }
  }],

  // ===== Trial & Subscription Fields =====
  status: {
    type: String,
    enum: ['trial', 'active', 'grace', 'expired', 'suspended'],
    default: 'trial'
  },
  trialExpiresAt: {
    type: Date,
    required: true,
    default: function () {
      const now = new Date();
      return new Date(now.getTime() + (10 * 24 * 60 * 60 * 1000)); // 10 hari
    }
  },
  subscriptionPlan: {
    type: String,
    enum: ['starter', 'bisnis', 'lifetime', null],
    default: null
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null
  },
  gracePeriodEndsAt: {
    type: Date,
    default: null
  },
  subscriptionHistory: [{
    plan: { type: String, required: true },
    amount: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    merchantOrderId: { type: String },
    paidAt: { type: Date, default: Date.now }
  }],

  // ===== Theme Customization Fields =====
  selectedTheme: {
    type: String,
    enum: ['default', 'light-coffee', 'merah-kuning-putih'],
    default: 'default'
  },
  hasSeenThemePopup: {
    type: Boolean,
    default: false
  },
  // ===== Tour Guide Onboarding =====
  hasCompletedTour: {
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

// ===== Indexes =====
tenantSchema.index({ slug: 1 }, {
  unique: true,
  collation: { locale: 'en', strength: 2 }
});
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ status: 1 });
tenantSchema.index({ status: 1, isActive: 1 }); // Compound index for filtering active/trial tenants efficiently
tenantSchema.index({ trialExpiresAt: 1 });
tenantSchema.index({ subscriptionExpiresAt: 1 });

// ===== Virtuals =====
tenantSchema.virtual('isTrialActive').get(function () {
  if (this.status !== 'trial') return false;
  return new Date() < this.trialExpiresAt;
});

tenantSchema.virtual('trialDaysRemaining').get(function () {
  if (this.status !== 'trial') return 0;
  const now = new Date();
  const diff = this.trialExpiresAt - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
});

// ===== Methods =====
tenantSchema.methods.canAccessFeatures = function () {
  if (this.status === 'active') return true;
  if (this.status === 'grace') return true; // Grace period — still accessible
  if (this.status === 'trial' && new Date() < this.trialExpiresAt) return true;
  // Legacy backward compat: 'paid' treated as 'active'
  if (this.status === 'paid') return true;
  return false;
};

/**
 * Auto-transition status based on current dates.
 * Call this before reading status to ensure accuracy.
 * Returns true if status was changed (needs save).
 */
tenantSchema.methods.refreshSubscriptionStatus = function () {
  const now = new Date();
  let changed = false;

  // Legacy: auto-migrate 'paid' → 'active'
  if (this.status === 'paid') {
    this.status = 'active';
    changed = true;
  }

  // Trial expired → check if has subscription, else mark expired
  if (this.status === 'trial' && now >= this.trialExpiresAt) {
    this.status = 'expired';
    changed = true;
  }

  // Active → check if subscription expired → transition to grace
  if (this.status === 'active' && this.subscriptionExpiresAt && now >= this.subscriptionExpiresAt) {
    // Set grace period (3 days) if not already set
    if (!this.gracePeriodEndsAt) {
      this.gracePeriodEndsAt = new Date(this.subscriptionExpiresAt.getTime() + (3 * 24 * 60 * 60 * 1000));
    }
    this.status = 'grace';
    changed = true;
  }

  // Grace → check if grace period ended → transition to expired
  if (this.status === 'grace' && this.gracePeriodEndsAt && now >= this.gracePeriodEndsAt) {
    this.status = 'expired';
    changed = true;
  }

  return changed;
};

tenantSchema.set('toJSON', { virtuals: true });
tenantSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Tenant', tenantSchema);
