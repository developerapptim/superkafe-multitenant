import React, { createContext, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

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

/**
 * Validate tenant slug format
 * Must be lowercase alphanumeric with hyphens only
 * @param {string} slug - Tenant slug to validate
 * @returns {boolean} True if valid format
 */
export function isValidSlugFormat(slug) {
    if (!slug || typeof slug !== 'string') return false;
    
    // Slug must be lowercase alphanumeric with hyphens
    // Must start and end with alphanumeric character
    const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    return slugRegex.test(slug);
}

/**
 * Extract tenant information from JWT token
 * @param {string} token - JWT token from localStorage
 * @returns {object|null} Tenant context or null if not available
 */
export function extractTenantFromJWT(token) {
    if (!token) return null;
    
    const decoded = decodeJWT(token);
    if (!decoded) return null;
    
    return {
        tenantSlug: decoded.tenant || null,
        tenantId: decoded.userId || null,
        tenantDbName: decoded.tenantDbName || null,
    };
}

// Create Tenant Context
const TenantContext = createContext(null);

/**
 * Hook to access tenant context
 * @returns {object} Tenant context with slug, id, and helper functions
 */
export function useTenant() {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error('useTenant must be used within TenantRouter');
    }
    return context;
}

/**
 * TenantRouter Component
 * Provides tenant context to child components
 * Extracts tenant information from JWT and provides validation helpers
 * 
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 */
export default function TenantRouter({ children }) {
    const navigate = useNavigate();
    
    // Extract tenant context from JWT
    const tenantContext = useMemo(() => {
        const token = localStorage.getItem('token');
        const tenantInfo = extractTenantFromJWT(token);
        
        if (!tenantInfo) {
            return {
                tenantSlug: null,
                tenantId: null,
                tenantDbName: null,
                isAuthenticated: false,
            };
        }
        
        return {
            ...tenantInfo,
            isAuthenticated: true,
        };
    }, []);
    
    /**
     * Validate if URL slug matches JWT tenant slug
     * @param {string} urlSlug - Slug from URL parameter
     * @returns {boolean} True if slugs match
     */
    const validateSlugMatch = (urlSlug) => {
        if (!tenantContext.tenantSlug || !urlSlug) return false;
        return tenantContext.tenantSlug.toLowerCase() === urlSlug.toLowerCase();
    };
    
    /**
     * Redirect to correct tenant route
     * Uses tenant slug from JWT to construct correct URL
     * @param {string} path - Path to redirect to (default: '/admin')
     */
    const redirectToCorrectTenant = (path = '/admin') => {
        if (!tenantContext.tenantSlug) {
            console.warn('Cannot redirect: No tenant slug in JWT');
            return;
        }
        
        const targetPath = `/${tenantContext.tenantSlug}${path}`;
        navigate(targetPath, { replace: true });
    };
    
    /**
     * Get tenant-specific path
     * Prepends tenant slug to given path
     * @param {string} path - Path to make tenant-specific
     * @returns {string} Tenant-specific path
     */
    const getTenantPath = (path) => {
        if (!tenantContext.tenantSlug) {
            console.warn('Cannot generate tenant path: No tenant slug available');
            return path;
        }
        
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return `/${tenantContext.tenantSlug}/${cleanPath}`;
    };
    
    const contextValue = {
        ...tenantContext,
        validateSlugMatch,
        redirectToCorrectTenant,
        getTenantPath,
        isValidSlugFormat,
    };
    
    return (
        <TenantContext.Provider value={contextValue}>
            {children}
        </TenantContext.Provider>
    );
}
