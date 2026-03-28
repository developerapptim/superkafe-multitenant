/**
 * @superkafe/shared - Auth Types
 * 
 * TypeScript interfaces for authentication data,
 * derived from existing patterns in frontend/src/utils/authHelper.js
 */

/** Decoded JWT token payload */
export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staf' | 'kasir';
  tenantId?: string;
  tenantSlug?: string;
  /** @deprecated Use tenantSlug instead */
  tenant?: string;
  hasCompletedSetup?: boolean;
  exp: number;
  iat: number;
}

/** User object stored in localStorage / AsyncStorage */
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staf' | 'kasir';
  tenantId?: string;
  tenantSlug?: string;
  hasCompletedSetup?: boolean;
  avatar?: string;
  phone?: string;
}

/** Result of checkActiveSession() */
export interface AuthSession {
  token: string;
  tenantSlug: string | null;
  user: User;
}

/** Login request body */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Login response from backend */
export interface LoginResponse {
  token: string;
  user: User;
  tenantSlug?: string;
}

/** Global login (email-based, multi-tenant) */
export interface GlobalLoginRequest {
  email: string;
  password: string;
}

/** PIN-based login for shared devices */
export interface PINLoginRequest {
  tenantSlug: string;
  pin_code: string;
}
