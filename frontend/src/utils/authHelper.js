import { jwtDecode } from 'jwt-decode';

/**
 * Auth Helper Utilities
 * Provides functions for checking authentication status and token validity
 */

/**
 * Check if JWT token is expired
 * @param {string} token - JWT token
 * @returns {boolean} - true if expired, false if still valid
 */
export const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    const decoded = jwtDecode(token);
    const currentTime = Date.now() / 1000; // Convert to seconds
    
    // Check if token has exp claim and if it's expired
    if (decoded.exp && decoded.exp < currentTime) {
      console.log('[AUTH] Token expired', {
        exp: new Date(decoded.exp * 1000).toISOString(),
        now: new Date(currentTime * 1000).toISOString()
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[AUTH] Failed to decode token:', error);
    return true; // Treat invalid tokens as expired
  }
};

/**
 * Check if user has active session with valid token and tenant
 * @returns {Object|null} - { token, tenantSlug, user } if valid session, null otherwise
 */
export const checkActiveSession = () => {
  try {
    const token = localStorage.getItem('token');
    const tenantSlug = localStorage.getItem('tenant_slug');
    const userStr = localStorage.getItem('user');

    // Check if all required data exists
    if (!token || !tenantSlug || !userStr) {
      console.log('[AUTH] Incomplete session data', {
        hasToken: !!token,
        hasTenantSlug: !!tenantSlug,
        hasUser: !!userStr
      });
      return null;
    }

    // Check if token is expired
    if (isTokenExpired(token)) {
      console.log('[AUTH] Token expired, clearing session');
      clearAuthSession();
      return null;
    }

    // Parse user data safely
    let user;
    try {
      user = JSON.parse(userStr);
    } catch (parseError) {
      console.error('[AUTH] Failed to parse user data:', parseError);
      clearAuthSession();
      return null;
    }

    // Validate user object has required fields
    if (!user || typeof user !== 'object') {
      console.error('[AUTH] Invalid user object');
      clearAuthSession();
      return null;
    }

    console.log('[AUTH] Active session found', {
      tenantSlug,
      userId: user.id,
      userEmail: user.email
    });

    return { token, tenantSlug, user };
  } catch (error) {
    console.error('[AUTH] Error checking active session:', error);
    clearAuthSession();
    return null;
  }
};

/**
 * Clear all authentication data from localStorage
 */
export const clearAuthSession = () => {
  console.log('[AUTH] Clearing session data');
  localStorage.removeItem('token');
  localStorage.removeItem('tenant_slug');
  localStorage.removeItem('user');
  localStorage.removeItem('tenant_name');
};

/**
 * Get dashboard URL for current user's tenant
 * @returns {string|null} - Dashboard URL or null if no active session
 */
export const getDashboardUrl = () => {
  const session = checkActiveSession();
  if (!session) return null;
  
  return `/${session.tenantSlug}/admin/dashboard`;
};

/**
 * Validate and refresh user session if needed
 * @returns {Promise<Object|null>} - User data if valid, null otherwise
 */
export const validateSession = async () => {
  const session = checkActiveSession();
  if (!session) return null;

  // Token is valid and not expired
  return session;
};
