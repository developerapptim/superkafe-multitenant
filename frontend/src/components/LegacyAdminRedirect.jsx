import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

/**
 * LegacyAdminRedirect Component
 * 
 * Handles backward compatibility for users accessing the old /admin route.
 * Extracts tenant slug from JWT token and redirects to /{tenantSlug}/admin.
 * Logs legacy route access for monitoring and eventual deprecation.
 * 
 * Requirements: 1.4, 6.1, 6.5
 */
const LegacyAdminRedirect = () => {
    const token = localStorage.getItem('token');
    const location = useLocation();

    useEffect(() => {
        // Log legacy route access for monitoring
        if (token) {
            try {
                const decoded = jwtDecode(token);
                console.warn('[LEGACY ROUTE ACCESS]', {
                    path: location.pathname,
                    tenantSlug: decoded.tenant,
                    userId: decoded.id,
                    timestamp: new Date().toISOString(),
                    message: 'User accessed legacy /admin route - redirecting to tenant-specific route'
                });
            } catch (error) {
                console.error('[LEGACY ROUTE ACCESS] Failed to decode token:', error);
            }
        } else {
            console.warn('[LEGACY ROUTE ACCESS]', {
                path: location.pathname,
                timestamp: new Date().toISOString(),
                message: 'Unauthenticated user accessed legacy /admin route'
            });
        }
    }, [token, location.pathname]);

    // If not authenticated, redirect to login
    if (!token) {
        return <Navigate to="/auth/login" state={{ from: location }} replace />;
    }

    // Extract tenant slug from JWT and redirect
    try {
        const decoded = jwtDecode(token);

        // Check if user has tenant information
        if (!decoded.tenant) {
            // User hasn't completed setup, redirect to setup wizard
            return <Navigate to="/setup-cafe" replace />;
        }

        // Preserve the sub-path if any (e.g., /admin/menu -> /{slug}/admin/menu)
        const subPath = location.pathname.replace('/admin', '');
        const newPath = `/${decoded.tenant}/admin${subPath}`;

        return <Navigate to={newPath} replace />;
    } catch (error) {
        console.error('Failed to decode JWT token:', error);
        // Invalid token, clear storage and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return <Navigate to="/auth/login" replace />;
    }
};

export default LegacyAdminRedirect;
