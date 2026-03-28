/**
 * SuperKafe Mobile - API Client
 * 
 * Native-compatible Axios instance that replaces frontend/src/services/api.js
 * 
 * Key differences from browser version:
 * 1. Base URL from Constants.expoConfig.extra (not import.meta.env)
 * 2. Token from SecureStore (not localStorage) — interceptor is ASYNC
 * 3. Tenant slug from app state/SecureStore (not window.location.pathname)
 * 4. No `atob()` — uses base64 polyfill for JWT decode
 * 5. No `window.dispatchEvent` — uses EventEmitter for subscription events
 * 6. Network detection via custom hook (not navigator.onLine)
 */

import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { secureStorage, appStorage } from './storage';
import { API_KEY } from '../../../shared/constants';
import { ENDPOINTS } from '../../../shared/apiEndpoints';
import { EventEmitter } from '../utils/eventEmitter';

// ─────────────────────────────────────────────────────────────
// Base URL Configuration
// ─────────────────────────────────────────────────────────────
export const API_BASE_URL: string = 
  Constants.expoConfig?.extra?.apiUrl ?? 'https://superkafe.com/api';

/**
 * Convert relative image paths to absolute URLs
 * (Same logic as frontend, but without window.location)
 */
export const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  const serverUrl = API_BASE_URL.replace(/\/api$/, '');
  return `${serverUrl}${path.startsWith('/') ? path : '/' + path}`;
};

// ─────────────────────────────────────────────────────────────
// JWT Decode (without `atob` — React Native compatible)
// ─────────────────────────────────────────────────────────────
function decodeBase64(str: string): string {
  // React Native has `global.atob` in newer Hermes, but for safety:
  try {
    // Try native atob first (available in Hermes 0.72+)
    if (typeof global.atob === 'function') {
      return global.atob(str);
    }
  } catch {}

  // Manual base64 decode fallback
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  const input = str.replace(/[^A-Za-z0-9+/=]/g, '');
  
  while (i < input.length) {
    const enc1 = chars.indexOf(input.charAt(i++));
    const enc2 = chars.indexOf(input.charAt(i++));
    const enc3 = chars.indexOf(input.charAt(i++));
    const enc4 = chars.indexOf(input.charAt(i++));
    
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;
    
    output += String.fromCharCode(chr1);
    if (enc3 !== 64) output += String.fromCharCode(chr2);
    if (enc4 !== 64) output += String.fromCharCode(chr3);
  }
  
  return output;
}

interface JWTPayload {
  tenantSlug?: string;
  tenantId?: string;
  tenant?: string;
  [key: string]: any;
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = decodeBase64(payload);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('[API] Failed to decode JWT:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Event Emitter for global events (replaces window.dispatchEvent)
// ─────────────────────────────────────────────────────────────
export const apiEvents = new EventEmitter();

// Event names
export const API_EVENTS = {
  SUBSCRIPTION_EXPIRED: 'subscription-expired',
  TENANT_INVALID: 'tenant-invalid',
  UNAUTHORIZED: 'unauthorized',
} as const;

// ─────────────────────────────────────────────────────────────
// Axios Instance
// ─────────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30s timeout for mobile networks
});

