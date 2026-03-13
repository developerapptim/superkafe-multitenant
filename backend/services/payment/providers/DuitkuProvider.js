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
    if (process.env.DUITKU_URL && this.mode === 'production') {
      this.baseURL = process.env.DUITKU_URL.replace('/v2/inquiry', '');
    } else {
      this.baseURL = this.mode === 'production'
        ? 'https://passport.duitku.com/webapi/api/merchant'
        : 'https://api-sandbox.duitku.com/api/merchant';
    }

    console.log(`[DUITKU] Initialized in ${this.mode} mode. BaseURL: ${this.baseURL}`);
  }

  /**
   * Generate MD5 signature untuk Duitku Inquiry
   * Format: MD5(merchantCode + merchantOrderId + amount + apiKey)
   */
  generateSignature(merchantOrderId, amount) {
    const sanitizedAmount = Math.round(Number(amount));
    const stringToHash = `${this.merchantCode}${merchantOrderId}${sanitizedAmount}${this.apiKey}`;
    console.log('[DUITKU DEBUG] String to Hash (Inquiry):', stringToHash);

    return crypto.createHash('md5').update(stringToHash).digest('hex');
  }

  /**
   * Verify callback signature dari Duitku
   * Format: MD5(merchantCode + amount + merchantOrderId + apiKey)
   */
  verifyCallbackSignature(merchantOrderId, amount, signature) {
    const sanitizedAmount = Math.round(Number(amount));
    const expectedSignature = crypto
      .createHash('md5')
      .update(`${this.merchantCode}${sanitizedAmount}${merchantOrderId}${this.apiKey}`)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Create payment invoice (Passport API / Hosted Payment Page)
   * V2 Inquiry API Implementation
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

      // Ensure amount is integer
      const paymentAmount = Math.round(Number(amount));

      // Nama depan dan nama belakang untuk form Duitku (dipisah secara sederhana)
      let firstName = customerName;
      let lastName = '';
      if (customerName && customerName.includes(' ')) {
        const parts = customerName.split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }

      // V2 Signature: MD5(merchantCode + merchantOrderId + paymentAmount + apiKey)
      const stringToHash = `${this.merchantCode}${merchantOrderId}${paymentAmount}${this.apiKey}`;
      const signature = crypto.createHash('md5').update(stringToHash).digest('hex');

      console.log('[DUITKU DEBUG] String to hash (V2 Inquiry):', stringToHash);

      // Prepare request payload for Passport V2 API
      const payload = {
        merchantCode: this.merchantCode,
        paymentAmount: paymentAmount,
        paymentMethod: "", // Will be selected in Duitku UI if empty or use default VC
        merchantOrderId: merchantOrderId,
        productDetails: productDetails,
        additionalParam: "",
        merchantUserInfo: "",
        customerVaName: customerName,
        email: email,
        phoneNumber: phoneNumber || "",
        itemDetails: [
          {
            name: productDetails,
            price: paymentAmount,
            quantity: 1
          }
        ],
        customerDetail: {
          firstName: firstName,
          lastName: lastName,
          email: email,
          phoneNumber: phoneNumber || "",
          billingAddress: {
             firstName: firstName,
             lastName: lastName,
             address: "",
             city: "",
             postalCode: "",
             phone: phoneNumber || "",
             countryCode: "ID"
          },
          shippingAddress: {
             firstName: firstName,
             lastName: lastName,
             address: "",
             city: "",
             postalCode: "",
             phone: phoneNumber || "",
             countryCode: "ID"
          }
        },
        callbackUrl: callbackUrl,
        returnUrl: returnUrl,
        signature: signature,
        expiryPeriod: expiryPeriod
      };

      console.log('[DUITKU] Creating Generic Payment Link via Passport V2 API');
      console.log('[DUITKU] Request Payload:', JSON.stringify(payload, null, 2));

      // Production uses Passport v2 (/v2/inquiry), Sandbox usually same
      const invoicePath = '/v2/inquiry';
      const endpoint = `${this.baseURL}${invoicePath}`;
      console.log('[DUITKU] Endpoint:', endpoint);

      // Call Duitku Passport API
      const response = await axios({
        method: 'POST',
        url: endpoint,
        data: payload,
        headers: {
          "Accept": "application/json",
          "Content-type": "application/json"
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
          amount: paymentAmount,
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
      let specificError = error.message;
      if (error.response && error.response.data && error.response.data.Message) {
         specificError = `Duitku Rejected: ${error.response.data.Message}`;
      } else if (error.response && error.response.data && error.response.data.statusMessage) {
         specificError = error.response.data.statusMessage;
      }

      console.error('[DUITKU ERROR] Create invoice failed', {
        error: specificError,
        response: error.response?.data
      });

      throw new Error(specificError);
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
