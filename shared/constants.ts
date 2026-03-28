/**
 * @superkafe/shared - Platform-Agnostic Constants
 * 
 * Shared between Capacitor (frontend/) and Expo (mobile-expo/).
 * ⚠️ DO NOT put platform-specific code here (no window, no import.meta, no RN APIs).
 */

/** API key for all requests — matches backend middleware */
export const API_KEY = 'warkop_secret_123';

/** Default API URL for production */
export const DEFAULT_API_URL = 'https://superkafe.com/api';

/** Reserved URL paths that should not be treated as tenant slugs */
export const RESERVED_PATHS = [
  'login',
  'register',
  'setup-cafe',
  'auth',
  'api',
  'assets',
  'onboarding',
  'errors',
  'checkout',
  'admin',
] as const;

/** IndexedDB / AsyncStorage cache keys for offline data */
export const CACHE_KEYS = {
  CUSTOMER_MENU: 'superkafe_customer_menu',
  CATEGORIES: 'superkafe_categories',
} as const;

/** SecureStore / localStorage keys for auth data */
export const STORAGE_KEYS = {
  TOKEN: 'token',
  AUTH_TOKEN: 'auth_token',
  USER: 'user',
  TENANT_SLUG: 'tenant_slug',
  TENANT_NAME: 'tenant_name',
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
} as const;

/** Subscription tier names */
export const TIERS = {
  FREE: 'free',
  BASIC: 'basic',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

/** Allowed user roles */
export const ROLES = {
  ADMIN: 'admin',
  STAF: 'staf',
  KASIR: 'kasir',
} as const;
