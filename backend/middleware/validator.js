const Joi = require('joi');

// Helper middleware to validate request payload
const validateRequest = (schema) => {
    return (req, res, next) => {
        // We validate either req.body or if it's multipart (req.body contains parsed text, but check if we need to parse items/orderData string)
        let payload = req.body;

        // If orderData is a string (multipart/form-data upload from frontend), try to parse it
        if (typeof req.body.orderData === 'string') {
            try {
                const parsedOrderData = JSON.parse(req.body.orderData);
                payload = { ...payload, ...parsedOrderData };
            } catch (e) {
                console.error("❌ Failed to parse req.body.orderData in validateRequest:", e);
                return res.status(400).json({ error: 'Format orderData invalid' });
            }
        }

        // If items is a string (standalone multipart upload), try to parse it
        if (typeof payload.items === 'string') {
            try {
                payload = { ...payload, items: JSON.parse(payload.items) };
            } catch (e) {
                console.error("❌ Failed to parse payload.items in validateRequest:", e);
                return res.status(400).json({ error: 'Format items invalid' });
            }
        }

        const { error, value } = schema.validate(payload, { abortEarly: false, allowUnknown: true });

        if (error) {
            const errorMessage = error.details.map((detail) => detail.message).join(', ');
            return res.status(400).json({ error: errorMessage });
        }

        // Optional: Replace req.body with validated and type-casted values
        // req.body = value;
        next();
    };
};

// --- SCHEMAS ---

// Schema for Order Creation
const orderSchema = Joi.object({
    id: Joi.string().required(),
    items: Joi.array().items(
        Joi.object({
            id: Joi.string().required(),
            price: Joi.number().min(0).required(),
            qty: Joi.number().min(1).integer().required(),
            notes: Joi.string().allow('', null).max(255).optional(), // Max 255 chars to prevent bloat
            // Other fields can be optional/unknown
        }).unknown(true)
    ).min(1).required(),
    total: Joi.number().min(0).required(),
}).unknown(true);

// Schema for Restock Inventory
const restockSchema = Joi.object({
    id: Joi.string().required(),
    amount: Joi.number().min(0.01).required(), // Beli qty
    totalPrice: Joi.number().min(0).required(), // Harga beli
    conversionRate: Joi.number().min(0.01).optional()
}).unknown(true);

module.exports = {
    validateRequest,
    orderSchema,
    restockSchema
};
