const axios = require('axios');
const FormData = require('form-data');

async function testRealOrder() {
    const port = 5001;
    console.log(`Testing Real Order Creation on port ${port}...`);

    const orderData = {
        total: 50000,
        paymentMethod: 'cash',
        // Use a menu ID that has a recipe to trigger stock logic
        items: [
            {
                id: "menu_1769841451110_xww96p07q",
                name: "Real Menu Item",
                price: 25000,
                qty: 2
            }
        ],
        customerPhone: "081234567890", // Valid phone to trigger customer logic
        customerName: "Debug User"
    };

    const form = new FormData();
    form.append('orderData', JSON.stringify(orderData));

    try {
        const res = await axios.post(`http://localhost:${port}/api/orders`, form, {
            headers: {
                ...form.getHeaders()
            }
        });
        console.log("Success Response:", res.data);
    } catch (err) {
        console.error("❌ Error Status:", err.response?.status);
        console.error("❌ Error Data:", err.response?.data);
    }
}

testRealOrder();
