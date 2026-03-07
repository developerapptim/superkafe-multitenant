/**
 * ShiftService.js
 * Unified shift operations (Sprint 2 Refactor)
 * 
 * Previously duplicated in createOrder(), payOrder(), and FinanceController.
 * All operations use atomic $inc/$push to prevent race conditions.
 */
const Shift = require('../models/Shift');

/**
 * Record a sale in the active shift (atomic).
 * @param {String} orderId - Order ID to push to shift.orders
 * @param {Number} total - Sale total
 * @param {String} paymentMethod - 'cash' or other
 * @returns {String|null} - Active shift ID or null if no active shift
 */
async function recordSale(orderId, total, paymentMethod) {
    const activeShift = await Shift.findOne({ endTime: null });
    if (!activeShift) {
        console.log('⚠️ No Active Shift Found');
        return null;
    }

    const incUpdate = paymentMethod === 'cash'
        ? { cashSales: total, currentCash: total }
        : { nonCashSales: total, currentNonCash: total };

    await Shift.updateOne(
        { _id: activeShift._id },
        {
            $inc: incUpdate,
            $push: { orders: orderId }
        }
    );

    console.log(`✅ Shift Updated (Atomic) — ${paymentMethod}: +${total}`);
    return activeShift.id;
}

/**
 * Adjust the shift balance (for cash transactions, expenses, etc.)
 * @param {Number} amount - Amount to adjust (positive = add, negative = subtract)
 * @param {String} description - Description for the adjustment
 * @returns {Boolean} - Whether an active shift was found and updated
 */
async function adjustBalance(amount, description) {
    const activeShift = await Shift.findOne({ endTime: null });
    if (!activeShift) return false;

    await Shift.updateOne(
        { _id: activeShift._id },
        {
            $inc: { currentCash: amount },
            $push: {
                adjustments: {
                    amount,
                    description,
                    timestamp: new Date()
                }
            }
        }
    );

    return true;
}

module.exports = {
    recordSale,
    adjustBalance
};
