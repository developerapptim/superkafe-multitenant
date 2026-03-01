const crypto = require('crypto');
const axios = require('axios');

/**
 * Duitku Payment Provider
 * Implementasi spesifik untuk Duitku Payment Gateway
 * Sandbox & Production ready
 */

class DuitkuProvider {
  constructor(config) {
    this.name = 'Duitku';
    this.merchantCode = config.merchantCode;
    this.apiKey = config.apiKey;
    this.mode = config.mode || 'sandbox'; // sandbox or production

    // Set base URL berdasarkan mode.
    // Duitku Passport API (Hosted Payment Page)
    this.baseURL = this.mode === 'production'
      ? 'https://api-prod.duitku.com/api/merchant'
      : 'https://api-sandbox.duitku.com/api/merchant';

    console.log(`[DUITKU] Initialized in ${this.mode} mode. BaseURL: ${this.baseURL}`);
  }

  /**
   * Generate MD5 signature untuk Duitku Inquiry
   * Format: MD5(merchantCode + merchantOrderId + amount + apiKey)
   */
  generateSignature(merchantOrderId, amount) {
    const stringToHash = `${this.merchantCode}${merchantOrderId}${amount}${this.apiKey}`;
    console.log('[DUITKU DEBUG] String to Hash (Inquiry):', stringToHash);

    return crypto.createHash('md5').update(stringToHash).digest('hex');
  }

  /**
   * Verify callback signature dari Duitku
   * Format: MD5(merchantCode + amount + merchantOrderId + apiKey)
   */
  verifyCallbackSignature(merchantOrderId, amount, signature) {
    const expectedSignature = crypto
      .createHash('md5')
      .update(`${this.merchantCode}${amount}${merchantOrderId}${this.apiKey}`)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Create payment invoice (Passport API / Hosted Payment Page)
   * @param {Object} params - Payment parameters
   * @returns {Promise<Object>} Payment response
   */
  async createInvoice(params) {
    try {
      const {
        merchantOrderId,
        amount,
        productDetails,
        email,
        customerName,
        phoneNumber,
        callbackUrl,
        returnUrl,
        expiryPeriod = 60 // minutes
      } = params;

      // Passport API Header Signature: SHA256(merchantCode + timestamp + apiKey)
      const timestamp = new Date().getTime();
      const stringToHash = `${this.merchantCode}${timestamp}${this.apiKey}`;
      const signature = crypto.createHash('sha256').update(stringToHash).digest('hex');

      // Nama depan dan nama belakang untuk form Duitku (dipisah secara sederhana)
      let firstName = customerName;
      let lastName = '';
      if (customerName && customerName.includes(' ')) {
        const parts = customerName.split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }

      // Prepare request payload for Passport API
      const payload = {
        paymentAmount: amount,
        merchantOrderId: merchantOrderId,
        productDetails: productDetails,
        email: email,
        additionalParam: '',
        merchantUserInfo: '',
        customerVaName: customerName,
        phoneNumber: phoneNumber,
        itemDetails: [
          {
            name: productDetails,
            price: amount,
            quantity: 1
          }
        ],
        customerDetail: {
          firstName: firstName,
          lastName: lastName,
          email: email,
          phoneNumber: phoneNumber
        },
        callbackUrl: callbackUrl,
        returnUrl: returnUrl,
        expiryPeriod: expiryPeriod
      };

      console.log('[DUITKU] Creating Generic Payment Link via Passport API');

      const endpoint = `${this.baseURL}/createInvoice`;
      console.log('[DUITKU] Endpoint:', endpoint);

      // Call Duitku Passport API
      const response = await axios({
        method: 'POST',
        url: endpoint,
        data: payload,
        headers: {
          "Accept": "application/json",
          "Content-type": "application/json; charset=UTF-8",
          "x-duitku-signature": signature,
          "x-duitku-timestamp": `${timestamp}`,
          "x-duitku-merchantcode": `${this.merchantCode}`
        }
      });

      if (response.data.statusCode === '00') {
        console.log('[DUITKU] Payment link created successfully', {
          merchantOrderId,
          reference: response.data.reference
        });

        return {
          success: true,
          paymentUrl: response.data.paymentUrl,
          reference: response.data.reference,
          amount: amount,
          statusCode: response.data.statusCode,
          statusMessage: response.data.statusMessage
        };
      } else {
        console.error('[DUITKU] Invoice creation failed', {
          statusCode: response.data.statusCode,
          statusMessage: response.data.statusMessage
        });

        return {
          success: false,
          error: response.data.statusMessage || 'Failed to create payment link'
        };
      }
    } catch (error) {
      console.error('[DUITKU ERROR] Create invoice failed', {
        error: error.message,
        response: error.response?.data
      });

      throw new Error(`Duitku API Error: ${error.message}`);
    }
  }

  /**
   * Verify callback from Duitku
   * @param {Object} data - Callback data
   * @returns {Promise<Object>} Verification result
   */
  async verifyCallback(data) {
    try {
      const {
        merchantOrderId,
        amount,
        signature,
        resultCode,
        merchantCode
      } = data;

      console.log('[DUITKU] Verifying callback', {
        merchantOrderId,
        amount,
        resultCode
      });

      // Verify merchant code
      if (merchantCode !== this.merchantCode) {
        console.error('[DUITKU] Invalid merchant code', {
          expected: this.merchantCode,
          received: merchantCode
        });

        return {
          success: false,
          error: 'Invalid merchant code'
        };
      }

      // Verify signature
      const isValidSignature = this.verifyCallbackSignature(
        merchantOrderId,
        amount,
        signature
      );

      if (!isValidSignature) {
        console.error('[DUITKU] Invalid signature', {
          merchantOrderId,
          receivedSignature: signature
        });

        return {
          success: false,
          error: 'Invalid signature'
        };
      }

      // Check result code
      // 00 = Success
      const isSuccess = resultCode === '00';

      console.log('[DUITKU] Callback verified', {
        merchantOrderId,
        isSuccess,
        resultCode
      });

      return {
        success: true,
        isPaymentSuccess: isSuccess,
        merchantOrderId,
        amount,
        resultCode
      };
    } catch (error) {
      console.error('[DUITKU ERROR] Verify callback failed', {
        error: error.message
      });

      throw new Error(`Callback verification error: ${error.message}`);
    }
  }

  /**
   * Check payment status
   * @param {String} merchantOrderId - Order ID
   * @returns {Promise<Object>} Payment status
   */
  async checkStatus(merchantOrderId) {
    try {
      const signature = this.generateSignature(merchantOrderId, 0);

      const payload = {
        merchantCode: this.merchantCode,
        merchantOrderId: merchantOrderId,
        signature: signature
      };

      console.log('[DUITKU] Checking payment status', {
        merchantOrderId
      });

      const response = await axios.post(
        `${this.baseURL}/transactionStatus`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('[DUITKU] Status check result', {
        merchantOrderId,
        statusCode: response.data.statusCode
      });

      return {
        success: true,
        statusCode: response.data.statusCode,
        statusMessage: response.data.statusMessage,
        amount: response.data.amount,
        reference: response.data.reference
      };
    } catch (error) {
      console.error('[DUITKU ERROR] Check status failed', {
        error: error.message,
        response: error.response?.data
      });

      throw new Error(`Status check error: ${error.message}`);
    }
  }


}

module.exports = DuitkuProvider;
