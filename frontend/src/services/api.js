import axios from 'axios';

/**
 * Decode JWT token payload without external dependencies
 * @param {string} token - JWT token string
 * @returns {object|null} Decoded payload or null if invalid
 */
function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch (error) {
        console.error('Failed to decode JWT:', error);
        return null;
    }
}

// Determine API URL based on current environment/hostname
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const API_BASE_URL = isLocal
    ? `http://${window.location.hostname}:5001/api`
    : (import.meta.env.VITE_API_URL || 'https://superkafe.com/api');

// Create axios instance with dynamic baseURL
const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // Required for cookies/sessions across domains
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor: Pre-process requests (e.g., adding tokens, handling FormData)
api.interceptors.request.use((config) => {
    // 1. If sending FormData, let the browser set the Content-Type with boundary
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    // 2. Add API key (preserving your existing logic)
    config.headers['x-api-key'] = 'warkop_secret_123';

    // 3. Add JWT Token for protected routes
    const token = localStorage.getItem('token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;

        // 4. Extract tenant info from JWT and add to headers
        const decoded = decodeJWT(token);
        if (decoded) {
            // Add tenant slug if available (primary identifier)
            if (decoded.tenantSlug) {
                config.headers['x-tenant-slug'] = decoded.tenantSlug;
            }
            // Add tenant ID as fallback
            else if (decoded.tenantId) {
                config.headers['x-tenant-id'] = decoded.tenantId;
            }
            // Legacy support: check for 'tenant' field
            else if (decoded.tenant) {
                config.headers['x-tenant-slug'] = decoded.tenant;
            }
            // Log warning only if no tenant info found (reduced noise)
            else {
                console.warn('[API] No tenant info in JWT for:', config.url);
            }
        }
    }

    // 5. Fallback: Extract tenant slug from URL path if not in JWT
    // Covers all paths like /:tenantSlug, /:tenantSlug/keranjang, /:tenantSlug/admin
    if (!config.headers['x-tenant-slug'] && !config.headers['x-tenant-id']) {
        const pathMatch = window.location.pathname.match(/^\/([^\/]+)(?:\/|$)/);
        if (pathMatch && pathMatch[1]) {
            const tenantSlug = pathMatch[1];
            // Exclude reserved paths
            const reservedPaths = ['login', 'register', 'setup-cafe', 'auth', 'api', 'assets'];
            if (!reservedPaths.includes(tenantSlug)) {
                config.headers['x-tenant-slug'] = tenantSlug;
            }
        }
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response interceptor: Global error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

// ========== MENU API ==========
export const menuAPI = {
    getAll: () => api.get('/menu'),
    getCustomer: () => api.get('/menu/customer'),
    getById: (id) => api.get(`/menu/${id}`),
    create: (data) => api.post('/menu', data),
    reorder: (items) => api.put('/menu/reorder', { items }),
    update: (id, data) => api.put(`/menu/${id}`, data),
    delete: (id) => api.delete(`/menu/${id}`),
};

// ========== ORDERS API ==========
export const ordersAPI = {
    getAll: () => api.get('/orders'),
    getToday: () => api.get('/orders/today'),
    getById: (id) => api.get(`/orders/${id}`),
    create: (data) => api.post('/orders', data),
    updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
    pay: (id, paymentData) => api.patch(`/orders/${id}/pay`, paymentData),
    payOrder: (id, paymentMethod) => api.patch(`/orders/${id}/pay`, { paymentMethod }), // Keep for compatibility if used
    delete: (id) => api.delete(`/orders/${id}`),
    // New endpoints for smart matching and merging
    checkPhone: (phone) => api.post('/orders/check-phone', { phone }),
    merge: (data) => api.post('/orders/merge', data), // New Merge API
    appendItems: (id, items) => api.patch(`/orders/${id}/append`, { items }),
    cancel: (id) => api.patch(`/orders/${id}/status`, { status: 'cancelled' }),
};


// ========== CATEGORIES API ==========
export const categoriesAPI = {
    getAll: () => api.get('/categories'),
    create: (data) => api.post('/categories', data),
    update: (id, data) => api.put(`/categories/${id}`, data),
    delete: (id) => api.delete(`/categories/${id}`),
    reorder: (categories) => api.put('/categories/reorder', { categories }),
};

// ========== TABLES API ==========
export const tablesAPI = {
    getAll: () => api.get('/tables'),
    create: (data) => api.post('/tables', data),
    updateStatus: (id, status) => api.patch(`/tables/${id}/status`, { status }),
    getTableOrders: (tableId) => api.get(`/tables/${tableId}/orders`),
    moveTable: (fromId, toId) => api.post(`/tables/${fromId}/move/${toId}`),
    markClean: (id) => api.patch(`/tables/${id}/clean`),
    delete: (id) => api.delete(`/tables/${id}`),
};

// ========== RESERVATIONS API ==========
export const reservationsAPI = {
    create: (data) => api.post('/reservations', data),
    getAll: (params) => api.get('/reservations', { params }),
    approve: (id, data) => api.put(`/reservations/${id}/approve`, data),
    reject: (id) => api.put(`/reservations/${id}/reject`),
};

// ========== SHIFT API ==========
export const shiftAPI = {
    getCurrent: () => api.get('/shifts/current'),
    getCurrentBalance: () => api.get('/shifts/current-balance'),
    getHistory: (params) => api.get('/shifts/history', { params }), // NEW
    startShift: (data) => api.post('/shifts/start', data),
    endShift: (data) => api.post('/shifts/end', data),
    getActivities: (params) => api.get('/shifts/activities', { params }), // NEW
};

// ========== INVENTORY API ==========
export const inventoryAPI = {
    getAll: (params) => api.get('/inventory', { params }),
    getStats: () => api.get('/inventory/stats'),
    getLowStock: () => api.get('/inventory/low-stock'),
    create: (data) => api.post('/inventory', data),
    update: (id, data) => api.put(`/inventory/${id}`, data),
    adjustStock: (id, adjustment) => api.put(`/inventory/${id}/stock`, adjustment),
    delete: (id) => api.delete(`/inventory/${id}`),
    getHistory: (params) => api.get('/inventory/history', { params }),
    getTopUsage: () => api.get('/inventory/top-usage'),
    restock: (data) => api.post('/inventory/restock', data),
};

// ========== EMPLOYEES API ==========
export const employeesAPI = {
    getAll: () => api.get('/employees'),
    getById: (id) => api.get(`/employees/${id}`),
    create: (data) => api.post('/employees', data),
    update: (id, data) => api.put(`/employees/${id}`, data),
    delete: (id) => api.delete(`/employees/${id}`),
    verifyPin: (pin_code) => api.post('/employees/verify-pin', { pin_code }),
};

// ========== ATTENDANCE API ==========
export const attendanceAPI = {
    getAll: (params) => api.get('/attendance', { params }),
    getToday: () => api.get('/attendance/today'),
    clockIn: (employee_id) => api.post('/attendance/clock-in', { employee_id }),
    clockOut: (employee_id) => api.post('/attendance/clock-out', { employee_id }),
    create: (data) => api.post('/attendance', data),
    update: (id, data) => api.patch(`/attendance/${id}`, data),
};

// ========== PAYROLL API ==========
export const payrollAPI = {
    calculate: (employee_id, start_date, end_date) =>
        api.post('/payroll/calculate', { employee_id, start_date, end_date }),
};


// ========== REPORTS API ==========
export const reportsAPI = {
    getDashboardStats: () => api.get('/stats'),
    getDailySummary: (date) => api.get(`/reports/daily?date=${date}`),
    getSalesReport: (startDate, endDate) => api.get(`/reports/sales?start=${startDate}&end=${endDate}`),
    getTopProducts: (limit = 5) => api.get(`/reports/top-products?limit=${limit}`),
};

// ========== SETTINGS API ==========
export const settingsAPI = {
    get: () => api.get('/settings'),
    getPublic: () => api.get('/settings/public'),
    update: (data) => api.put('/settings', data),
    updateLoyalty: (loyaltySettings) => api.put('/settings', { loyaltySettings }),
    uploadSound: (formData) => api.post('/settings/upload-sound', formData),
    addUnit: (unit) => api.post('/settings/units', { unit }),
    removeUnit: (unitName) => api.delete(`/settings/units/${unitName}`),
};

// ========== RECIPES/GRAMASI API ==========
export const recipesAPI = {
    getAll: () => api.get('/recipes'),
    getByMenuId: (menuId) => api.get(`/recipes/${menuId}`),
    create: (data) => api.post('/recipes', data),
    update: (menuId, data) => api.put(`/recipes/${menuId}`, data),
    delete: (menuId) => api.delete(`/recipes/${menuId}`),
};

// ========== CASH TRANSACTIONS API ==========
export const cashTransactionsAPI = {
    getAll: () => api.get('/cash-transactions'),
    getSummary: () => api.get('/cash-transactions/summary'),
    create: (data) => api.post('/cash-transactions', data),
    delete: (id) => api.delete(`/cash-transactions/${id}`),
};

// ========== CASH ANALYTICS API ==========
export const cashAnalyticsAPI = {
    getAnalytics: () => api.get('/cash/analytics'),
    getBreakdown: () => api.get('/cash/breakdown'),
};

// ========== DEBTS API (Kasbon & Piutang) ==========
export const debtsAPI = {
    getAll: (params) => api.get('/debts', { params }),
    create: (data) => api.post('/debts', data),
    settle: (id) => api.patch(`/debts/${id}/settle`),
    delete: (id) => api.delete(`/debts/${id}`),
};

// ========== CUSTOMERS API ==========
export const customersAPI = {
    getAll: () => api.get('/customers'),
    getById: (id) => api.get(`/customers/${id}`),
    search: (q) => api.get('/customers/search', { params: { q } }),
    getPoints: (phone) => api.get(`/customers/points/${phone}`),
    create: (data) => api.post('/customers', data),
    update: (id, data) => api.put(`/customers/${id}`, data),
    delete: (id) => api.delete(`/customers/${id}`),
    getAnalytics: (id) => api.get(`/customers/${id}/analytics`),
};

// ========== USER API ==========
export const userAPI = {
    changePassword: (data) => api.put('/users/change-password', data),
};

// ========== FEEDBACK API ==========
export const feedbackAPI = {
    getAll: () => api.get('/feedback'),
    create: (data) => api.post('/feedback', data),
};

// ========== SERVICE REQUEST API ==========
export const serviceAPI = {
    create: (data) => api.post('/service-request', data),
    getPending: () => api.get('/service-request/pending'),
    complete: (id) => api.put(`/service-request/${id}/complete`),
};

// ========== VOUCHER API ==========
export const voucherAPI = {
    getAll: () => api.get('/vouchers'),
    create: (data) => api.post('/vouchers', data),
    update: (id, data) => api.put(`/vouchers/${id}`, data),
    toggle: (id) => api.patch(`/vouchers/${id}/toggle`),
    delete: (id) => api.delete(`/vouchers/${id}`),
};

// ========== BANNER API ==========
export const bannerAPI = {
    getAll: (activeOnly = false) => api.get(`/banners${activeOnly ? '?active_only=true' : ''}`),
    create: (formData) => api.post('/banners', formData),
    delete: (id) => api.delete(`/banners/${id}`),
};

// ========== CART API ==========
export const cartAPI = {
    applyVoucher: (code, subtotal) => api.post('/cart/apply-voucher', { code, subtotal }),
};

// ========== OPERATIONAL EXPENSES API ==========
export const expensesAPI = {
    getAll: (params) => api.get('/expenses', { params }),
    getById: (id) => api.get(`/expenses/${id}`),
    create: (data) => api.post('/expenses', data),
    update: (id, data) => api.put(`/expenses/${id}`, data),
    delete: (id) => api.delete(`/expenses/${id}`),
};

// ========== FINANCE API ==========
export const financeAPI = {
    getProfitLoss: (params) => api.get('/finance/profit-loss', { params }),
};

// ========== TENANT API (Multitenant Management) ==========
export const tenantAPI = {
    register: (data) => api.post('/tenants/register', data),
    getAll: () => api.get('/tenants'),
    getBySlug: (slug) => api.get(`/tenants/${slug}`),
    getTrialStatus: (slug) => api.get(`/tenants/${slug}/trial-status`),
    toggleStatus: (id) => api.patch(`/tenants/${id}/toggle`),
};

// ========== VERIFICATION API (Email OTP) ==========
export const verificationAPI = {
    verifyOTP: (data) => api.post('/auth/verify-otp', data),
    resendOTP: (data) => api.post('/auth/resend-otp', data),
};

// ========== GOOGLE AUTH API ==========
export const googleAuthAPI = {
    authenticate: (data) => api.post('/google-auth', data),
};

// ========== GLOBAL AUTH API (Modern System) ==========
export const globalAuthAPI = {
    globalLogin: (data) => api.post('/auth/global-login', data),
    loginWithPIN: (data) => api.post('/auth/login-pin', data),
    getStaffList: (tenantSlug) => api.get(`/auth/staff-list/${tenantSlug}`),
    verifyAdminPIN: (data) => api.post('/auth/verify-admin-pin', data),
    setPIN: (data) => api.post('/auth/set-pin', data),
};

// ========== PAYMENT API (Duitku Integration) ==========
export const paymentAPI = {
    createInvoice: (data) => api.post('/payments/create-invoice', data),
    checkStatus: (merchantOrderId) => api.get(`/payments/status/${merchantOrderId}`),
    getPricing: () => api.get('/payments/pricing'),
};

export default api;
