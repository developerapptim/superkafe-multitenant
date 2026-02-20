const PaymentService = require('../services/payment/PaymentService');

/**
 * Payment Controller
 * Handle payment-related requests
 * Mengikuti AI_RULES.md: Error handling, logging, defensive programming
 */

/**
 * POST /api/payments/create-invoice
 * Create payment invoice untuk subscription
 */
const createInvoice = async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      tenantSlug,
      planType,
      email,
      customerName,
      phoneNumber
    } = req.body;

    // Validasi input
    if (!tenantSlug) {
      return res.status(400).json({
        success: false,
        error: 'Tenant slug wajib diisi'
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email wajib diisi'
      });
    }

    console.log('[PAYMENT] Creating invoice', {
      tenantSlug,
      planType: planType || 'monthly',
      email
    });

    // Create payment via service
    const result = await PaymentService.createSubscriptionPayment({
      tenantSlug,
      planType: planType || 'monthly',
      email,
      customerName,
      phoneNumber
    });

    console.log('[PAYMENT] Invoice created successfully', {
      tenantSlug,
      merchantOrderId: result.merchantOrderId,
      amount: result.amount,
      duration: `${Date.now() - startTime}ms`
    });

    res.json({
      success: true,
      message: 'Invoice berhasil dibuat',
      data: {
        paymentUrl: result.paymentUrl,
        reference: result.reference,
        merchantOrderId: result.merchantOrderId,
        amount: result.amount,
        planType: result.planType,
        expiresAt: result.expiresAt
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('[PAYMENT ERROR] Create invoice failed', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      duration: `${duration}ms`
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Gagal membuat invoice pembayaran'
    });
  }
};

/**
 * POST /api/payments/callback
 * Handle callback dari payment gateway
 */
const handleCallback = async (req, res) => {
  const startTime = Date.now();

  try {
    console.log('[PAYMENT] Received callback', {
      merchantOrderId: req.body.merchantOrderId,
      resultCode: req.body.resultCode
    });

    // Process callback via service
    const result = await PaymentService.processCallback(req.body);

    console.log('[PAYMENT] Callback processed', {
      merchantOrderId: req.body.merchantOrderId,
      paymentSuccess: result.paymentSuccess,
      duration: `${Date.now() - startTime}ms`
    });

    // Duitku expects specific response format
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('[PAYMENT ERROR] Callback processing failed', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      duration: `${duration}ms`
    });

    // Still return 200 to prevent Duitku retry
    res.json({
      success: false,
      message: error.message || 'Callback processing failed'
    });
  }
};

/**
 * GET /api/payments/status/:merchantOrderId
 * Check payment status
 */
const checkStatus = async (req, res) => {
  try {
    const { merchantOrderId } = req.params;

    if (!merchantOrderId) {
      return res.status(400).json({
        success: false,
        error: 'Merchant order ID wajib diisi'
      });
    }

    console.log('[PAYMENT] Checking status', {
      merchantOrderId
    });

    const result = await PaymentService.checkPaymentStatus(merchantOrderId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[PAYMENT ERROR] Check status failed', {
      error: error.message,
      merchantOrderId: req.params.merchantOrderId
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Gagal mengecek status pembayaran'
    });
  }
};

/**
 * GET /api/payments/pricing
 * Get pricing plans
 */
const getPricing = async (req, res) => {
  try {
    const pricing = {
      monthly: PaymentService.getPricing('monthly'),
      quarterly: PaymentService.getPricing('quarterly'),
      yearly: PaymentService.getPricing('yearly')
    };

    res.json({
      success: true,
      data: pricing
    });
  } catch (error) {
    console.error('[PAYMENT ERROR] Get pricing failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Gagal mengambil informasi harga'
    });
  }
};

module.exports = {
  createInvoice,
  handleCallback,
  checkStatus,
  getPricing
};
