require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Voucher = require('../models/Voucher');

const API_URL = 'http://localhost:5001/api';
const API_KEY = 'warkop_secret_123';
const TENANT = 'negoes';

async function runRaceTest() {
    console.log("--- Starting Voucher Race Condition Test ---");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);

    // Create a dummy voucher with 1 quota left
    const voucherCode = `QA-TEST-${Date.now()}`;
    const tenantDoc = await mongoose.connection.collection('tenants').findOne({ slug: TENANT });
    const testVoucher = new Voucher({
        code: voucherCode,
        discount_type: 'percent',
        discount_value: 50,
        valid_until: new Date(Date.now() + 86400000),
        quota: 1, // Only 1 use allowed!
        used_count: 0,
        is_active: true,
        tenantId: tenantDoc._id,
        min_purchase: 0
    });
    await testVoucher.save();
    console.log(`✅ Created Voucher: ${voucherCode} with Limit: 1`);

    // Prepare 2 identical parallel requests targeting the same voucher
    const buildPayload = () => ({
        id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        items: [{ id: 'menu-1', price: 10000, qty: 1 }],
        total: 10000,
        voucherCode: voucherCode,
        voucherDiscount: 5000,
        paymentMethod: 'cash'
    });

    const req1 = axios.post(`${API_URL}/orders`, buildPayload(), { headers: { 'x-api-key': API_KEY, 'x-tenant-slug': TENANT } });
    const req2 = axios.post(`${API_URL}/orders`, buildPayload(), { headers: { 'x-api-key': API_KEY, 'x-tenant-slug': TENANT } });

    console.log("🚀 Firing 2 parallel checkout requests concurrently...");
    const results = await Promise.allSettled([req1, req2]);

    let successCount = 0;
    let failCount = 0;

    results.forEach((res, index) => {
        if (res.status === 'fulfilled') {
            console.log(`Request ${index + 1}: SUCCESS (Status ${res.value.status})`);
            successCount++;
        } else {
            console.log(`Request ${index + 1}: FAILED (Status ${res.reason.response?.status} - ${JSON.stringify(res.reason.response?.data)})`);
            failCount++;
        }
    });

    console.log("\n--- Race Condition Results ---");
    console.log(`Total Success: ${successCount} (Expected: 1)`);
    console.log(`Total Failed: ${failCount} (Expected: 1)`);

    if (successCount === 1 && failCount === 1) {
        console.log("✅ RACE CONDITION GUARD PASSED! Only 1 request claimed the quota.");
    } else {
        console.log("❌ RACE CONDITION DETECTED! Both requests pierced the quota!");
    }

    // Clean up
    await Voucher.deleteOne({ code: voucherCode });
    mongoose.connection.close();
}

runValidationTest = async () => {
    try {
        await runRaceTest();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

runValidationTest();
