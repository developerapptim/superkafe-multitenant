const Order = require('../models/Order');

exports.getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Fetch Today's Orders
        const todaysOrders = await Order.find({
            createdAt: { $gte: today }
        }).sort({ createdAt: -1 });

        // 2. Calculate Stats
        const revenue = todaysOrders
            .filter(o => o.status !== 'cancelled')
            .reduce((sum, o) => sum + (o.total || 0), 0);

        const ordersCount = todaysOrders.length;

        // 3. Top Products (Simple aggregations from today's orders)
        const productMap = {};
        todaysOrders.forEach(order => {
            if (order.status !== 'cancelled' && order.items) {
                order.items.forEach(item => {
                    const name = item.name || item.menuName || 'Unknown';
                    const qty = item.qty || item.quantity || 1;
                    productMap[name] = (productMap[name] || 0) + qty;
                });
            }
        });

        const topProducts = Object.entries(productMap)
            .map(([name, sold]) => ({
                name,
                sold,
                percentage: 0 // Will calc relative to max
            }))
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 5);

        if (topProducts.length > 0) {
            const maxSold = topProducts[0].sold;
            topProducts.forEach(p => p.percentage = (p.sold / maxSold) * 100);
        }

        res.json({
            success: true,
            stats: {
                revenue,
                orders: ordersCount
            },
            recentOrders: todaysOrders.slice(0, 10), // Limit to 10 most recent
            topProducts
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
