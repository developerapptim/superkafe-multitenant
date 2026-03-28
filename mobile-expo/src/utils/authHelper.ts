/**
 * SuperKafe Mobile - Auth Helper
 * 
 * Native port of frontend/src/utils/authHelper.js
 * 
 * Key differences:
 * - All functions are ASYNC (SecureStore is async)
 * - Uses SecureStore for token, AsyncStorage for user
 * - No localStorage, no window references
 * - Same validation logic as browser version
 */

import { jwtDecode } from 'jwt-decode';
import { secureStorage, appStorage, clearAllStorage } from '../services/storage';
import type { AuthSession, JWTPayload, User } from '../../../shared/types/auth';

/**
 * Check if JWT token is expired
 * (Same logic as browser — jwtDecode works on RN)
 */
export const isTokenExpired = (token: string): boolean => {
  if (!token) return true;

  try {
    const decoded = jwtDecode<JWTPayload>(token);
    const currentTime = Date.now() / 1000;

    if (decoded.exp && decoded.exp < currentTime) {
      console.log('[AUTH] Token expired', {
        exp: new Date(decoded.exp * 1000).toISOString(),
        now: new Date(currentTime * 1000).toISOString(),
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('[AUTH] Failed to decode token:', error);
    return true;
  }
};

/**
 * Check if user has an active session with valid token and tenant
 * 
 * ⚠️ ASYNC — unlike browser version which was synchronous
 */
export const checkActiveSession = async (): Promise<AuthSession | null> => {
  try {
    const token = await secureStorage.getToken();
    let tenantSlug = await secureStorage.getTenantSlug();
    const user = await appStorage.getUser();

    // Check if required data exists
    if (!token || !user) {
      console.log('[AUTH] Incomplete session data', {
        hasToken: !!token,
        hasUser: !!user,
      });
      return null;
    }

    // Check if token is expired
    if (isTokenExpired(token)) {
      console.log('[AUTH] Token expired, clearing session');
      await clearAuthSession();
      return null;
    }

    // Auto-repair tenantSlug from token (source of truth)
    try {
      const decoded = jwtDecode<JWTPayload>(token);
      const actualTenant = decoded.tenantSlug || decoded.tenant;
      if (actualTenant && actualTenant !== tenantSlug) {
        console.log('[AUTH] Auto-repairing tenant_slug from token', {
          old: tenantSlug,
          new: actualTenant,
        });
        tenantSlug = actualTenant;
        await secureStorage.setTenantSlug(actualTenant);
      }

      // Sync hasCompletedSetup from token (Single Source of Truth)
      if (decoded.hasCompletedSetup && user && !user.hasCompletedSetup) {
        user.hasCompletedSetup = true;
        await appStorage.setUser(user);
        console.log('[AUTH] Auto-repaired hasCompletedSetup from Token');
      }
    } catch (e) {
      console.error('[AUTH] Failed to decode token for tenant check', e);
    }

    // Validate user object
    if (!user || typeof user !== 'object') {
      console.error('[AUTH] Invalid user object');
      await clearAuthSession();
      return null;
    }

    console.log('[AUTH] Active session found', {
      tenantSlug,
      userId: user.id,
      userEmail: user.email,
    });

    return { token, tenantSlug: tenantSlug ?? null, user };
  } catch (error) {
    console.error('[AUTH] Error checking active session:', error);
    await clearAuthSession();
    return null;
  }
};

/**
 * Clear all authentication data
 * 
 * ⚠️ ASYNC — clears both SecureStore and AsyncStorage
 */
export const clearAuthSession = async (): Promise<void> => {
  console.log('[AUTH] Clearing session data');
  await clearAllStorage();
};

/**
 * Validate and return session if valid
 */
export const validateSession = async (): Promise<AuthSession | null> => {
  return checkActiveSession();
};
