const Tenant = require('../models/Tenant');
const { invalidateTenantCache } = require('./tenantResolver');

/**
 * Middleware to check if the tenant's subscription is active
 * Blocks order creation if expired.
 */
const checkSubscription = async (req, res, next) => {
    try {
        if (!req.tenant || !req.tenant.id) {
            return res.status(500).json({ error: 'Tenant context missing in subscription guard' });
        }

        const tenant = await Tenant.findById(req.tenant.id);

        if (tenant) {
            // Check if status needs to be auto-transitioned
            const changed = tenant.refreshSubscriptionStatus();

            if (changed) {
                await tenant.save();
                // Invalidate cache so tenantResolver gets fresh status next time
                invalidateTenantCache(tenant.slug);
            }

            // If expired or suspended, block action
            if (tenant.status === 'expired' || tenant.status === 'suspended') {
                return res.status(403).json({
                    success: false,
                    error: 'Langganan Berakhir',
                    message: `Masa berlangganan (atau trial) untuk tenant ${tenant.name} telah berakhir. Harap perpanjang untuk dapat membuat pesanan.`
                });
            }
        }

        next();
    } catch (err) {
        console.error('Subscription Guard Error:', err);
        return res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa status langganan' });
    }
};

module.exports = { checkSubscription };
