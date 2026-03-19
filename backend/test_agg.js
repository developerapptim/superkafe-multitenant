require('dotenv').config();
const mongoose = require('mongoose');
const Ingredient = require('./models/Ingredient');

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const stats = await Ingredient.aggregate([
            {
                $group: {
                    _id: null,
                    totalItems: { $sum: 1 },
                    lowStock: {
                        $sum: {
                            $cond: [
                                { $and: [{ $lte: ["$stok", "$stok_min"] }, { $gt: ["$stok", 0] }] },
                                1,
                                0
                            ]
                        }
                    },
                    emptyStock: {
                        $sum: {
                            $cond: [{ $lte: ["$stok", 0] }, 1, 0]
                        }
                    },
                    assetValue: {
                        $sum: {
                            $multiply: ["$stok", "$harga_modal"] 
                        }
                    },
                    budgetRestock: {
                        $sum: {
                            $cond: [
                                { $lt: ["$stok", "$stok_min"] },
                                {
                                    $multiply: [
                                        { $subtract: ["$stok_min", "$stok"] },
                                        "$harga_modal"
                                    ]
                                },
                                0
                            ]
                        }
                    }
                }
            }
        ]);
        console.log('Stats:', JSON.stringify(stats, null, 2));
    } catch (err) {
        console.error('Aggregation Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}
test();
