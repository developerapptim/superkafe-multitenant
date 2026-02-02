/**
 * Analytics Controller
 * Handles report data aggregation for Laporan & Analitik page
 */
const mongoose = require('mongoose');

const Order = require('../models/Order');

// Removed dependency injection
const setOrderModel = (orderModel) => { };


/**
 * GET /api/analytics/report
 * Returns aggregated report data for the specified period
 */
const getReportData = async (req, res) => {
    try {
        const { period = 'daily', timezone = '+08:00' } = req.query;

        // 1. Determine Date Range
        const now = new Date();
        let startDate = new Date();
        let prevStartDate = new Date();
        let prevEndDate = new Date();

        if (period === 'daily') {
            startDate.setHours(0, 0, 0, 0);
            prevStartDate.setDate(startDate.getDate() - 1);
            prevStartDate.setHours(0, 0, 0, 0);
            prevEndDate.setDate(startDate.getDate() - 1);
            prevEndDate.setHours(23, 59, 59, 999);
        } else if (period === 'weekly') {
            const day = now.getDay() || 7;
            startDate.setHours(0, 0, 0, 0);
            startDate.setDate(now.getDate() - day + 1); // Monday
            prevStartDate = new Date(startDate);
            prevStartDate.setDate(startDate.getDate() - 7);
            prevEndDate = new Date(startDate);
            prevEndDate.setDate(startDate.getDate() - 1);
        } else if (period === 'monthly') {
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            prevStartDate = new Date(startDate);
            prevStartDate.setMonth(startDate.getMonth() - 1);
            prevEndDate = new Date(startDate);
            prevEndDate.setDate(0); // Last day of prev month
        } else if (period === 'yearly') {
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);
            prevStartDate = new Date(startDate);
            prevStartDate.setFullYear(startDate.getFullYear() - 1);
            prevEndDate = new Date(startDate);
            prevEndDate.setDate(0);
        }

        // 2. Fetch Current Period Data (use timestamp field)
        const currentOrders = await Order.find({
            status: 'done',
            timestamp: { $gte: startDate.getTime() }
        }).lean();

        // 3. Fetch Previous Period Data (For Growth Rate)
        const prevOrders = await Order.find({
            status: 'done',
            timestamp: { $gte: prevStartDate.getTime(), $lte: prevEndDate.getTime() }
        }).lean();

        // 4. Calculate Basic Stats
        const totalRevenue = currentOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        const prevRevenue = prevOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        const growthRate = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

        const totalOrders = currentOrders.length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // 5. Payment Stats
        let cashCount = 0;
        let nonCashCount = 0;
        currentOrders.forEach(o => {
            const method = (o.paymentMethod || 'cash').toLowerCase();
            if (method === 'cash') cashCount++;
            else nonCashCount++;
        });
        const totalPayments = cashCount + nonCashCount;
        const paymentStats = {
            cashCount,
            nonCashCount,
            cashPercent: totalPayments > 0 ? Math.round((cashCount / totalPayments) * 100) : 0,
            nonCashPercent: totalPayments > 0 ? 100 - Math.round((cashCount / totalPayments) * 100) : 0
        };

        // 6. Menu Analysis (Top & Bottom)
        const menuCount = {};
        currentOrders.forEach(o => {
            (o.items || []).forEach(item => {
                const name = item.name || item.menuName || 'Unknown';
                menuCount[name] = (menuCount[name] || 0) + (item.qty || item.quantity || 1);
            });
        });

        let sortedMenu = Object.entries(menuCount)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count); // Descending

        const topMenu = sortedMenu.slice(0, 5);
        const topNames = new Set(topMenu.map(m => m.name));

        // Bottom menu excludes Top 5
        const bottomCandidates = sortedMenu.filter(m => !topNames.has(m.name));
        const bottomMenu = bottomCandidates.sort((a, b) => a.count - b.count).slice(0, 5);

        // 7. Peak Hours (Timezone Adjusted)
        const hourCount = new Array(24).fill(0);
        const tzOffset = parseInt(timezone) || 7;

        currentOrders.forEach(o => {
            const date = new Date(o.timestamp);
            let hour = date.getUTCHours() + tzOffset;
            if (hour >= 24) hour -= 24;
            if (hour < 0) hour += 24;
            hourCount[hour]++;
        });

        const peakHours = [];
        for (let h = 8; h <= 22; h++) {
            peakHours.push({ hour: h, count: hourCount[h] });
        }

        // 8. Customer Retention Analysis (New vs Returning)
        const currentPhones = new Set();
        currentOrders.forEach(o => {
            const phone = o.customerPhone || o.customer_phone;
            if (phone && phone.length >= 8) currentPhones.add(phone);
        });

        // Find historical orders (before this period) to check if customer is returning
        const historicalOrders = await Order.find({
            status: 'done',
            timestamp: { $lt: startDate.getTime() }
        }).lean();

        const historicalPhones = new Set();
        historicalOrders.forEach(o => {
            const phone = o.customerPhone || o.customer_phone;
            if (phone && phone.length >= 8) historicalPhones.add(phone);
        });

        let newCustomers = 0;
        let returningCustomers = 0;
        currentPhones.forEach(phone => {
            if (historicalPhones.has(phone)) {
                returningCustomers++;
            } else {
                newCustomers++;
            }
        });

        const retention = {
            new: newCustomers,
            returning: returningCustomers
        };

        // 9. Market Basket Analysis (Menu Pairing)
        const combinationCount = {};
        currentOrders.forEach(o => {
            const items = o.items || [];
            if (items.length > 1) {
                // Get unique item names from this order
                const itemNames = [...new Set(items.map(i => i.name || i.menuName || 'Unknown'))];
                // Sort to ensure consistent combination keys
                itemNames.sort();
                // Generate pairs (2-item combinations)
                for (let i = 0; i < itemNames.length; i++) {
                    for (let j = i + 1; j < itemNames.length; j++) {
                        const combo = `${itemNames[i]} + ${itemNames[j]}`;
                        combinationCount[combo] = (combinationCount[combo] || 0) + 1;
                    }
                }
            }
        });

        const topCombinations = Object.entries(combinationCount)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        res.json({
            stats: {
                revenue: totalRevenue,
                orders: totalOrders,
                avgOrderValue,
                growthRate,
                prevRevenue
            },
            paymentStats,
            topMenu,
            bottomMenu,
            peakHours,
            retention,
            topCombinations
        });

    } catch (err) {
        console.error('Analytics Report Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    setOrderModel,
    getReportData
};
