/**
 * CustomerService.js
 * Unified customer loyalty logic (Sprint 2 Refactor)
 * 
 * Previously duplicated in createOrder() and payOrder() with
 * DIFFERENT behavior (createOrder had tier multiplier, payOrder didn't).
 * Now unified: both call the same function with identical logic.
 */
const Customer = require('../models/Customer');
const Settings = require('../models/Settings');

/**
 * Find or create a customer based on order data.
 * @param {Object} order - Order document with customerPhone, customerName, customerId
 * @returns {Customer|null} - Customer document or null if no customer info
 */
async function findOrCreateCustomer(order) {
    const hasPhone = order.customerPhone || order.phone;
    const hasName = order.customerName && order.customerName !== 'Pelanggan Baru';

    if (!hasPhone && !hasName) return null;

    const phone = order.customerPhone || order.phone;
    let customer = null;
    const query = [];

    if (order.customerId && order.customerId !== 'guest') {
        query.push({ id: order.customerId });
    }
    if (phone && phone.length > 5) {
        query.push({ phone: phone });
    }
    if ((!phone || phone.length < 6) && order.customerName) {
        query.push({ name: new RegExp('^' + order.customerName.trim() + '$', 'i') });
    }

    if (query.length > 0) {
        customer = await Customer.findOne({ $or: query });
    }

    if (!customer) {
        console.log('✨ Creating New Customer');
        customer = new Customer({
            id: `cust_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: order.customerName || 'Pelanggan Baru',
            phone: phone || null,
            tier: 'regular',
            points: 0,
            totalSpent: 0,
            visitCount: 0,
            createdAt: new Date()
        });
    } else {
        console.log('✅ Customer Found:', customer.name);
    }

    return customer;
}

/**
 * Award loyalty points to a customer based on order total.
 * Uses tier multiplier: bronze 1x, silver 1.25x, gold 1.5x
 * Uses atomic $inc for existing customers to prevent race conditions.
 * 
 * @param {Customer} customer - Mongoose customer document
 * @param {Number} orderTotal - Total amount of the order
 * @param {Object} [syncFields] - Optional fields to sync (name, phone)
 * @returns {Object} - { pointsEarned, tier, multiplier }
 */
async function awardLoyaltyPoints(customer, orderTotal, syncFields = {}) {
    const settings = await Settings.findOne({ key: 'businessSettings' });

    const thresholds = settings?.loyaltySettings?.tierThresholds || { silver: 500000, gold: 2000000 };
    const ratio = settings?.loyaltySettings?.pointRatio || 10000;

    // Determine tier based on totalSpent BEFORE this order
    let currentTier = 'bronze';
    if (customer.totalSpent >= thresholds.gold) currentTier = 'gold';
    else if (customer.totalSpent >= thresholds.silver) currentTier = 'silver';

    // Determine multiplier
    let multiplier = 1;
    if (currentTier === 'gold') multiplier = 1.5;
    else if (currentTier === 'silver') multiplier = 1.25;

    const basePoints = Math.floor(orderTotal / ratio);
    const pointsEarned = Math.floor(basePoints * multiplier);

    console.log(`📊 Tier: ${currentTier}, Multiplier: ${multiplier}x`);

    const setUpdates = {
        lastOrderDate: new Date(),
        tier: currentTier,
        ...syncFields
    };
    if (pointsEarned > 0) setUpdates.lastPointsEarned = new Date();

    if (customer.isNew) {
        // New customer: set values directly before first save
        customer.totalSpent = orderTotal;
        customer.visitCount = 1;
        customer.points = pointsEarned;
        Object.assign(customer, setUpdates);
        await customer.save();
    } else {
        // Existing customer: atomic $inc to prevent race conditions
        await Customer.updateOne(
            { _id: customer._id },
            {
                $inc: {
                    totalSpent: orderTotal,
                    visitCount: 1,
                    points: pointsEarned
                },
                $set: setUpdates
            }
        );
    }

    console.log(`💎 Awarded ${pointsEarned} points (${basePoints} base × ${multiplier}x)`);
    return { pointsEarned, tier: currentTier, multiplier };
}

/**
 * Sync customer fields without awarding points.
 * Used when order is not yet paid/done.
 * 
 * @param {Customer} customer - Mongoose customer document
 * @param {Object} syncFields - Fields to sync (name, phone)
 */
async function syncCustomerFields(customer, syncFields = {}) {
    if (Object.keys(syncFields).length === 0) return;

    if (customer.isNew) {
        Object.assign(customer, syncFields);
        await customer.save();
    } else {
        await Customer.updateOne(
            { _id: customer._id },
            { $set: syncFields }
        );
    }
}

module.exports = {
    findOrCreateCustomer,
    awardLoyaltyPoints,
    syncCustomerFields
};
