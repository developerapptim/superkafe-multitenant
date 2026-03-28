/**
 * SuperKafe Mobile - Auth Context
 * 
 * Provides authentication state and actions to the entire app.
 * Uses SecureStore for token storage and AppState for foreground checks.
 * 
 * Usage:
 *   const { user, login, logout, isLoading } = useAuth();
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { jwtDecode } from 'jwt-decode';
import { secureStorage, appStorage, clearAllStorage } from '../services/storage';
import { apiEvents, API_EVENTS } from '../services/apiClient';
import { checkActiveSession, isTokenExpired } from '../utils/authHelper';
import type { User, AuthSession, JWTPayload, LoginResponse } from '../../../shared/types/auth';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface AuthContextType {
  /** Current user or null if not authenticated */
  user: User | null;
  /** Current tenant slug */
  tenantSlug: string | null;
  /** Whether auth state is being loaded from storage */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether user has completed cafe setup */
  hasCompletedSetup: boolean;
  /** Login with credentials — saves token and user to secure storage */
  login: (response: LoginResponse) => Promise<void>;
  /** Logout — clears all auth data and navigates to login */
  logout: () => Promise<void>;
  /** Update user data in storage and state */
  updateUser: (user: User) => Promise<void>;
  /** Update tenant slug */
  setTenantSlug: (slug: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenantSlug, setTenantSlugState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Load session from storage on mount ──
  useEffect(() => {
    loadSession();
  }, []);

  // ── Auto-check token on app foreground ──
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Re-validate session when app comes to foreground
        loadSession();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, []);

  // ── Listen for global API events (subscription expired, tenant invalid) ──
  useEffect(() => {
    const unsubscribeExpired = apiEvents.on(
      API_EVENTS.SUBSCRIPTION_EXPIRED,
      (message: string) => {
        console.warn('[AUTH] Subscription expired:', message);
        // Could navigate to upgrade screen or show alert
      }
    );

    const unsubscribeTenant = apiEvents.on(
      API_EVENTS.TENANT_INVALID,
      async () => {
        console.error('[AUTH] Tenant invalid. Forcing logout.');
        await performLogout();
      }
    );

    return () => {
      unsubscribeExpired();
      unsubscribeTenant();
    };
  }, []);

  // ── Core functions ──

  const loadSession = async () => {
    try {
      const session = await checkActiveSession();
      if (session) {
        setUser(session.user);
        setTenantSlugState(session.tenantSlug);
      } else {
        setUser(null);
        setTenantSlugState(null);
      }
    } catch (error) {
      console.error('[AUTH] Failed to load session:', error);
      setUser(null);
      setTenantSlugState(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (response: LoginResponse) => {
    const { token, user: userData, tenantSlug: slug } = response;

    // Save token and user data first
    await secureStorage.setToken(token);

    // Resolve tenantSlug — priority: response field → response.data fields → JWT decode
    let resolvedSlug: string | undefined = slug;

    // Some backends put it in different places
    if (!resolvedSlug) {
      resolvedSlug = (response as any).data?.tenantSlug;
    }

    // Fallback: decode from JWT (most reliable source of truth)
    if (!resolvedSlug) {
      try {
        const decoded = jwtDecode<JWTPayload>(token);
        resolvedSlug =
          decoded.tenantSlug ||
          decoded.tenant ||
          (decoded as any).tenant_slug;
        if (resolvedSlug) {
          console.log('[AUTH] Resolved tenantSlug from JWT:', resolvedSlug);
        }
      } catch (e) {
        console.error('[AUTH] Failed to decode JWT in login():', e);
      }
    }

    // Persist resolved slug
    if (resolvedSlug) {
      await secureStorage.setTenantSlug(resolvedSlug);
    } else {
      console.warn('[AUTH] login(): No tenantSlug resolved — user may be directed to setup-cafe');
    }

    // Mark setup complete on user object if we have a tenant
    const enrichedUser = {
      ...userData,
      hasCompletedSetup: resolvedSlug ? true : (userData.hasCompletedSetup ?? false),
    };
    await appStorage.setUser(enrichedUser);

    // Update state
    setUser(enrichedUser);
    setTenantSlugState(resolvedSlug ?? null);
  }, []);

  const performLogout = async () => {
    await clearAllStorage();
    setUser(null);
    setTenantSlugState(null);
  };

  const logout = useCallback(async () => {
    await performLogout();
  }, []);

  const updateUser = useCallback(async (updatedUser: User) => {
    await appStorage.setUser(updatedUser);
    setUser(updatedUser);
  }, []);

  const setTenantSlugFn = useCallback(async (slug: string) => {
    await secureStorage.setTenantSlug(slug);
    setTenantSlugState(slug);
  }, []);

  const value: AuthContextType = {
    user,
    tenantSlug,
    isLoading,
    isAuthenticated: !!user,
    // hasCompletedSetup: true if user has a tenant assigned.
    // tenantSlug presence is the canonical signal that the cafe setup is done.
    // This fixes the 'Tenant tidak ditemukan' redirect for valid users.
    hasCompletedSetup: !!(tenantSlug || user?.hasCompletedSetup),
    login,
    logout,
    updateUser,
    setTenantSlug: setTenantSlugFn,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
