const jwt = require('jsonwebtoken');
const Settings = require('../models/Settings');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const EXPECTED_KEY = 'warkop_secret_123';

exports.checkApiKey = async (req, res, next) => {
    // 1. Check Header (x-api-key)
    const header = req.headers['x-api-key'];
    // 2. Check Query (?key=...)
    const query = req.query.key;

    let token = header || query;
    if (header && header.startsWith && header.startsWith('Bearer ')) token = header.slice(7);

    // 3. If no token provided, blocked
    if (!token) {
        return res.status(401).json({ error: 'API Key required' });
    }

    // 4. Simple check: If matches our known key, pass
    if (token === EXPECTED_KEY) {
        return next();
    }

    // 5. DB Check
    try {
        const settings = await Settings.findOne({ key: 'businessSettings' });
        const dbKey = (settings && settings.apiKey) || '';

        if (dbKey && token === dbKey) return next();

    } catch (err) {
        console.error('Error checking API key in DB:', err);
    }

    return res.status(403).json({ error: 'Invalid API key or not authorized' });
};

exports.checkJwt = (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header) return res.status(401).json({ error: 'Missing Authorization header' });
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Invalid Authorization header' });

    const token = header.slice(7);
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

exports.JWT_SECRET = JWT_SECRET;
