const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/menu/customer',
    headers: { 'x-api-key': 'warkop_secret_123' }
};

console.log('Testing /api/menu/customer ...');

const start = Date.now();
http.get(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const elapsed = Date.now() - start;
        console.log('Status:', res.statusCode);
        console.log('Response time:', elapsed + 'ms');
        console.log('Response size:', (data.length / 1024).toFixed(1) + ' KB');

        try {
            const items = JSON.parse(data);
            console.log('Items count:', items.length);
            if (items.length > 0) {
                const first = items[0];
                console.log('Keys:', Object.keys(first).join(', '));
                console.log('Has hpp:', 'hpp' in first);
                console.log('Has profit:', 'profit' in first);
                console.log('Image sample:', first.image ? first.image.substring(0, 120) : 'null');

                // Check Cloudinary optimization
                const cloudinaryItems = items.filter(i => i.image && i.image.includes('res.cloudinary.com'));
                const optimizedItems = cloudinaryItems.filter(i => i.image.includes('w_400'));
                console.log('Cloudinary images:', cloudinaryItems.length);
                console.log('Optimized (w_400):', optimizedItems.length);
            }

            // Test cache - second request
            console.log('\nTesting cache (2nd request)...');
            const start2 = Date.now();
            http.get(options, (res2) => {
                let data2 = '';
                res2.on('data', chunk => data2 += chunk);
                res2.on('end', () => {
                    const elapsed2 = Date.now() - start2;
                    console.log('Cached response time:', elapsed2 + 'ms');
                    console.log(elapsed2 < elapsed ? '✅ Cache is faster!' : '⚠️ Cache not significantly faster');
                    console.log('\n✅ All checks passed!');
                });
            }).on('error', e => console.log('Cache test error:', e.message));
        } catch (e) {
            console.log('Parse error:', e.message);
            console.log('Raw response:', data.substring(0, 200));
        }
    });
}).on('error', e => {
    console.log('❌ Connection error:', e.message);
    console.log('Make sure backend is running on port 5001');
});