// ─────────────────────────────────────────────────────────────
// Request Interceptor (ASYNC — critical difference from browser)
// ─────────────────────────────────────────────────────────────
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 1. Handle FormData (React Native FormData uses { uri, type, name })
    if (config.data instanceof FormData) {
      // In React Native, we must explicitly set multipart/form-data
      config.headers['Content-Type'] = 'multipart/form-data';
    }

    // 2. Add API key
    config.headers['x-api-key'] = API_KEY;

    // 3. Add JWT Token from SecureStore
    const token = await secureStorage.getToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;

      // 4. Extract tenant info from JWT and add to headers
      const decoded = decodeJWT(token);
      if (decoded) {
        if (decoded.tenantSlug) {
          config.headers['x-tenant-slug'] = decoded.tenantSlug;
        } else if (decoded.tenantId) {
          config.headers['x-tenant-id'] = decoded.tenantId;
        } else if (decoded.tenant) {
          config.headers['x-tenant-slug'] = decoded.tenant;
        } else {
          console.warn('[API] No tenant info in JWT for:', config.url);
        }
      }
    }

    // 5. Fallback: Get tenant slug from SecureStore
    //    (In browser, this came from window.location.pathname)
    if (!config.headers['x-tenant-slug'] && !config.headers['x-tenant-id']) {
      const storedSlug = await secureStorage.getTenantSlug();
      if (storedSlug) {
        config.headers['x-tenant-slug'] = storedSlug;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─────────────────────────────────────────────────────────────
// Response Interceptor (Error handling — no window.location)
// ─────────────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.error('[API Error]:', error.response?.data || error.message);

    // Handle Subscription Expired globally
    if (
      error.response?.status === 403 &&
      error.response?.data?.error === 'Langganan Berakhir'
    ) {
      // Emit event instead of window.dispatchEvent(CustomEvent)
      apiEvents.emit(API_EVENTS.SUBSCRIPTION_EXPIRED, error.response.data.message);
      await appStorage.setSubscriptionExpired(true);
    }

    // Handle Tenant Not Found / Inactive
    if (
      error.response?.data?.code === 'TENANT_NOT_FOUND' ||
      error.response?.data?.code === 'TENANT_INACTIVE'
    ) {
      console.error('[SECURITY] Tenant invalid or inactive. Emitting logout event.');
      apiEvents.emit(API_EVENTS.TENANT_INVALID);
      // Note: actual navigation handled by AuthContext listener, not window.location.href
    }

    return Promise.reject(error);
  }
);

