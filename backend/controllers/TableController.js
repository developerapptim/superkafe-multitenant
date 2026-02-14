const Table = require('../models/Table');
const Order = require('../models/Order');

exports.getTables = async (req, res) => {
    try {
        const tables = await Table.find().sort({ number: 1 });
        res.json(tables);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.addTable = async (req, res) => {
    try {
        const { number, capacity, location } = req.body;

        // Check duplicate
        const exists = await Table.findOne({ number });
        if (exists) return res.status(400).json({ error: 'Table number already exists' });

        const newTable = new Table({
            id: `tbl_${Date.now()}`,
            number,
            capacity: capacity || 4,
            location: location || 'indoor'
        });

        await newTable.save();
        res.status(201).json(newTable);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, currentOrderId } = req.body; // status: 'available', 'occupied', 'reserved', 'dirty'

        // Try finding by custom id first, then by table number
        let table = await Table.findOne({ id });
        if (!table) {
            table = await Table.findOne({ number: id });
        }
        if (!table) return res.status(404).json({ error: 'Table not found' });

        table.status = status;
        if (status === 'occupied') {
            table.occupiedSince = new Date();
            if (currentOrderId) {
                if (!table.currentOrderIds) table.currentOrderIds = [];
                if (!table.currentOrderIds.includes(currentOrderId)) table.currentOrderIds.push(currentOrderId);
            }
        } else {
            // Available or Reserved
            table.occupiedSince = null;
            table.currentOrderIds = [];
        }

        await table.save();
        res.json(table);
    } catch (err) {
        console.error('Update status error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
};

exports.moveTable = async (req, res) => {
    try {
        const { fromId, toId } = req.params;

        const fromTable = await Table.findOne({ id: fromId });
        const toTable = await Table.findOne({ id: toId });

        if (!fromTable || !toTable) {
            return res.status(404).json({ error: 'Table not found' });
        }

        if (toTable.status !== 'available') {
            return res.status(400).json({ error: 'Meja tujuan harus kosong' });
        }

        // Find active orders at the source table
        const today = new Date().toISOString().split('T')[0];
        const ordersToMove = await Order.find({
            tableNumber: fromTable.number,
            status: { $nin: ['done', 'cancel'] },
            $or: [
                { date: today },
                { timestamp: { $gte: new Date(today).getTime() } }
            ]
        });

        // Update all orders to new table
        const orderIds = ordersToMove.map(o => o.id);
        await Order.updateMany(
            { id: { $in: orderIds } },
            { $set: { tableNumber: toTable.number } }
        );

        // Update table statuses
        fromTable.status = 'available';
        fromTable.occupiedSince = null;
        fromTable.currentOrderIds = [];
        await fromTable.save();

        toTable.status = 'occupied';
        toTable.occupiedSince = fromTable.occupiedSince || new Date();
        toTable.currentOrderIds = orderIds;
        await toTable.save();

        res.json({
            success: true,
            movedOrders: orderIds.length,
            fromTable,
            toTable
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.cleanTable = async (req, res) => {
    try {
        let table = await Table.findOne({ id: req.params.id });
        if (!table) {
            table = await Table.findOne({ number: req.params.id });
        }
        if (!table) return res.status(404).json({ error: 'Table not found' });

        // if (table.status !== 'dirty') { ... } // Removed check as 'dirty' status is deprecated

        table.status = 'available';
        table.occupiedSince = null;
        table.currentOrderIds = [];
        await table.save();

        res.json(table);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteTable = async (req, res) => {
    try {
        const { id } = req.params;

        // Try deleting by custom 'id' first
        let result = await Table.deleteOne({ id });

        // If not found, try by '_id' (Mongo ID)
        if (result.deletedCount === 0) {
            // Check if it's a valid ObjectId before querying
            if (id.match(/^[0-9a-fA-F]{24}$/)) {
                result = await Table.deleteOne({ _id: id });
            }
        }

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Table not found' });
        }

        res.json({ success: true, message: 'Table deleted' });
    } catch (err) {
        console.error('Delete table error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

