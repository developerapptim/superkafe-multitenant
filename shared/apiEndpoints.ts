/**
 * @superkafe/shared - API Endpoint Definitions
 * 
 * Platform-agnostic endpoint paths extracted from frontend/src/services/api.js
 * Used by both Capacitor (frontend/) and Expo (mobile-expo/) clients.
 * 
 * ⚠️ IMPORTANT: Changing endpoint paths here affects BOTH platforms.
 *    Always coordinate with backend route definitions.
 */

export const ENDPOINTS = {
  // ========== MENU ==========
  MENU: {
    LIST: '/menu',
    CUSTOMER: '/menu/customer',
    BY_ID: (id: string) => `/menu/${id}`,
    REORDER: '/menu/reorder',
  },

  // ========== ORDERS ==========
  ORDERS: {
    LIST: '/orders',
    TODAY: '/orders/today',
    BY_ID: (id: string) => `/orders/${id}`,
    CREATE: '/orders',
    UPDATE_STATUS: (id: string) => `/orders/${id}/status`,
    PAY: (id: string) => `/orders/${id}/pay`,
    CHECK_PHONE: '/orders/check-phone',
    MERGE: '/orders/merge',
    APPEND_ITEMS: (id: string) => `/orders/${id}/append`,
    VOID: (id: string) => `/orders/${id}/void`,
  },

  // ========== CATEGORIES ==========
  CATEGORIES: {
    LIST: '/categories',
    CREATE: '/categories',
    BY_ID: (id: string) => `/categories/${id}`,
    REORDER: '/categories/reorder',
  },

  // ========== TABLES ==========
  TABLES: {
    LIST: '/tables',
    CREATE: '/tables',
    UPDATE_STATUS: (id: string) => `/tables/${id}/status`,
    ORDERS: (tableId: string) => `/tables/${tableId}/orders`,
    MOVE: (fromId: string, toId: string) => `/tables/${fromId}/move/${toId}`,
    CLEAN: (id: string) => `/tables/${id}/clean`,
    DELETE: (id: string) => `/tables/${id}`,
  },

  // ========== RESERVATIONS ==========
  RESERVATIONS: {
    LIST: '/reservations',
    CREATE: '/reservations',
    APPROVE: (id: string) => `/reservations/${id}/approve`,
    REJECT: (id: string) => `/reservations/${id}/reject`,
  },

  // ========== SHIFTS ==========
  SHIFTS: {
    CURRENT: '/shifts/current',
    CURRENT_BALANCE: '/shifts/current-balance',
    HISTORY: '/shifts/history',
    START: '/shifts/start',
    END: '/shifts/end',
    ACTIVITIES: '/shifts/activities',
  },

  // ========== INVENTORY ==========
  INVENTORY: {
    LIST: '/inventory',
    STATS: '/inventory/stats',
    LOW_STOCK: '/inventory/low-stock',
    CREATE: '/inventory',
    BY_ID: (id: string) => `/inventory/${id}`,
    ADJUST_STOCK: (id: string) => `/inventory/${id}/stock`,
    HISTORY: '/inventory/history',
    TOP_USAGE: '/inventory/top-usage',
    RESTOCK: '/inventory/restock',
  },

  // ========== EMPLOYEES ==========
  EMPLOYEES: {
    LIST: '/employees',
    BY_ID: (id: string) => `/employees/${id}`,
    CREATE: '/employees',
    VERIFY_PIN: '/employees/verify-pin',
  },

  // ========== ATTENDANCE ==========
  ATTENDANCE: {
    LIST: '/attendance',
    TODAY: '/attendance/today',
    CLOCK_IN: '/attendance/clock-in',
    CLOCK_OUT: '/attendance/clock-out',
    CREATE: '/attendance',
    BY_ID: (id: string) => `/attendance/${id}`,
  },

  // ========== PAYROLL ==========
  PAYROLL: {
    CALCULATE: '/payroll/calculate',
  },

  // ========== REPORTS ==========
  REPORTS: {
    DASHBOARD_STATS: '/stats',
    DAILY_SUMMARY: '/reports/daily',
    SALES: '/reports/sales',
    TOP_PRODUCTS: '/reports/top-products',
  },

  // ========== SETTINGS ==========
  SETTINGS: {
    GET: '/settings',
    PUBLIC: '/settings/public',
    UPDATE: '/settings',
    UPLOAD_SOUND: '/settings/upload-sound',
    ADD_UNIT: '/settings/units',
    REMOVE_UNIT: (unitName: string) => `/settings/units/${unitName}`,
  },

  // ========== RECIPES ==========
  RECIPES: {
    LIST: '/recipes',
    BY_MENU_ID: (menuId: string) => `/recipes/${menuId}`,
  },

  // ========== CASH TRANSACTIONS ==========
  CASH_TRANSACTIONS: {
    LIST: '/cash-transactions',
    SUMMARY: '/cash-transactions/summary',
    CREATE: '/cash-transactions',
    DELETE: (id: string) => `/cash-transactions/${id}`,
  },

  // ========== CASH ANALYTICS ==========
  CASH_ANALYTICS: {
    ANALYTICS: '/cash/analytics',
    BREAKDOWN: '/cash/breakdown',
  },

  // ========== DEBTS ==========
  DEBTS: {
    LIST: '/debts',
    CREATE: '/debts',
    SETTLE: (id: string) => `/debts/${id}/settle`,
    DELETE: (id: string) => `/debts/${id}`,
  },

  // ========== CUSTOMERS ==========
  CUSTOMERS: {
    LIST: '/customers',
    BY_ID: (id: string) => `/customers/${id}`,
    SEARCH: '/customers/search',
    POINTS: (phone: string) => `/customers/points/${phone}`,
    ANALYTICS: (id: string) => `/customers/${id}/analytics`,
  },

  // ========== USER ==========
  USER: {
    CHANGE_PASSWORD: '/users/change-password',
  },

  // ========== FEEDBACK ==========
  FEEDBACK: {
    LIST: '/feedback',
    CREATE: '/feedback',
  },

  // ========== SERVICE REQUEST ==========
  SERVICE: {
    CREATE: '/service-request',
    PENDING: '/service-request/pending',
    COMPLETE: (id: string) => `/service-request/${id}/complete`,
  },

  // ========== VOUCHERS ==========
  VOUCHERS: {
    LIST: '/vouchers',
    CREATE: '/vouchers',
    BY_ID: (id: string) => `/vouchers/${id}`,
    TOGGLE: (id: string) => `/vouchers/${id}/toggle`,
  },

  // ========== BANNERS ==========
  BANNERS: {
    LIST: '/banners',
    CREATE: '/banners',
    DELETE: (id: string) => `/banners/${id}`,
  },

  // ========== CART ==========
  CART: {
    APPLY_VOUCHER: '/cart/apply-voucher',
  },

  // ========== EXPENSES ==========
  EXPENSES: {
    LIST: '/expenses',
    BY_ID: (id: string) => `/expenses/${id}`,
    CREATE: '/expenses',
  },

  // ========== FINANCE ==========
  FINANCE: {
    PROFIT_LOSS: '/finance/profit-loss',
  },

  // ========== TENANT ==========
  TENANT: {
    REGISTER: '/tenants/register',
    LIST: '/tenants',
    BY_SLUG: (slug: string) => `/tenants/${slug}`,
    TRIAL_STATUS: (slug: string) => `/tenants/${slug}/trial-status`,
    TOGGLE: (id: string) => `/tenants/${id}/toggle`,
  },

  // ========== AUTH ==========
  AUTH: {
    VERIFY_OTP: '/auth/verify-otp',
    RESEND_OTP: '/auth/resend-otp',
    GLOBAL_LOGIN: '/auth/global-login',
    LOGIN_PIN: '/auth/login-pin',
    STAFF_LIST: (tenantSlug: string) => `/auth/staff-list/${tenantSlug}`,
    VERIFY_ADMIN_PIN: '/auth/verify-admin-pin',
    SET_PIN: '/auth/set-pin',
    VERIFY_GOOGLE_PIN: '/auth/verify-google-pin',
    REQUEST_PIN_RESET: '/auth/request-pin-reset',
    RESET_GOOGLE_PIN: '/auth/reset-google-pin',
    PIN_STATUS: '/auth/pin-status',
    TOGGLE_PIN_SECURITY: '/auth/toggle-pin-security',
    CHANGE_PIN: '/auth/change-pin',
    SET_PIN_SECURITY: '/auth/set-pin-security',
  },

  // ========== GOOGLE AUTH ==========
  GOOGLE_AUTH: {
    AUTHENTICATE: '/auth/google',
  },

  // ========== PAYMENT ==========
  PAYMENT: {
    CREATE_INVOICE: '/payments/create-invoice',
    STATUS: (merchantOrderId: string) => `/payments/status/${merchantOrderId}`,
    PRICING: '/payments/pricing',
  },
} as const;
