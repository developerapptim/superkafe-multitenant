/**
 * Analytics Controller
 * Handles report data aggregation for Laporan & Analitik page
 * Optimized using MongoDB Aggregation Pipelines
 */
const mongoose = require('mongoose');
const Order = require('../models/Order');

// --- Simple In-Memory Cache ---
const reportCache = new Map();
const CACHE_TTL = {
    daily: 60 * 1000,        // 1 minute (Real-time)
    weekly: 5 * 60 * 1000,   // 5 minutes
    monthly: 10 * 60 * 1000, // 10 minutes
    yearly: 30 * 60 * 1000   // 30 minutes
};

// Removed dependency injection
const setOrderModel = (orderModel) => { };

/**
 * GET /api/analytics/report
 * Returns aggregated report data for the specified period
 */
const getReportData = async (req, res) => {
    try {
        const { period = 'daily', timezone = '+07:00' } = req.query;
        const cacheKey = `analytics_${period}_${timezone}`;
        const now = Date.now();

        // Safety: Prevent memory leak
        if (reportCache.size > 100) {
            reportCache.clear();
            console.log('[Analytics] Cache cleared (Size Limit Reached)');
        }

        // 1. Check Cache
        if (reportCache.has(cacheKey)) {
            const cached = reportCache.get(cacheKey);
            if (now - cached.timestamp < CACHE_TTL[period]) {
                console.log(`[Analytics]Serving merged cache for ${period}`);
                return res.json(cached.data);
            }
        }

        // 2. Determine Date Range
        const dateNow = new Date();
        let startDate = new Date();
        let endDate = new Date();
        let prevStartDate = new Date();
        let prevEndDate = new Date();

        if (period === 'daily') {
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);

            prevStartDate.setDate(startDate.getDate() - 1);
            prevStartDate.setHours(0, 0, 0, 0);
            prevEndDate.setDate(startDate.getDate() - 1);
            prevEndDate.setHours(23, 59, 59, 999);
        } else if (period === 'weekly') {
            const day = now.getDay() || 7; // 1 (Mon) - 7 (Sun)
            startDate.setHours(0, 0, 0, 0);
            startDate.setDate(now.getDate() - day + 1); // Monday
            endDate = new Date(); // Until now

            prevStartDate = new Date(startDate);
            prevStartDate.setDate(startDate.getDate() - 7);
            prevEndDate = new Date(startDate);
            prevEndDate.setDate(startDate.getDate() - 1);
        } else if (period === 'monthly') {
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();

            prevStartDate = new Date(startDate);
            prevStartDate.setMonth(startDate.getMonth() - 1);
            prevEndDate = new Date(startDate);
            prevEndDate.setDate(0); // Last day of prev month
        } else if (period === 'yearly') {
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();

            prevStartDate = new Date(startDate);
            prevStartDate.setFullYear(startDate.getFullYear() - 1);
            prevEndDate = new Date(startDate);
            prevEndDate.setDate(0);
        }

        const startTs = startDate.getTime();
        const endTs = endDate.getTime();
        const prevStartTs = prevStartDate.getTime();
        const prevEndTs = prevEndDate.getTime();

        // --- PIPELINES ---

        // 1. Main Stats & Payment Analysis (Single Pipeline)
        const mainStatsPromise = Order.aggregate([
            {
                $match: {
                    status: { $in: ['done', 'paid'] },
                    timestamp: { $gte: startTs, $lte: endTs }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$total' },
                    totalOrders: { $count: {} },
                    avgTransaction: { $avg: '$total' },
                    cashOrders: {
                        $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, 1, 0] }
                    },
                    nonCashOrders: {
                        $sum: { $cond: [{ $ne: ['$paymentMethod', 'cash'] }, 1, 0] }
                    }
                }
            }
        ]);

        // 2. Previous Period Revenue (for Growth Rate)
        const prevStatsPromise = Order.aggregate([
            {
                $match: {
                    status: { $in: ['done', 'paid'] },
                    timestamp: { $gte: prevStartTs, $lte: prevEndTs }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$total' }
                }
            }
        ]);

        // 3. Top Products (Menu Terlaris)
        const topProductsPromise = Order.aggregate([
            {
                $match: {
                    status: { $in: ['done', 'paid'] },
                    timestamp: { $gte: startTs, $lte: endTs }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.name',
                    count: { $sum: '$items.qty' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // 4. Peak Hours (Timezone Aware)
        // User requested: timezone: 'Asia/Makassar' OR +08:00
        const peakHoursPromise = Order.aggregate([
            {
                $match: {
                    status: { $in: ['done', 'paid'] },
                    timestamp: { $gte: startTs, $lte: endTs }
                }
            },
            {
                $project: {
                    hour: {
                        $hour: {
                            date: { $add: [new Date(0), '$timestamp'] },
                            timezone: timezone // e.g., "+08:00"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: '$hour',
                    count: { $count: {} }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 5. Unique Customers (Retention/Active)
        const uniqueCustomersPromise = Order.aggregate([
            {
                $match: {
                    status: { $in: ['done', 'paid'] },
                    timestamp: { $gte: startTs, $lte: endTs },
                    customerPhone: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$customerPhone'
                }
            },
            {
                $count: 'unique_customers'
            }
        ]);

        // --- EXECUTE ALL ---
        const [
            mainStatsResult,
            prevStatsResult,
            topProductsResult,
            peakHoursResult,
            uniqueCustomersResult
        ] = await Promise.all([
            mainStatsPromise,
            prevStatsPromise,
            topProductsPromise,
            peakHoursPromise,
            uniqueCustomersPromise
        ]);

        // --- FORMAT RESULT ---
        const currentStats = mainStatsResult[0] || { totalRevenue: 0, totalOrders: 0, cashOrders: 0, nonCashOrders: 0, avgTransaction: 0 };
        const prevStats = prevStatsResult[0] || { totalRevenue: 0 };
        const uniqueCount = uniqueCustomersResult[0] ? uniqueCustomersResult[0].unique_customers : 0;

        // Basic calculations
        const { totalRevenue, totalOrders, avgTransaction, cashOrders, nonCashOrders } = currentStats;
        const prevRevenue = prevStats.totalRevenue;
        const growthRate = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

        // Note: avgOrderValue in response should be avgTransaction from pipeline
        const avgOrderValue = avgTransaction || 0;

        // Payment Stats Object (Frontend compatibility)
        const totalPayments = cashOrders + nonCashOrders;
        const paymentStats = {
            cashCount: cashOrders,
            nonCashCount: nonCashOrders,
            cashPercent: totalPayments > 0 ? Math.round((cashOrders / totalPayments) * 100) : 0,
            nonCashPercent: totalPayments > 0 ? 100 - Math.round((cashOrders / totalPayments) * 100) : 0
        };

        // Menu Objects (Top 5 only)
        const topMenu = topProductsResult.map(m => ({ name: m._id, count: m.count }));

        // Peak Hours map
        const peakHoursMap = {};
        peakHoursResult.forEach(ph => peakHoursMap[ph._id] = ph.count);
        const peakHours = [];
        for (let h = 8; h <= 22; h++) {
            peakHours.push({ hour: h, count: peakHoursMap[h] || 0 });
        }

        // Frontend expects "retention" object. Mapping "Unique Customers" to it.
        const retention = {
            new: uniqueCount, // Total active unique customers
            returning: 0,     // Not calculated in this optimized pipeline
            totalUnique: uniqueCount // Extra field if needed
        };

        // Construct Response
        const responseData = {
            stats: {
                revenue: totalRevenue,
                orders: totalOrders,
                avgOrderValue,
                growthRate,
                prevRevenue
            },
            paymentStats,
            topMenu,
            bottomMenu: [], // Not requested in optimized pipeline
            peakHours,
            retention,
            topCombinations: [] // Not requested in optimized pipeline
        };

        // Cache the result
        reportCache.set(cacheKey, {
            timestamp: Date.now(),
            data: responseData
        });

        res.json(responseData);

    } catch (err) {
        console.error('Analytics Report Error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

module.exports = {
    setOrderModel,
    getReportData
};
