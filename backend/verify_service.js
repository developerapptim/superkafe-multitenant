const http = require('http');

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                console.log(`[DEBUG] ${options.method} ${options.path} Status: ${res.statusCode}`);
                console.log(`[DEBUG] Raw Body: ${body}`);
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body || '{}') });
                } catch (e) {
                    console.log('JSON Parse Error for body:', body);
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
        console.log('1. Creating Service Request...');
        const createRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/service-request',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { table_number: 'TEST-99', request_type: 'Bill' });

        console.log('Create Status:', createRes.status);
        console.log('Create Body:', createRes.data);

        if (createRes.status !== 201) throw new Error('Create failed');
        const id = createRes.data.data._id;

        console.log('\n2. Fetching Pending Requests...');
        const pendingRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/service-request/pending',
            method: 'GET'
        });

        console.log('Pending Status:', pendingRes.status);
        const found = pendingRes.data.find(r => r._id === id);
        console.log('Found our request:', !!found);
        if (!found) throw new Error('Request not found in pending list');

        console.log('\n3. Completing Request...');
        const completeRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/service-request/${id}/complete`,
            method: 'PUT'
        });

        console.log('Complete Status:', completeRes.status);
        if (completeRes.status !== 200) throw new Error('Complete failed');

        console.log('\n4. Verifying Removal from Pending...');
        const finalRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/service-request/pending',
            method: 'GET'
        });
        const stillThere = finalRes.data.find(r => r._id === id);
        console.log('Request still pending:', !!stillThere);
        if (stillThere) throw new Error('Request still in pending list');

        console.log('\n✅ TEST PASSED: Service Request Flow is working.');
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
    }
}

run();