// ─────────────────────────────────────────────────────────────
// Offline-first Cache Helper (replaces idb-keyval fetchWithCache)
// ─────────────────────────────────────────────────────────────
// Note: Network detection should use the useNetworkStatus hook
// in the component layer. This is a simpler fallback.
const fetchWithCache = async <T = any>(url: string, cacheKey: string): Promise<{ data: T }> => {
  try {
    const response = await api.get<T>(url);
    // Persist to AsyncStorage (replaces idb-keyval set())
    await appStorage.setCache(cacheKey, response.data);
    return response;
  } catch (error: any) {
    // On network error, try cache
    if (!error.response && error.message === 'Network Error') {
      const cachedData = await appStorage.getCache<T>(cacheKey);
      if (cachedData) {
        console.log(`[Fallback] Loading ${cacheKey} from cache due to Network Error.`);
        return { data: cachedData };
      }
    }
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────
// API Modules (same interface as frontend/src/services/api.js)
// ─────────────────────────────────────────────────────────────

export const menuAPI = {
  getAll: () => api.get(ENDPOINTS.MENU.LIST),
  getCustomer: () => fetchWithCache(ENDPOINTS.MENU.CUSTOMER, 'superkafe_customer_menu'),
  getById: (id: string) => api.get(ENDPOINTS.MENU.BY_ID(id)),
  create: (data: any) => api.post(ENDPOINTS.MENU.LIST, data),
  reorder: (items: any[]) => api.put(ENDPOINTS.MENU.REORDER, { items }),
  update: (id: string, data: any) => api.put(ENDPOINTS.MENU.BY_ID(id), data),
  delete: (id: string) => api.delete(ENDPOINTS.MENU.BY_ID(id)),
};

export const ordersAPI = {
  getAll: () => api.get(ENDPOINTS.ORDERS.LIST),
  getToday: () => api.get(ENDPOINTS.ORDERS.TODAY),
  getById: (id: string) => api.get(ENDPOINTS.ORDERS.BY_ID(id)),
  create: (data: any) => api.post(ENDPOINTS.ORDERS.CREATE, data),
  updateStatus: (id: string, status: string) =>
    api.patch(ENDPOINTS.ORDERS.UPDATE_STATUS(id), { status }),
  pay: (id: string, paymentData: any) =>
    api.patch(ENDPOINTS.ORDERS.PAY(id), paymentData),
  payOrder: (id: string, paymentMethod: string) =>
    api.patch(ENDPOINTS.ORDERS.PAY(id), { paymentMethod }),
  delete: (id: string) => api.delete(ENDPOINTS.ORDERS.BY_ID(id)),
  checkPhone: (phone: string) => api.post(ENDPOINTS.ORDERS.CHECK_PHONE, { phone }),
  merge: (data: any) => api.post(ENDPOINTS.ORDERS.MERGE, data),
  appendItems: (id: string, items: any[]) =>
    api.patch(ENDPOINTS.ORDERS.APPEND_ITEMS(id), { items }),
  cancel: (id: string) =>
    api.patch(ENDPOINTS.ORDERS.UPDATE_STATUS(id), { status: 'cancelled' }),
  void: (id: string, payload: any) => api.post(ENDPOINTS.ORDERS.VOID(id), payload),
};

export const categoriesAPI = {
  getAll: () => fetchWithCache(ENDPOINTS.CATEGORIES.LIST, 'superkafe_categories'),
  create: (data: any) => api.post(ENDPOINTS.CATEGORIES.CREATE, data),
  update: (id: string, data: any) => api.put(ENDPOINTS.CATEGORIES.BY_ID(id), data),
  delete: (id: string) => api.delete(ENDPOINTS.CATEGORIES.BY_ID(id)),
  reorder: (categories: any[]) => api.put(ENDPOINTS.CATEGORIES.REORDER, { categories }),
};

export const tablesAPI = {
  getAll: () => api.get(ENDPOINTS.TABLES.LIST),
  create: (data: any) => api.post(ENDPOINTS.TABLES.CREATE, data),
  updateStatus: (id: string, status: string) =>
    api.patch(ENDPOINTS.TABLES.UPDATE_STATUS(id), { status }),
  getTableOrders: (tableId: string) => api.get(ENDPOINTS.TABLES.ORDERS(tableId)),
  moveTable: (fromId: string, toId: string) =>
    api.post(ENDPOINTS.TABLES.MOVE(fromId, toId)),
  markClean: (id: string) => api.patch(ENDPOINTS.TABLES.CLEAN(id)),
  delete: (id: string) => api.delete(ENDPOINTS.TABLES.DELETE(id)),
};

export const reservationsAPI = {
  create: (data: any) => api.post(ENDPOINTS.RESERVATIONS.CREATE, data),
  getAll: (params?: any) => api.get(ENDPOINTS.RESERVATIONS.LIST, { params }),
  approve: (id: string, data: any) => api.put(ENDPOINTS.RESERVATIONS.APPROVE(id), data),
  reject: (id: string) => api.put(ENDPOINTS.RESERVATIONS.REJECT(id)),
};

export const shiftAPI = {
  getCurrent: () => api.get(ENDPOINTS.SHIFTS.CURRENT),
  getCurrentBalance: () => api.get(ENDPOINTS.SHIFTS.CURRENT_BALANCE),
  getHistory: (params?: any) => api.get(ENDPOINTS.SHIFTS.HISTORY, { params }),
  startShift: (data: any) => api.post(ENDPOINTS.SHIFTS.START, data),
  endShift: (data: any) => api.post(ENDPOINTS.SHIFTS.END, data),
  getActivities: (params?: any) => api.get(ENDPOINTS.SHIFTS.ACTIVITIES, { params }),
};

export const inventoryAPI = {
  getAll: (params?: any) => api.get(ENDPOINTS.INVENTORY.LIST, { params }),
  getStats: () => api.get(ENDPOINTS.INVENTORY.STATS),
  getLowStock: () => api.get(ENDPOINTS.INVENTORY.LOW_STOCK),
  create: (data: any) => api.post(ENDPOINTS.INVENTORY.CREATE, data),
  update: (id: string, data: any) => api.put(ENDPOINTS.INVENTORY.BY_ID(id), data),
  adjustStock: (id: string, adjustment: any) =>
    api.put(ENDPOINTS.INVENTORY.ADJUST_STOCK(id), adjustment),
  delete: (id: string) => api.delete(ENDPOINTS.INVENTORY.BY_ID(id)),
  getHistory: (params?: any) => api.get(ENDPOINTS.INVENTORY.HISTORY, { params }),
  getTopUsage: () => api.get(ENDPOINTS.INVENTORY.TOP_USAGE),
  restock: (data: any) => api.post(ENDPOINTS.INVENTORY.RESTOCK, data),
};

export const employeesAPI = {
  getAll: () => api.get(ENDPOINTS.EMPLOYEES.LIST),
  getById: (id: string) => api.get(ENDPOINTS.EMPLOYEES.BY_ID(id)),
  create: (data: any) => api.post(ENDPOINTS.EMPLOYEES.CREATE, data),
  update: (id: string, data: any) => api.put(ENDPOINTS.EMPLOYEES.BY_ID(id), data),
  delete: (id: string) => api.delete(ENDPOINTS.EMPLOYEES.BY_ID(id)),
  verifyPin: (pin_code: string) =>
    api.post(ENDPOINTS.EMPLOYEES.VERIFY_PIN, { pin_code }),
};

export const attendanceAPI = {
  getAll: (params?: any) => api.get(ENDPOINTS.ATTENDANCE.LIST, { params }),
  getToday: () => api.get(ENDPOINTS.ATTENDANCE.TODAY),
  clockIn: (employee_id: string) =>
    api.post(ENDPOINTS.ATTENDANCE.CLOCK_IN, { employee_id }),
  clockOut: (employee_id: string) =>
    api.post(ENDPOINTS.ATTENDANCE.CLOCK_OUT, { employee_id }),
  create: (data: any) => api.post(ENDPOINTS.ATTENDANCE.CREATE, data),
  update: (id: string, data: any) => api.patch(ENDPOINTS.ATTENDANCE.BY_ID(id), data),
};

export const payrollAPI = {
  calculate: (employee_id: string, start_date: string, end_date: string) =>
    api.post(ENDPOINTS.PAYROLL.CALCULATE, { employee_id, start_date, end_date }),
};

export const reportsAPI = {
  getDashboardStats: () => api.get(ENDPOINTS.REPORTS.DASHBOARD_STATS),
  getDailySummary: (date: string) =>
    api.get(`${ENDPOINTS.REPORTS.DAILY_SUMMARY}?date=${date}`),
  getSalesReport: (startDate: string, endDate: string) =>
    api.get(`${ENDPOINTS.REPORTS.SALES}?start=${startDate}&end=${endDate}`),
  getTopProducts: (limit = 5) =>
    api.get(`${ENDPOINTS.REPORTS.TOP_PRODUCTS}?limit=${limit}`),
};

export const settingsAPI = {
  get: () => api.get(ENDPOINTS.SETTINGS.GET),
  getPublic: () => api.get(ENDPOINTS.SETTINGS.PUBLIC),
  update: (data: any) => api.put(ENDPOINTS.SETTINGS.UPDATE, data),
  updateLoyalty: (loyaltySettings: any) =>
    api.put(ENDPOINTS.SETTINGS.UPDATE, { loyaltySettings }),
  uploadSound: (formData: FormData) =>
    api.post(ENDPOINTS.SETTINGS.UPLOAD_SOUND, formData),
  addUnit: (unit: string) => api.post(ENDPOINTS.SETTINGS.ADD_UNIT, { unit }),
  removeUnit: (unitName: string) => api.delete(ENDPOINTS.SETTINGS.REMOVE_UNIT(unitName)),
};

export const recipesAPI = {
  getAll: () => api.get(ENDPOINTS.RECIPES.LIST),
  getByMenuId: (menuId: string) => api.get(ENDPOINTS.RECIPES.BY_MENU_ID(menuId)),
  create: (data: any) => api.post(ENDPOINTS.RECIPES.LIST, data),
  update: (menuId: string, data: any) =>
    api.put(ENDPOINTS.RECIPES.BY_MENU_ID(menuId), data),
  delete: (menuId: string) => api.delete(ENDPOINTS.RECIPES.BY_MENU_ID(menuId)),
};

export const cashTransactionsAPI = {
  getAll: () => api.get(ENDPOINTS.CASH_TRANSACTIONS.LIST),
  getSummary: () => api.get(ENDPOINTS.CASH_TRANSACTIONS.SUMMARY),
  create: (data: any) => api.post(ENDPOINTS.CASH_TRANSACTIONS.CREATE, data),
  delete: (id: string) => api.delete(ENDPOINTS.CASH_TRANSACTIONS.DELETE(id)),
};

export const cashAnalyticsAPI = {
  getAnalytics: () => api.get(ENDPOINTS.CASH_ANALYTICS.ANALYTICS),
  getBreakdown: () => api.get(ENDPOINTS.CASH_ANALYTICS.BREAKDOWN),
};

export const debtsAPI = {
  getAll: (params?: any) => api.get(ENDPOINTS.DEBTS.LIST, { params }),
  create: (data: any) => api.post(ENDPOINTS.DEBTS.CREATE, data),
  settle: (id: string) => api.patch(ENDPOINTS.DEBTS.SETTLE(id)),
  delete: (id: string) => api.delete(ENDPOINTS.DEBTS.DELETE(id)),
};

export const customersAPI = {
  getAll: () => api.get(ENDPOINTS.CUSTOMERS.LIST),
  getById: (id: string) => api.get(ENDPOINTS.CUSTOMERS.BY_ID(id)),
  search: (q: string) => api.get(ENDPOINTS.CUSTOMERS.SEARCH, { params: { q } }),
  getPoints: (phone: string) => api.get(ENDPOINTS.CUSTOMERS.POINTS(phone)),
  create: (data: any) => api.post(ENDPOINTS.CUSTOMERS.LIST, data),
  update: (id: string, data: any) => api.put(ENDPOINTS.CUSTOMERS.BY_ID(id), data),
  delete: (id: string) => api.delete(ENDPOINTS.CUSTOMERS.BY_ID(id)),
  getAnalytics: (id: string) => api.get(ENDPOINTS.CUSTOMERS.ANALYTICS(id)),
};

export const userAPI = {
  changePassword: (data: any) => api.put(ENDPOINTS.USER.CHANGE_PASSWORD, data),
};

export const feedbackAPI = {
  getAll: () => api.get(ENDPOINTS.FEEDBACK.LIST),
  create: (data: any) => api.post(ENDPOINTS.FEEDBACK.CREATE, data),
};

export const serviceAPI = {
  create: (data: any) => api.post(ENDPOINTS.SERVICE.CREATE, data),
  getPending: () => api.get(ENDPOINTS.SERVICE.PENDING),
  complete: (id: string) => api.put(ENDPOINTS.SERVICE.COMPLETE(id)),
};

export const voucherAPI = {
  getAll: () => api.get(ENDPOINTS.VOUCHERS.LIST),
  create: (data: any) => api.post(ENDPOINTS.VOUCHERS.CREATE, data),
  update: (id: string, data: any) => api.put(ENDPOINTS.VOUCHERS.BY_ID(id), data),
  toggle: (id: string) => api.patch(ENDPOINTS.VOUCHERS.TOGGLE(id)),
  delete: (id: string) => api.delete(ENDPOINTS.VOUCHERS.BY_ID(id)),
};

export const bannerAPI = {
  getAll: (activeOnly = false) =>
    api.get(`${ENDPOINTS.BANNERS.LIST}${activeOnly ? '?active_only=true' : ''}`),
  create: (formData: FormData) => api.post(ENDPOINTS.BANNERS.CREATE, formData),
  delete: (id: string) => api.delete(ENDPOINTS.BANNERS.DELETE(id)),
};

export const cartAPI = {
  applyVoucher: (code: string, subtotal: number) =>
    api.post(ENDPOINTS.CART.APPLY_VOUCHER, { code, subtotal }),
};

export const expensesAPI = {
  getAll: (params?: any) => api.get(ENDPOINTS.EXPENSES.LIST, { params }),
  getById: (id: string) => api.get(ENDPOINTS.EXPENSES.BY_ID(id)),
  create: (data: any) => api.post(ENDPOINTS.EXPENSES.CREATE, data),
  update: (id: string, data: any) => api.put(ENDPOINTS.EXPENSES.BY_ID(id), data),
  delete: (id: string) => api.delete(ENDPOINTS.EXPENSES.BY_ID(id)),
};

export const financeAPI = {
  getProfitLoss: (params?: any) => api.get(ENDPOINTS.FINANCE.PROFIT_LOSS, { params }),
};

export const tenantAPI = {
  register: (data: any) => api.post(ENDPOINTS.TENANT.REGISTER, data),
  getAll: () => api.get(ENDPOINTS.TENANT.LIST),
  getBySlug: (slug: string) => api.get(ENDPOINTS.TENANT.BY_SLUG(slug)),
  getTrialStatus: (slug: string) => api.get(ENDPOINTS.TENANT.TRIAL_STATUS(slug)),
  toggleStatus: (id: string) => api.patch(ENDPOINTS.TENANT.TOGGLE(id)),
};

export const verificationAPI = {
  verifyOTP: (data: any) => api.post(ENDPOINTS.AUTH.VERIFY_OTP, data),
  resendOTP: (data: any) => api.post(ENDPOINTS.AUTH.RESEND_OTP, data),
};

export const googleAuthAPI = {
  authenticate: (data: any) => api.post(ENDPOINTS.GOOGLE_AUTH.AUTHENTICATE, data),
};

export const globalAuthAPI = {
  globalLogin: (data: any) => api.post(ENDPOINTS.AUTH.GLOBAL_LOGIN, data),
  loginWithPIN: (data: any) => api.post(ENDPOINTS.AUTH.LOGIN_PIN, data),
  getStaffList: (tenantSlug: string) =>
    api.get(ENDPOINTS.AUTH.STAFF_LIST(tenantSlug)),
  verifyAdminPIN: (data: any) => api.post(ENDPOINTS.AUTH.VERIFY_ADMIN_PIN, data),
  setPIN: (data: any) => api.post(ENDPOINTS.AUTH.SET_PIN, data),
};

export const paymentAPI = {
  createInvoice: (data: any) => api.post(ENDPOINTS.PAYMENT.CREATE_INVOICE, data),
  checkStatus: (merchantOrderId: string) =>
    api.get(ENDPOINTS.PAYMENT.STATUS(merchantOrderId)),
  getPricing: () => api.get(ENDPOINTS.PAYMENT.PRICING),
};

export const pinAPI = {
  verifyGooglePin: (data: any) => api.post(ENDPOINTS.AUTH.VERIFY_GOOGLE_PIN, data),
  requestPinReset: (data: any) => api.post(ENDPOINTS.AUTH.REQUEST_PIN_RESET, data),
  resetGooglePin: (data: any) => api.post(ENDPOINTS.AUTH.RESET_GOOGLE_PIN, data),
  getPinStatus: () => api.get(ENDPOINTS.AUTH.PIN_STATUS),
  togglePinSecurity: (data: any) => api.post(ENDPOINTS.AUTH.TOGGLE_PIN_SECURITY, data),
  changePin: (data: any) => api.post(ENDPOINTS.AUTH.CHANGE_PIN, data),
  setPin: (data: any) => api.post(ENDPOINTS.AUTH.SET_PIN_SECURITY, data),
};

export default api;
