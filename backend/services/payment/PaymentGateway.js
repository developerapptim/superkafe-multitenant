/**
 * Payment Gateway Interface
 * Abstract layer untuk semua payment provider
 * Menggunakan Adapter Pattern untuk mudah switch provider
 */

class PaymentGateway {
  constructor(provider) {
    if (!provider) {
      throw new Error('Payment provider is required');
    }
    this.provider = provider;
  }

  /**
   * Create payment invoice/transaction
   * @param {Object} params - Payment parameters
   * @returns {Promise<Object>} Payment response with URL
   */
  async createInvoice(params) {
    return await this.provider.createInvoice(params);
  }

  /**
   * Verify callback/webhook from payment gateway
   * @param {Object} data - Callback data
   * @returns {Promise<Object>} Verification result
   */
  async verifyCallback(data) {
    return await this.provider.verifyCallback(data);
  }

  /**
   * Check payment status
   * @param {String} orderId - Order/Transaction ID
   * @returns {Promise<Object>} Payment status
   */
  async checkStatus(orderId) {
    return await this.provider.checkStatus(orderId);
  }

  /**
   * Get provider name
   * @returns {String} Provider name
   */
  getProviderName() {
    return this.provider.name || 'Unknown';
  }
}

module.exports = PaymentGateway;
