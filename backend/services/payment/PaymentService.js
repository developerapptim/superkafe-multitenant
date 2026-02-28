const PaymentGateway = require('./PaymentGateway');
const DuitkuProvider = require('./providers/DuitkuProvider');
const Tenant = require('../../models/Tenant');

/**
 * Payment Service
 * Business logic layer untuk payment processing
 * Menggunakan PaymentGateway interface untuk abstraksi provider
 */

class PaymentService {
  constructor() {
    // Initialize payment gateway dengan provider
    const provider = this.initializeProvider();
    this.gateway = new PaymentGateway(provider);
  }

  /**
   * Initialize payment provider berdasarkan environment
   * Mudah untuk switch provider di sini
   */
  initializeProvider() {
    const providerName = process.env.PAYMENT_PROVIDER || 'duitku';

    switch (providerName.toLowerCase()) {
      case 'duitku':
        return new DuitkuProvider({
          merchantCode: process.env.DUITKU_MERCHANT_CODE,
          apiKey: process.env.DUITKU_API_KEY,
          mode: process.env.DUITKU_MODE || 'sandbox'
        });

      // Future providers bisa ditambahkan di sini
      // case 'midtrans':
      //   return new MidtransProvider({ ... });

      default:
        throw new Error(`Unsupported payment provider: ${providerName}`);
    }
  }

