const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testOrder() {
    const ports = [5001, 5000, 8000, 8080];
    let port = 5001;

    // simplistic port scanner / checker could go here, or just try them
    for (const p of ports) {
        try {
            await axios.get(`http://localhost:${p}/api/menu`); // simple health check
            console.log(`Detected server on port ${p}`);
            port = p;
            break;
        } catch (e) {
            // ignore
        }
    }

    console.log(`Testing Order Creation on port ${port}...`);

    const orderData = {
        total: 23000,
        paymentMethod: 'cash',
        items: [
            {
                id: "menu_123_dummy", // assuming this ID might not trigger recipe lookup fail if dummy? 
                // Wait, recipe lookup iterates recipes. If menuId not found, it skips.
                name: "Kopi Susu",
                price: 23000,
                qty: 1
            }
        ],
        customerPhone: "081234567890",
        customerName: "Test User"
    };

    const form = new FormData();
    form.append('orderData', JSON.stringify(orderData));

    try {
        const res = await axios.post(`http://localhost:${port}/api/orders`, form, {
            headers: {
                ...form.getHeaders()
            }
        });
        console.log("Success:", res.data);
    } catch (err) {
        console.error("Error Status:", err.response?.status);
        console.error("Error Data:", err.response?.data);
    }
}

testOrder();
