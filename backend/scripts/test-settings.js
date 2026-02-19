const http = require('http');

http.get({
    hostname: 'localhost',
    port: 5001,
    path: '/api/settings/public',
    headers: { 'x-api-key': 'warkop_secret_123' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const parsed = JSON.parse(data);
        console.log(JSON.stringify(parsed, null, 2));
    });
}).on('error', e => console.log('Error:', e.message));
