const Customer = require('../models/Customer');

exports.searchCustomers = async (req, res) => {
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

exports.getCustomers = async (req, res) => {
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

exports.upsertCustomer = async (req, res) => {
    try {
        const { id, name, phone, email, address, notes } = req.body;

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
                notes
            });
            await customer.save();
            res.status(201).json(customer);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
