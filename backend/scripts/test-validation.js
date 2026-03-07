const axios = require('axios');
const API_URL = 'http://localhost:5001/api';
const API_KEY = 'warkop_secret_123';

async function runValidationTest() {
    console.log("--- Testing Payload Validation ---");
    try {
        await axios.post(`${API_URL}/orders`, {
            id: 'test-123',
            items: [{ id: 'menu-1', price: 10, qty: -1 }],
            total: 10
        }, { headers: { 'x-api-key': API_KEY, 'x-tenant-slug': 'negoes' } });
        console.log("❌ Passed through successfully? It shouldn't.");
    } catch (err) {
        console.log("Response Status:", err.response?.status);
        console.log("Response Data:", err.response?.data);
    }
}

runValidationTest();