  /**
   * Create subscription payment untuk tenant
   * @param {Object} params - Payment parameters
   * @returns {Promise<Object>} Payment response
   */
  async createSubscriptionPayment(params) {
    try {
      const {
        tenantSlug,
        planType = 'starter', // starter, bisnis, lifetime
        email,
        customerName,
        phoneNumber
      } = params;

      // Cari tenant
      const tenant = await Tenant.findOne({ slug: tenantSlug }).lean();

      if (!tenant) {
        throw new Error('Tenant tidak ditemukan');
      }

      // PENTING: Harga selalu ditentukan dari server, JANGAN dari frontend
      const pricing = this.getPricing(planType);

      // Generate unique order ID
      const merchantOrderId = `SUB-${tenantSlug.toUpperCase()}-${Date.now()}`;

      // Ambil Callback URL dari environment (explicit, lebih reliable)
      const callbackUrl = process.env.DUITKU_CALLBACK_URL
        || `${process.env.BACKEND_URL || 'https://superkafe.com'}/api/payments/callback`;

      const returnUrl = `${process.env.FRONTEND_URL || 'https://superkafe.com'}/admin`;

      // Prepare payment parameters (tanpa paymentMethod = Hosted Payment Page)
      const paymentParams = {
        merchantOrderId,
        amount: pricing.amount,
        productDetails: pricing.description,
        email: email,
        customerName: customerName || tenant.name,
        phoneNumber: phoneNumber || '08123456789',
        callbackUrl: callbackUrl,
        returnUrl: returnUrl,
        expiryPeriod: 60 // 60 menit
      };

      console.log('[PAYMENT SERVICE] Creating subscription payment (Hosted Payment Page)', {
        tenantSlug,
        planType,
        amount: pricing.amount,
        merchantOrderId
      });

      // Create invoice via gateway
      const result = await this.gateway.createInvoice(paymentParams);

      if (result.success) {
        // Simpan transaction record (optional - bisa buat model Transaction)
        // await Transaction.create({ ... });

        return {
          success: true,
          paymentUrl: result.paymentUrl,
          reference: result.reference,
          merchantOrderId,
          amount: pricing.amount,
          planType,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 jam
        };
      } else {
        throw new Error(result.error || 'Failed to create payment');
      }
    } catch (error) {
      console.error('[PAYMENT SERVICE ERROR] Create subscription payment failed', {
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Process payment callback
   * @param {Object} callbackData - Callback data from payment gateway
   * @returns {Promise<Object>} Processing result
   */
  async processCallback(callbackData) {
    try {
      console.log('[PAYMENT SERVICE] Processing callback', {
        merchantOrderId: callbackData.merchantOrderId
      });

      // Verify callback via gateway
      const verification = await this.gateway.verifyCallback(callbackData);

      if (!verification.success) {
        throw new Error(verification.error || 'Callback verification failed');
      }

      if (!verification.isPaymentSuccess) {
        console.warn('[PAYMENT SERVICE] Payment not successful', {
          merchantOrderId: verification.merchantOrderId,
          resultCode: verification.resultCode
        });

        return {
          success: true,
          message: 'Payment not successful',
          paymentSuccess: false
        };
      }

      // Extract tenant slug from merchantOrderId
      // Format: SUB-TENANTSLUG-TIMESTAMP
      const parts = verification.merchantOrderId.split('-');
      if (parts.length < 3 || parts[0] !== 'SUB') {
        throw new Error('Invalid merchant order ID format');
      }

      const tenantSlug = parts[1].toLowerCase();

      // Update tenant status
      const result = await this.upgradeTenant(tenantSlug);

      console.log('[PAYMENT SERVICE] Callback processed successfully', {
        tenantSlug,
        merchantOrderId: verification.merchantOrderId
      });

      return {
        success: true,
        message: 'Payment processed successfully',
        paymentSuccess: true,
        tenantSlug,
        upgradedTo: result.status
      };
    } catch (error) {
      console.error('[PAYMENT SERVICE ERROR] Process callback failed', {
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Upgrade tenant to paid status
   * @param {String} tenantSlug - Tenant slug
   * @returns {Promise<Object>} Updated tenant
   */
  async upgradeTenant(tenantSlug) {
    try {
      const tenant = await Tenant.findOne({ slug: tenantSlug });

      if (!tenant) {
        throw new Error('Tenant tidak ditemukan');
      }

      // Set subscription expiry: 30 hari dari sekarang
      const subscriptionExpiresAt = new Date();
      subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + 30);

      // Update tenant
      tenant.status = 'paid';
      tenant.subscriptionExpiresAt = subscriptionExpiresAt;
      await tenant.save();

      console.log('[PAYMENT SERVICE] Tenant upgraded successfully', {
        tenantSlug,
        status: tenant.status,
        subscriptionExpiresAt
      });

      return {
        success: true,
        status: tenant.status,
        subscriptionExpiresAt
      };
    } catch (error) {
      console.error('[PAYMENT SERVICE ERROR] Upgrade tenant failed', {
        error: error.message,
        tenantSlug
      });

      throw error;
    }
  }

  /**
   * Get pricing berdasarkan plan type
   * @param {String} planType - Plan type (monthly, quarterly, yearly)
   * @returns {Object} Pricing info
   */
  getPricing(planType) {
    // SECURITY: Harga WAJIB ditentukan di server — jangan pernah percaya nilai dari frontend
    const pricing = {
      // === Paket Baru (Starter / Bisnis / Lifetime) ===
      starter: {
        amount: 225000,
        description: 'Paket Starter SuperKafe - 30 Hari',
        duration: 30
      },
      bisnis: {
        amount: 2000000,
        description: 'Paket Bisnis SuperKafe - 365 Hari (Hemat Rp 500.000)',
        duration: 365
      },
      lifetime: {
        amount: 7500000,
        description: 'Paket Lifetime SuperKafe - Tanpa Batas Waktu',
        duration: 36500 // ~100 tahun
      },
      // === Legacy plan names (backward compatibility) ===
      monthly: {
        amount: 225000,
        description: 'Paket Starter SuperKafe - 30 Hari',
        duration: 30
      },
      quarterly: {
        amount: 600000,
        description: 'Paket 3 Bulan SuperKafe - 90 Hari',
        duration: 90
      },
      yearly: {
        amount: 2000000,
        description: 'Paket Bisnis SuperKafe - 365 Hari',
        duration: 365
      }
    };

    const plan = pricing[planType];
    if (!plan) {
      console.warn(`[PAYMENT SERVICE] Unknown planType '${planType}', falling back to 'starter'`);
      return pricing.starter;
    }
    return plan;
  }

  /**
   * Check payment status
   * @param {String} merchantOrderId - Order ID
   * @returns {Promise<Object>} Payment status
   */
  async checkPaymentStatus(merchantOrderId) {
    try {
      const result = await this.gateway.checkStatus(merchantOrderId);
      return result;
    } catch (error) {
      console.error('[PAYMENT SERVICE ERROR] Check status failed', {
        error: error.message,
        merchantOrderId
      });

      throw error;
    }
  }
}

module.exports = new PaymentService();
