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

// Common match filter for valid orders (done OR paid)
const VALID_ORDER_MATCH = {
    $or: [
        { status: 'done' },
        { paymentStatus: 'paid' }
    ]
};

/**
 * GET /api/analytics/report
 * Returns aggregated report data for the specified period
 */
const getReportData = async (req, res) => {
    try {
        const { period = 'daily', timezone = '+07:00' } = req.query;
        const cacheKey = `analytics_${period}_${timezone}`;
        const cacheNow = Date.now();

        // Safety: Prevent memory leak
        if (reportCache.size > 100) {
            reportCache.clear();
            console.log('[Analytics] Cache cleared (Size Limit Reached)');
        }

        // 1. Check Cache
        if (reportCache.has(cacheKey)) {
            const cached = reportCache.get(cacheKey);
            if (cacheNow - cached.timestamp < CACHE_TTL[period]) {
                console.log(`[Analytics] Serving cache for ${period}`);
                return res.json(cached.data);
            }
        }

        // 2. Determine Date Range
        const now = new Date();
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
            const day = now.getDay() || 7;
            startDate.setHours(0, 0, 0, 0);
            startDate.setDate(now.getDate() - day + 1);
            endDate = new Date();

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
            prevEndDate.setDate(0);
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

        // --- Build common match with timestamp ---
        const periodMatch = {
            ...VALID_ORDER_MATCH,
            timestamp: { $gte: startTs, $lte: endTs }
        };

        const prevPeriodMatch = {
            ...VALID_ORDER_MATCH,
            timestamp: { $gte: prevStartTs, $lte: prevEndTs }
        };

        // --- PIPELINES ---

        // 1. Main Stats & Payment Analysis
        const mainStatsPromise = Order.aggregate([
            { $match: periodMatch },
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
            { $match: prevPeriodMatch },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$total' }
                }
            }
        ]);

        // 3. Top Products (Menu Terlaris — Top 5)
        const topProductsPromise = Order.aggregate([
            { $match: periodMatch },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.name',
                    count: { $sum: { $ifNull: ['$items.qty', { $ifNull: ['$items.count', 1] }] } }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // 4. Bottom Products (Menu Kurang Diminati — Bottom 5)
        const bottomProductsPromise = Order.aggregate([
            { $match: periodMatch },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.name',
                    count: { $sum: { $ifNull: ['$items.qty', { $ifNull: ['$items.count', 1] }] } }
                }
            },
            { $sort: { count: 1 } },
            { $limit: 5 }
        ]);

        // 5. Peak Hours (Timezone Aware)
        const peakHoursPromise = Order.aggregate([
            { $match: periodMatch },
            {
                $project: {
                    hour: {
                        $hour: {
                            date: { $add: [new Date(0), '$timestamp'] },
                            timezone: timezone
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

        // 6. Customer Retention (New vs Returning)
        const retentionPromise = Order.aggregate([
            { $match: { ...periodMatch, phone: { $exists: true, $ne: null, $ne: '' } } },
            {
                $group: {
                    _id: '$phone',
                    orderCount: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: null,
                    totalUnique: { $sum: 1 },
                    newCustomers: {
                        $sum: { $cond: [{ $eq: ['$orderCount', 1] }, 1, 0] }
                    },
                    returningCustomers: {
                        $sum: { $cond: [{ $gt: ['$orderCount', 1] }, 1, 0] }
                    }
                }
            }
        ]);

        // 7. HPP Profitability (from items.hpp_locked)
        const hppPromise = Order.aggregate([
            { $match: periodMatch },
            { $unwind: '$items' },
            {
                $group: {
                    _id: null,
                    totalHPP: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ['$items.hpp_locked', 0] },
                                { $ifNull: ['$items.qty', { $ifNull: ['$items.count', 1] }] }
                            ]
                        }
                    },
                    integratedOrders: { $addToSet: '$id' }
                }
            },
            {
                $project: {
                    totalHPP: 1,
                    integratedOrders: { $size: '$integratedOrders' }
                }
            }
        ]);

        // 8. Top Combinations (Frequently Bought Together)
        const combinationsPromise = Order.aggregate([
            { $match: periodMatch },
            // Only orders with 2+ items
            { $match: { 'items.1': { $exists: true } } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$_id',
                    itemNames: { $push: '$items.name' }
                }
            },
            // Generate all pairs
            {
                $project: {
                    pairs: {
                        $reduce: {
                            input: { $range: [0, { $subtract: [{ $size: '$itemNames' }, 1] }] },
                            initialValue: [],
                            in: {
                                $concatArrays: [
                                    '$$value',
                                    {
                                        $map: {
                                            input: { $range: [{ $add: ['$$this', 1] }, { $size: '$itemNames' }] },
                                            as: 'j',
                                            in: {
                                                $cond: {
                                                    if: { $lt: [{ $arrayElemAt: ['$itemNames', '$$this'] }, { $arrayElemAt: ['$itemNames', '$$j'] }] },
                                                    then: { $concat: [{ $arrayElemAt: ['$itemNames', '$$this'] }, ' + ', { $arrayElemAt: ['$itemNames', '$$j'] }] },
                                                    else: { $concat: [{ $arrayElemAt: ['$itemNames', '$$j'] }, ' + ', { $arrayElemAt: ['$itemNames', '$$this'] }] }
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            { $unwind: '$pairs' },
            {
                $group: {
                    _id: '$pairs',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // --- EXECUTE ALL ---
        const [
            mainStatsResult,
            prevStatsResult,
            topProductsResult,
            bottomProductsResult,
            peakHoursResult,
            retentionResult,
            hppResult,
            combinationsResult
        ] = await Promise.all([
            mainStatsPromise,
            prevStatsPromise,
            topProductsPromise,
            bottomProductsPromise,
            peakHoursPromise,
            retentionPromise,
            hppPromise,
            combinationsPromise
        ]);

        // --- FORMAT RESULT ---
        const currentStats = mainStatsResult[0] || { totalRevenue: 0, totalOrders: 0, cashOrders: 0, nonCashOrders: 0, avgTransaction: 0 };
        const prevStats = prevStatsResult[0] || { totalRevenue: 0 };
        const retentionData = retentionResult[0] || { totalUnique: 0, newCustomers: 0, returningCustomers: 0 };
        const hppData = hppResult[0] || { totalHPP: 0, integratedOrders: 0 };

        const { totalRevenue, totalOrders, avgTransaction, cashOrders, nonCashOrders } = currentStats;
        const prevRevenue = prevStats.totalRevenue;
        const growthRate = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
        const avgOrderValue = avgTransaction || 0;

        // Payment Stats
        const totalPayments = cashOrders + nonCashOrders;
        const paymentStats = {
            cashCount: cashOrders,
            nonCashCount: nonCashOrders,
            cashPercent: totalPayments > 0 ? Math.round((cashOrders / totalPayments) * 100) : 0,
            nonCashPercent: totalPayments > 0 ? 100 - Math.round((cashOrders / totalPayments) * 100) : 0
        };

        // Menu Objects
        const topMenu = topProductsResult.map(m => ({ name: m._id, count: m.count }));
        const bottomMenu = bottomProductsResult.map(m => ({ name: m._id, count: m.count }));

        // Top Combinations
        const topCombinations = combinationsResult.map(c => ({ name: c._id, count: c.count }));

        // Peak Hours map (8-22)
        const peakHoursMap = {};
        peakHoursResult.forEach(ph => peakHoursMap[ph._id] = ph.count);
        const peakHours = [];
        for (let h = 8; h <= 22; h++) {
            peakHours.push({ hour: h, count: peakHoursMap[h] || 0 });
        }

        // Customer Retention
        const retention = {
            new: retentionData.newCustomers,
            returning: retentionData.returningCustomers,
            totalUnique: retentionData.totalUnique
        };

        // HPP Profitability
        const totalHPP = Math.round(hppData.totalHPP);
        const grossProfit = totalRevenue - totalHPP;
        const avgMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        const profitStats = {
            totalHPP,
            grossProfit,
            avgMargin: parseFloat(avgMargin.toFixed(1)),
            integratedOrders: hppData.integratedOrders
        };

        // Construct Response
        const responseData = {
            stats: {
                revenue: totalRevenue,
                orders: totalOrders,
                avgOrderValue,
                growthRate: parseFloat(growthRate.toFixed(1)),
                prevRevenue
            },
            profitStats,
            paymentStats,
            topMenu,
            bottomMenu,
            peakHours,
            retention,
            topCombinations
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
    getReportData
};
