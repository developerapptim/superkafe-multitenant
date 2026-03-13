const PaymentGateway = require('./PaymentGateway');
const DuitkuProvider = require('./providers/DuitkuProvider');
const Tenant = require('../../models/Tenant');
const Order = require('../../models/Order');

/**
 * Payment Service
 * Business logic layer untuk payment processing
 * Menggunakan PaymentGateway interface untuk abstraksi provider
 */
class PaymentService {
  constructor() {
    const provider = this.initializeProvider();
    this.gateway = new PaymentGateway(provider);
  }

  initializeProvider() {
    const providerName = process.env.PAYMENT_PROVIDER || 'duitku';

    switch (providerName.toLowerCase()) {
      case 'duitku':
        return new DuitkuProvider({
          merchantCode: process.env.DUITKU_MERCHANT_CODE,
          apiKey: process.env.DUITKU_API_KEY,
          mode: process.env.DUITKU_MODE || 'sandbox'
        });

      default:
        throw new Error(`Unsupported payment provider: ${providerName}`);
    }
  }

  /**
   * Create subscription payment untuk tenant
   */
  async createSubscriptionPayment(params) {
    try {
      const {
        tenantSlug,
        planType = 'starter',
        email,
        customerName,
        phoneNumber
      } = params;

      // Guest checkout: skip tenant lookup
      let tenantName = customerName || 'Guest';
      if (tenantSlug !== 'guest') {
        const tenant = await Tenant.findOne({ slug: tenantSlug }).lean();
        if (!tenant) {
          throw new Error('Tenant tidak ditemukan');
        }
        tenantName = customerName || tenant.name;
      }

      // SECURITY: Harga SELALU dari server
      const pricing = this.getPricing(planType);
      
      const safeTenantSlug = (tenantSlug || 'guest').replace(/[^a-zA-Z0-9]/g, '');
      const safePlanType = (planType || 'starter').replace(/[^a-zA-Z0-9]/g, '');
      const merchantOrderId = `SUB-${safeTenantSlug.toUpperCase()}-${safePlanType.toUpperCase()}-${Date.now()}`;

      const callbackUrl = process.env.DUITKU_CALLBACK_URL
        || `${process.env.BACKEND_URL || 'https://superkafe.com'}/api/payments/callback`;

      const returnUrl = tenantSlug === 'guest'
        ? `${process.env.FRONTEND_URL || 'https://superkafe.com'}/?payment=success`
        : `${process.env.FRONTEND_URL || 'https://superkafe.com'}/${tenantSlug}/admin/subscription/upgrade?payment=success`;

      const paymentParams = {
        merchantOrderId,
        amount: pricing.amount,
        productDetails: pricing.description,
        email,
        customerName: tenantName,
        phoneNumber: phoneNumber && phoneNumber.length >= 10 ? phoneNumber : '08123456789',
        callbackUrl,
        returnUrl,
        expiryPeriod: 60
      };

      console.log('[PAYMENT] Creating invoice (Hosted Payment Page)', {
        tenantSlug, planType, amount: pricing.amount, merchantOrderId
      });

      const result = await this.gateway.createInvoice(paymentParams);

      if (result.success) {
        return {
          success: true,
          paymentUrl: result.paymentUrl,
          reference: result.reference,
          merchantOrderId,
          amount: pricing.amount,
          planType,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        };
      } else {
        throw new Error(result.error || 'Failed to create payment');
      }
    } catch (error) {
      console.error('[PAYMENT ERROR] Create subscription failed', {
        error: error.message, stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Process payment callback & upgrade tenant
   * @param {Object} callbackData - Callback from payment gateway
   * @param {Object} io - Socket.io instance for real-time notifications
   */
  async processCallback(callbackData, io) {
    try {
      console.log('[PAYMENT] Processing callback', {
        merchantOrderId: callbackData.merchantOrderId
      });

      const verification = await this.gateway.verifyCallback(callbackData);

      if (!verification.success) {
        throw new Error(verification.error || 'Callback verification failed');
      }

      if (!verification.isPaymentSuccess) {
        console.warn('[PAYMENT] Payment not successful', {
          merchantOrderId: verification.merchantOrderId,
          resultCode: verification.resultCode
        });
        return { success: true, message: 'Payment not successful', paymentSuccess: false };
      }

      const parts = verification.merchantOrderId.split('-');
      const tenantSlug = parts[1].toLowerCase();

      // Handle Subscription (SUB-) or Order (ORD-)
      if (parts[0] === 'SUB') {
        const planType = parts[2].toLowerCase();
        const result = await this.upgradeTenant(tenantSlug, planType, verification.merchantOrderId, io);
        
        console.log('[PAYMENT] Subscription callback processed successfully', {
          tenantSlug, plan: planType, merchantOrderId: verification.merchantOrderId
        });

        return {
          success: true,
          message: 'Subscription processed successfully',
          paymentSuccess: true,
          tenantSlug,
          plan: planType,
          upgradedTo: result.status
        };
      } else if (parts[0] === 'ORD') {
        // Format: ORD-TENANTSLUG-TIMESTAMP
        // Update Order status
        const orderId = verification.merchantOrderId;
        const order = await Order.findOne({ id: orderId });
        
        if (!order) {
          throw new Error(`Order ${orderId} tidak ditemukan`);
        }

        order.paymentStatus = 'paid';
        await order.save();

        // Emit real-time notification to Kasir POS (triggers sound & toast)
        if (io) {
          io.to(tenantSlug).emit('orders:update', { action: 'create', order });
          console.log(`[SOCKET] Emitted orders:update (paid) to room ${tenantSlug}`);
        }

        console.log('[PAYMENT] Order payment callback processed successfully', {
          tenantSlug, orderId: verification.merchantOrderId
        });

        return {
          success: true,
          message: 'Order payment processed successfully',
          paymentSuccess: true,
          tenantSlug,
          orderId
        };
      }

      throw new Error('Unsupported merchant order ID type');
    } catch (error) {
      console.error('[PAYMENT ERROR] Process callback failed', {
        error: error.message, stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Upgrade tenant to active subscription
   * Supports renewals (stacking duration) and records history
   * @param {String} tenantSlug
   * @param {String} planType - starter | bisnis | lifetime
   * @param {String} merchantOrderId
   * @param {Object} io - Socket.io instance
   */
  async upgradeTenant(tenantSlug, planType = 'starter', merchantOrderId = '', io = null) {
    try {
      const tenant = await Tenant.findOne({ slug: tenantSlug });
      if (!tenant) {
        throw new Error('Tenant tidak ditemukan');
      }

      const pricing = this.getPricing(planType);
      const now = new Date();

      // Calculate new expiry — stack on existing if still active
      let newExpiry;
      if (planType === 'lifetime') {
        newExpiry = new Date(now.getTime() + (36500 * 24 * 60 * 60 * 1000)); // ~100 years
      } else {
        const baseDate = (tenant.subscriptionExpiresAt && tenant.subscriptionExpiresAt > now)
          ? tenant.subscriptionExpiresAt  // Stack on existing
          : now;                           // Start fresh
        newExpiry = new Date(baseDate.getTime() + (pricing.duration * 24 * 60 * 60 * 1000));
      }

      // Update tenant
      tenant.status = 'active';
      tenant.subscriptionPlan = planType;
      tenant.subscriptionExpiresAt = newExpiry;
      tenant.gracePeriodEndsAt = new Date(newExpiry.getTime() + (3 * 24 * 60 * 60 * 1000));

      // Push to history
      tenant.subscriptionHistory.push({
        plan: planType,
        amount: pricing.amount,
        startDate: now,
        endDate: newExpiry,
        merchantOrderId,
        paidAt: now
      });

      await tenant.save();

      console.log('[PAYMENT] Tenant upgraded', {
        tenantSlug, plan: planType, status: 'active', expiresAt: newExpiry
      });

      // Emit real-time update via Socket.io
      if (io) {
        const subscriptionData = {
          status: 'active',
          plan: planType,
          subscriptionExpiresAt: newExpiry,
          gracePeriodEndsAt: tenant.gracePeriodEndsAt,
          daysRemaining: Math.ceil((newExpiry - now) / (1000 * 60 * 60 * 24)),
          canAccessFeatures: true,
          isGracePeriod: false
        };
        io.to(tenantSlug).emit('subscription:updated', subscriptionData);
        console.log(`[SOCKET] Emitted subscription:updated to room ${tenantSlug}`);
      }

      return {
        success: true,
        status: 'active',
        plan: planType,
        subscriptionExpiresAt: newExpiry
      };
    } catch (error) {
      console.error('[PAYMENT ERROR] Upgrade tenant failed', {
        error: error.message, tenantSlug
      });
      throw error;
    }
  }

  /**
   * Get pricing by plan type — server authority
   */
  getPricing(planType) {
    const pricing = {
      starter: {
        amount: 200000,
        description: 'Paket Starter SuperKafe - 30 Hari',
        duration: 30
      },
      bisnis: {
        amount: 1700000,
        description: 'Paket Bisnis SuperKafe - 365 Hari (Hemat Rp 700.000)',
        duration: 365
      },
      lifetime: {
        amount: 5500000,
        description: 'Paket Lifetime SuperKafe - Tanpa Batas Waktu',
        duration: 36500
      }
    };

    const plan = pricing[planType];
    if (!plan) {
      console.warn(`[PAYMENT] Unknown planType '${planType}', falling back to 'starter'`);
      return pricing.starter;
    }
    return plan;
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(merchantOrderId) {
    try {
      return await this.gateway.checkStatus(merchantOrderId);
    } catch (error) {
      console.error('[PAYMENT ERROR] Check status failed', {
        error: error.message, merchantOrderId
      });
      throw error;
    }
  }
}

module.exports = new PaymentService();
