const cron = require('node-cron');
const axios = require('axios');
const Tenant = require('../models/Tenant');

// Webhook endpoint for n8n to send WhatsApp / Email
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_SUBSCRIPTION_REMINDER || 'http://76.13.196.116:5677/webhook/subscription-reminder';

const checkAndNotifySubscriptions = async () => {
    console.log('[CRON] Mulai pengecekan status rentang waktu langganan Tenant...');
    try {
        const tenants = await Tenant.find({ isActive: true });
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Normalize to start of today

        for (const tenant of tenants) {
            // Ensure status is up to date first
            const changed = tenant.refreshSubscriptionStatus();
            if (changed) {
                await tenant.save();
            }

            // We want to check for 'active' or 'trial' tenants approaching expiration
            let targetDate = null;
            let type = '';

            if (tenant.status === 'trial') {
                targetDate = tenant.trialExpiresAt;
                type = 'Trial';
            } else if (tenant.status === 'active' && tenant.subscriptionExpiresAt) {
                targetDate = tenant.subscriptionExpiresAt;
                type = 'Berbayar';
            }

            if (!targetDate) continue; // Skip if no expiration date

            const expireDate = new Date(targetDate);
            expireDate.setHours(0, 0, 0, 0);

            // Calculate difference in days
            const diffTime = expireDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Notify if H-3, H-1, or H-0 (Expired today)
            if (diffDays === 3 || diffDays === 1 || diffDays === 0) {
                console.log(`[CRON] Notifikasi ${type} H-${diffDays} untuk tenant: ${tenant.name}`);

                const payload = {
                    tenantName: tenant.name,
                    tenantSlug: tenant.slug,
                    statusTarget: type,
                    daysRemaining: diffDays,
                    expirationDate: targetDate.toISOString(),
                };

                try {
                    // Fire and forget to n8n webhook
                    axios.post(N8N_WEBHOOK_URL, payload).catch(err => {
                        console.error('[CRON] Gagal kirim webhook notifikasi:', err.message);
                    });
                } catch (webhookErr) {
                    console.error('[CRON] Kesalahan webhook:', webhookErr.message);
                }
            }
        }

        console.log('[CRON] Selesai pengecekan status langganan.');
    } catch (error) {
        console.error('[CRON] Gagal memeriksa langganan:', error);
    }
};

const initSubscriptionCron = () => {
    // Jalankan setiap jam 00:00 (tengah malam)
    cron.schedule('0 0 * * *', () => {
        checkAndNotifySubscriptions();
    });

    console.log('[CRON] Subscription Notifier job dijadwalkan (berjalan setiap tengah malam).');
};

module.exports = { initSubscriptionCron, checkAndNotifySubscriptions };
