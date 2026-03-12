const Order = require('../models/Order');
const Ingredient = require('../models/Ingredient');

const getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayMs = today.getTime(); // Order.timestamp is stored as unix ms

        // 1. Fetch Today's Orders using `timestamp` (Number field, not createdAt)
        const todaysOrders = await Order.find({
            timestamp: { $gte: todayMs },
            status: { $ne: 'merged' } // Exclude merged source orders
        }).sort({ timestamp: -1 });

        // 2. Calculate Revenue (only paid orders, exclude cancel)
        const revenue = todaysOrders
            .filter(o => o.status !== 'cancel' && o.paymentStatus === 'paid')
            .reduce((sum, o) => sum + (o.total || 0), 0);

        const ordersCount = todaysOrders.filter(o => o.status !== 'cancel').length;

        // 3. Unique customers today
        const uniqueCustomers = new Set();
        todaysOrders.forEach(o => {
            if (o.customerName && o.customerName !== 'Guest' && o.customerName !== 'Pelanggan') {
                uniqueCustomers.add(o.customerName.toLowerCase());
            }
        });

        // 4. Top Products (Simple aggregation from today's orders)
        const productMap = {};
        todaysOrders.forEach(order => {
            if (order.status !== 'cancel' && order.items) {
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
                percentage: 0
            }))
            .sort((a, b) => b.sold - a.sold)
            .slice(0, 5);

        if (topProducts.length > 0) {
            const maxSold = topProducts[0].sold;
            topProducts.forEach(p => p.percentage = (p.sold / maxSold) * 100);
        }

        // 5. Low Stock Items (from Inventory / Ingredients)
        let lowStockItems = [];
        try {
            lowStockItems = await Ingredient.find({
                $expr: { $lte: ['$stok', '$stok_min'] },
                type: { $ne: 'non_physical' }
            }).sort({ stok: 1 }).limit(5).lean();
        } catch (e) {
            console.warn('Low stock query failed:', e.message);
        }

        res.json({
            success: true,
            stats: {
                revenue,
                orders: ordersCount,
                customers: uniqueCustomers.size
            },
            recentOrders: todaysOrders.slice(0, 20), // Recent 20 for transaction table
            topProducts,
            lowStockItems: lowStockItems.map(item => ({
                name: item.nama,
                stock: item.stok,
                unit: item.satuan || 'pcs',
                minStock: item.stok_min
            }))
        });

    } catch (err) {
        console.error('Dashboard Stats Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
  getDashboardStats
};
