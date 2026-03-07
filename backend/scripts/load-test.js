const autocannon = require('autocannon');
const { execSync } = require('child_process');

async function runTest() {
    console.log('🚀 Starting Superkafe Stress Test (50 Concurrent Connections)...');

    // URL of the backend server.
    // Note: we're bypassing rate limits if testing locally or we need an API key that bypasses it. 
    // Let's test the health endpoint first to ensure basic concurrency works, 
    // then a protected endpoint with a dummy token or known API key.

    // Here we're testing the 'getTodayOrders' which is public-ish but needs DB access
    const url = 'http://localhost:5001/api/orders/today';

    const instance = autocannon({
        url,
        connections: 50,
        pipelining: 1,
        duration: 10 // Let's stress it for 10 seconds
    });

    autocannon.track(instance, { renderProgressBar: true });

    // Periodically check memory usage of the Node process running the server
    // Since we are running the test from a separate process, we can't easily read 
    // the exact heap of the target process without an exposed /health endpoint.
    // Real memory auditing should be done inside the server process itself.

    instance.on('done', (result) => {
        console.log('✅ Stress Test Completed');
        console.log('====================================');
        console.log(`Requests/sec: ${result.requests.average}`);
        console.log(`Latency (p99): ${result.latency.p99} ms`);
        console.log(`Total Errors/Timeouts: ${result.errors + result.timeouts}`);
        console.log('====================================');

        if (result.errors > 0 || result.timeouts > 0) {
            console.error("⚠️ WARNING: The server dropped requests or timed out under load.");
        } else {
            console.log("🎉 SUCCESS: The server handled the load perfectly without dropping requests.");
        }
    });

}

runTest();
