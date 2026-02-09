const http = require('http');

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body || '{}') });
                } catch (e) {
                    resolve({ status: res.statusCode, data: { raw: body } });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function run() {
    try {
        console.log('1. Creating Custom Request (Lainnya)...');
        const customRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/service-request',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { table_number: 'TEST-CUSTOM', request_type: 'Lainnya', note: 'Minta saus sambal' });

        console.log('Custom Create Status:', customRes.status);
        if (customRes.status !== 201) throw new Error('Custom Create failed');
        const customId = customRes.data.data._id;

        console.log('\n2. Creating Standard Request (Bill)...');
        const standardRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/service-request',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { table_number: 'TEST-STD', request_type: 'Bill' });

        console.log('Standard Create Status:', standardRes.status);
        if (standardRes.status !== 201) throw new Error('Standard Create failed');
        const standardId = standardRes.data.data._id;

        console.log('\n3. Fetching Pending Requests...');
        const pendingRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/service-request/pending',
            method: 'GET'
        });

        const customReq = pendingRes.data.find(r => r._id === customId);
        const standardReq = pendingRes.data.find(r => r._id === standardId);

        console.log('Found Custom Request:', !!customReq);
        if (customReq) console.log('Custom Note:', customReq.note);
        if (customReq && customReq.note !== 'Minta saus sambal') throw new Error('Note not saved correctly');

        console.log('Found Standard Request:', !!standardReq);
        if (standardReq) console.log('Standard Note:', standardReq.note);

        console.log('\n4. Cleaning up...');
        await request({ hostname: 'localhost', port: 3000, path: `/api/service-request/${customId}/complete`, method: 'PUT' });
        await request({ hostname: 'localhost', port: 3000, path: `/api/service-request/${standardId}/complete`, method: 'PUT' });

        console.log('\n✅ TEST PASSED: Custom Message Feature is working.');
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
    }
}

run();
