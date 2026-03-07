// Simple In-Memory Idempotency Cache
// Prevents double-processing of identical requests within a short timeframe (e.g. fast double-clicks)

const idempotencyCache = new Map();

// Cleanup old keys every 15 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of idempotencyCache.entries()) {
        if (now - value.timestamp > 15 * 60 * 1000) { // Keep keys for 15 mins
            idempotencyCache.delete(key);
        }
    }
}, 15 * 60 * 1000);

const checkIdempotency = (req, res, next) => {
    // Only apply to POST/PUT/PATCH methods, not GET
    if (req.method === 'GET' || req.method === 'OPTIONS') return next();

    const idempotencyKey = req.headers['idempotency-key'];

    // If client doesn't send the key, we proceed normally (Idempotency is optional but recommended)
    if (!idempotencyKey) {
        return next();
    }

    // Include tenant slug in the cache key to prevent cross-tenant key collision
    const cacheKey = `${req.tenant?.slug || 'global'}:${idempotencyKey}`;

    if (idempotencyCache.has(cacheKey)) {
        const cachedResponse = idempotencyCache.get(cacheKey);

        // If request is currently processing, inform client to wait or ignore
        if (cachedResponse.status === 'processing') {
            return res.status(409).json({
                success: false,
                message: 'Request is currently being processed. Please wait.',
                error: 'Idempotency conflict'
            });
        }

        // If already completed, return the cached result
        if (cachedResponse.status === 'completed') {
            console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
            return res.status(cachedResponse.statusCode).json(cachedResponse.body);
        }
    }

    // Mark as processing
    idempotencyCache.set(cacheKey, { status: 'processing', timestamp: Date.now() });

    // Intercept res.json to cache the final response
    const originalJson = res.json;
    res.json = function (body) {
        // Cache the result ONLY if status is reasonably successful or a validation error, 
        // 500s shouldn't usually be cached but for idempotency it prevents hammering.
        idempotencyCache.set(cacheKey, {
            status: 'completed',
            statusCode: res.statusCode,
            body: body,
            timestamp: Date.now()
        });

        // Call the original res.json
        return originalJson.call(this, body);
    };

    next();
};

module.exports = checkIdempotency;
