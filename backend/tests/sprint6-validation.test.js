const axios = require('axios');
const API_URL = 'http://localhost:5001/api';
// We need an API key
const API_KEY = 'warkop_secret_123';

describe('Sprint 6: Security Validation & Race Conditions', () => {

    // 2. Input Anomaly & Security Validation (Joi)
    describe('Payload Validation Stress Test', () => {

        it('should reject order with negative quantity', async () => {
            const payload = {
                id: "order-" + Date.now(),
                total: 10000,
                items: [
                    { id: "test-menu-id", qty: -5, price: 10000, name: "Kopi" }
                ],
                paymentMethod: 'cash',
                tenantId: 'default'
            };

            try {
                await axios.post(`${API_URL}/orders`, payload, {
                    headers: { 'x-api-key': API_KEY, 'x-tenant-slug': 'negoes' }
                });
                // Should not reach here
                expect(true).toBe(false);
            } catch (error) {
                expect(error.response?.status).toBe(400); // Bad Request from Joi
                expect(error.response?.data?.error).toMatch(/must be greater than or equal to 1/);
            }
        });

        it('should reject extremely long notes (10,000 chars) to prevent DB bloat', async () => {
            const longNotes = "A".repeat(10000);
            const payload = {
                id: "order-" + Date.now(),
                total: 10000,
                items: [
                    { id: "test-menu-id", qty: 1, price: 10000, notes: longNotes }
                ],
                paymentMethod: 'cash',
                tenantId: 'default'
            };

            try {
                await axios.post(`${API_URL}/orders`, payload, {
                    headers: { 'x-api-key': API_KEY, 'x-tenant-slug': 'negoes' }
                });
                expect(true).toBe(false);
            } catch (error) {
                expect(error.response?.status).toBe(400);
                expect(error.response?.data?.error).toMatch(/length must be less than or equal to 255 characters long/);
            }
        });
    });
});
