/**
 * WhatsAppNotificationService.js
 * Unified service for sending WhatsApp notifications via n8n webhook.
 * 
 * The n8n workflow uses a Switch node that routes based on the `status` field:
 *   - "proses"  → Pesanan Diproses flow
 *   - "selesai" → Pesanan Selesai flow
 * 
 * All calls are fire-and-forget (non-blocking) to keep the POS responsive.
 */
const axios = require('axios');

// Single webhook URL for the unified n8n workflow
const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://76.13.196.116:5677/webhook/ce3ade2e-9516-43ed-9ca8-2913407877d1';

// Backend URL for generating public nota links
const BACKEND_URL = process.env.BACKEND_URL || 'https://api.superkafe.com';

/**
 * Format phone number to international format without '+' prefix.
 * Examples:
 *   "0812-3456-7890" → "6281234567890"
 *   "+62812345"      → "62812345"
 *   "62812345"       → "62812345" (already correct)
 *   ""               → null
 * 
 * @param {string} phone - Raw phone number
 * @returns {string|null} Formatted phone number or null if invalid
 */
function formatPhoneNumber(phone) {
    if (!phone) return null;

    // Strip all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // Remove leading '+' artifact (in case replace missed it)
    digits = digits.replace(/^\+/, '');

    // Convert local format (0xxx) to international (62xxx)
    if (digits.startsWith('0')) {
        digits = '62' + digits.substring(1);
    }

    // Validate minimum length (62 + at least 8 digits = 10)
    if (digits.length < 10) {
        return null;
    }

    return digits;
}

/**
 * Generate the public nota link for an order.
 * 
 * @param {string} orderId - The order ID
 * @returns {string} Public URL to the nota page
 */
function generateNotaLink(orderId) {
    return `${BACKEND_URL}/api/orders/nota/${orderId}`;
}

/**
 * Send a WhatsApp notification via n8n webhook.
 * 
 * This is a fire-and-forget call — it does NOT block the main request.
 * Errors are logged but never thrown to the caller.
 * 
 * @param {Object} order - The order document (Mongoose)
 * @param {'proses'|'selesai'} status - Status for n8n Switch routing
 */
function sendNotification(order, status) {
    try {
        // Extract phone from order (field could be `phone` or `customerPhone`)
        const rawPhone = order.phone || order.customerPhone;
        const phone = formatPhoneNumber(rawPhone);

        // Guard: skip if no valid phone number
        if (!phone) {
            console.log(`ℹ️ [WA] Skipped — no valid phone for Order ${order.id}`);
            return;
        }

        const payload = {
            phone,
            name: order.customerName || 'Pelanggan',
            link_nota: generateNotaLink(order.id),
            status  // "proses" or "selesai" — drives the n8n Switch node
        };

        // Fire-and-forget POST with 5s timeout to prevent hanging
        axios.post(WEBHOOK_URL, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        }).then(() => {
            console.log(`📡 [WA] Notification sent (${status}) for Order ${order.id} → ${phone}`);
        }).catch(err => {
            console.error(`⚠️ [WA] Webhook error (${status}) for Order ${order.id}:`, err.message);
        });

    } catch (err) {
        // Outer catch — should never happen, but just in case
        console.error('⚠️ [WA] Unexpected error in sendNotification:', err.message);
    }
}

module.exports = {
    formatPhoneNumber,
    generateNotaLink,
    sendNotification
};
