/**
 * SuperKafe Mobile - Storage Adapter
 * 
 * Replaces browser localStorage/idb-keyval with native storage:
 * - SecureStore: encrypted storage for sensitive data (tokens, tenant slugs)
 * - AsyncStorage: unencrypted storage for non-sensitive data (user profile, cache)
 * 
 * Mapping:
 *   localStorage.getItem('token')     → secureStorage.getToken()
 *   localStorage.getItem('user')      → appStorage.getUser()
 *   idb-keyval get()/set()            → appStorage.getCache() / setCache()
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../../../shared/types/auth';

// ─────────────────────────────────────────────────────────────
// 🔐 SECURE STORAGE — Encrypted (Keychain/Keystore)
// For sensitive data like JWT tokens and tenant identifiers
// ─────────────────────────────────────────────────────────────
export const secureStorage = {
  /** Get JWT auth token */
  getToken: (): Promise<string | null> => 
    SecureStore.getItemAsync('auth_token'),

  /** Save JWT auth token */
  setToken: (token: string): Promise<void> => 
    SecureStore.setItemAsync('auth_token', token),

  /** Remove JWT auth token (logout) */
  removeToken: (): Promise<void> => 
    SecureStore.deleteItemAsync('auth_token'),

  /** Get current tenant slug */
  getTenantSlug: (): Promise<string | null> => 
    SecureStore.getItemAsync('tenant_slug'),

  /** Save current tenant slug */
  setTenantSlug: (slug: string): Promise<void> => 
    SecureStore.setItemAsync('tenant_slug', slug),

  /** Remove tenant slug (logout) */
  removeTenantSlug: (): Promise<void> => 
    SecureStore.deleteItemAsync('tenant_slug'),
};

// ─────────────────────────────────────────────────────────────
// 📦 APP STORAGE — Unencrypted (AsyncStorage)
// For non-sensitive data like user profiles and offline cache
// ─────────────────────────────────────────────────────────────
export const appStorage = {
  /** Get stored user profile */
  getUser: async (): Promise<User | null> => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('[Storage] Failed to parse user data:', error);
      return null;
    }
  },

  /** Save user profile */
  setUser: async (user: User): Promise<void> => {
    await AsyncStorage.setItem('user', JSON.stringify(user));
  },

  /** Remove user profile (logout) */
  removeUser: async (): Promise<void> => {
    await AsyncStorage.removeItem('user');
  },

  /** Get tenant name */
  getTenantName: (): Promise<string | null> => 
    AsyncStorage.getItem('tenant_name'),

  /** Save tenant name */
  setTenantName: (name: string): Promise<void> => 
    AsyncStorage.setItem('tenant_name', name),

  /** Remove tenant name */
  removeTenantName: (): Promise<void> => 
    AsyncStorage.removeItem('tenant_name'),

  // ── Offline Cache (replaces idb-keyval) ──

  /** Get cached data by key */
  getCache: async <T = any>(key: string): Promise<T | null> => {
    try {
      const data = await AsyncStorage.getItem(`cache_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`[Storage] Failed to read cache for ${key}:`, error);
      return null;
    }
  },

  /** Set cached data by key */
  setCache: async (key: string, data: any): Promise<void> => {
    try {
      await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error(`[Storage] Failed to write cache for ${key}:`, error);
    }
  },

  /** Clear specific cache key */
  clearCache: async (key: string): Promise<void> => {
    await AsyncStorage.removeItem(`cache_${key}`);
  },

  // ── Subscription status ──

  /** Check if subscription is expired */
  getSubscriptionExpired: async (): Promise<boolean> => {
    const val = await AsyncStorage.getItem('subscription_expired');
    return val === 'true';
  },

  /** Set subscription expired flag */
  setSubscriptionExpired: (expired: boolean): Promise<void> =>
    AsyncStorage.setItem('subscription_expired', String(expired)),
};

// ─────────────────────────────────────────────────────────────
// 🧹 CLEAR ALL — Full logout cleanup
// ─────────────────────────────────────────────────────────────
export const clearAllStorage = async (): Promise<void> => {
  await Promise.all([
    secureStorage.removeToken(),
    secureStorage.removeTenantSlug(),
    appStorage.removeUser(),
    appStorage.removeTenantName(),
    AsyncStorage.removeItem('subscription_expired'),
  ]);
};
