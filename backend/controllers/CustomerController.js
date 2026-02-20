const Customer = require('../models/Customer');
const Order = require('../models/Order');

const searchCustomers = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        const regex = new RegExp(q, 'i');
        const customers = await Customer.find({
            $or: [
                { name: regex },
                { phone: regex },
                { id: regex }
            ]
        }).limit(10);

        res.json(customers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const getCustomers = async (req, res) => {
    try {
        const { page = 1, limit = 50, sort = 'name' } = req.query;
        // Basic implementation
        const customers = await Customer.find()
            .sort({ [sort]: 1 })
            .limit(Number(limit));

        res.json({
            data: customers,
            total: await Customer.countDocuments(),
            page: Number(page)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const upsertCustomer = async (req, res) => {
    try {
        const { id, name, phone, email, address, notes, tags } = req.body;

        // Check if exists
        let customer;
        if (id) {
            customer = await Customer.findOne({ id });
        }

        // If not found by ID, maybe check phone?
        if (!customer && phone) {
            customer = await Customer.findOne({ phone });
        }

        if (customer) {
            // Update
            customer.name = name || customer.name;
            customer.phone = phone || customer.phone;
            customer.email = email || customer.email;
            customer.address = address || customer.address;
            customer.notes = notes || customer.notes;
            if (tags) customer.tags = tags;
            await customer.save();
            return res.json(customer);
        } else {
            // Create
            customer = new Customer({
                id: id || `cust_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name,
                phone,
                email,
                address,
                notes,
                tags
            });
            await customer.save();
            res.status(201).json(customer);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

const getAnalytics = async (req, res) => {
    try {
        const { id } = req.params;
        const customer = await Customer.findOne({ id });
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        // AGGREGATION PIPELINE
        const analytics = await Order.aggregate([
            { $match: { customerId: id, status: { $ne: 'cancel' } } },
            {
                $facet: {
                    // A. PERSONA LOGIC
                    "persona": [
                        {
                            $addFields: {
                                // Convert timestamp number (e.g. 173876...) to Date
                                // MongoDB v4.0+ supports $toDate
                                dateObj: { $toDate: "$timestamp" }
                            }
                        },
                        {
                            $project: {
                                hour: { $hour: { date: "$dateObj", timezone: "Asia/Jakarta" } } // Adjust timezone if needed
                            }
                        },
                        {
                            $bucket: {
                                groupBy: "$hour",
                                boundaries: [0, 5, 11, 15, 19, 24],
                                default: "Unknown",
                                output: {
                                    count: { $sum: 1 }
                                }
                            }
                        },
                        { $sort: { count: -1 } },
                        { $limit: 1 }
                    ],
                    // B. TOP MENUS
                    "topMenus": [
                        { $unwind: "$items" },
                        {
                            $group: {
                                _id: "$items.name",
                                totalQty: { $sum: "$items.qty" }
                            }
                        },
                        { $sort: { totalQty: -1 } },
                        { $limit: 3 }
                    ],
                    // C. RECENT HISTORY
                    "recentHistory": [
                        { $sort: { timestamp: -1 } },
                        { $limit: 5 },
                        {
                            $project: {
                                id: 1,
                                timestamp: 1,
                                total: 1,
                                status: 1,
                                items: { $size: "$items" }
                            }
                        }
                    ]
                }
            }
        ]);

        // PROCESS PERSONA LABEL
        let personaLabel = 'Statistik Belum Cukup';
        let personaIcon = '📊';
        let personaDesc = 'Belum ada cukup data transaksi.';

        if (analytics[0].persona.length > 0) {
            const topBucket = analytics[0].persona[0]._id; // 0, 5, 11, 15, 19

            // Bucket boundaries: [0, 5, 11, 15, 19, 24]
            // 0-5: Night (Late) -> Sobat Begadang
            // 5-11: Morning -> Morning Person
            // 11-15: Noon -> Pejuang Siang
            // 15-19: Afternoon -> Anak Senja
            // 19-24: Night -> Sobat Begadang

            switch (topBucket) {
                case 5:
                    personaLabel = 'Morning Person';
                    personaIcon = '🌅';
                    personaDesc = 'Sering berkunjung di pagi hari (05:00 - 11:00).';
                    break;
                case 11:
                    personaLabel = 'Pejuang Siang';
                    personaIcon = '☀️';
                    personaDesc = 'Langganan makan siang (11:00 - 15:00).';
                    break;
                case 15:
                    personaLabel = 'Anak Senja';
                    personaIcon = '🌇';
                    personaDesc = 'Suka nongkrong sore hari (15:00 - 19:00).';
                    break;
                case 19:
                case 0:
                    personaLabel = 'Sobat Begadang';
                    personaIcon = '🌙';
                    personaDesc = 'Aktif berkunjung di malam hari (19:00+).';
                    break;
                default:
                    personaLabel = 'General Customer';
                    personaIcon = '👤';
            }
        }

        res.json({
            persona: {
                label: personaLabel,
                icon: personaIcon,
                description: personaDesc
            },
            topMenus: analytics[0].topMenus || [],
            recentHistory: analytics[0].recentHistory || [],
            tags: customer.tags || []
        });

    } catch (err) {
        console.error('Analytics Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Get Customer Points & Loyalty Info
 * GET /customers/points/:phone
 * Auto-creates customer if not found
 */
const getCustomerPoints = async (req, res) => {
    try {
        const { phone } = req.params;

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // Normalize phone number (remove non-digits)
        const normalizedPhone = phone.replace(/\D/g, '');

        // Find customer by phone
        let customer = await Customer.findOne({
            $or: [
                { phone: normalizedPhone },
                { phone: phone },
                { phone: { $regex: normalizedPhone.slice(-10) + '$' } } // Match last 10 digits
            ]
        });

        // Auto-create if not found
        if (!customer) {
            customer = new Customer({
                id: `cust_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: 'Pelanggan',
                phone: normalizedPhone,
                points: 0,
                totalSpent: 0,
                visitCount: 0,
                tier: 'bronze'
            });
            await customer.save();
        }

        // Get recent point activities from orders
        const recentOrders = await Order.find({
            $or: [
                { phone: normalizedPhone },
                { phone: phone },
                { customerId: customer.id }
            ],
            paymentStatus: 'paid',
            status: { $ne: 'cancel' }
        })
            .sort({ timestamp: -1 })
            .limit(5)
            .select('id timestamp total createdAt');

        // Format recent activities
        const recentActivities = recentOrders.map(order => ({
            id: order.id,
            date: order.createdAt || new Date(order.timestamp),
            total: order.total,
            pointsEarned: Math.floor(order.total / 10000) // Default ratio, will be overridden by frontend
        }));

        res.json({
            name: customer.name || 'Pelanggan',
            phone: customer.phone,
            points: customer.points || 0,
            tier: customer.tier || 'bronze',
            totalSpent: customer.totalSpent || 0,
            visitCount: customer.visitCount || 0,
            recentActivities
        });

    } catch (err) {
        console.error('Get Customer Points Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
  searchCustomers,
  getCustomers,
  upsertCustomer,
  getAnalytics,
  getCustomerPoints
};
