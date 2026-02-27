import { Navigate, useLocation, useParams } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import InvalidSlug from '../pages/errors/InvalidSlug';
import UnauthorizedAccess from '../pages/errors/UnauthorizedAccess';

/**
 * Decode JWT token and extract user info
 * @param {string} token - JWT token
 * @returns {object|null} Decoded token payload or null if invalid
 */
const decodeToken = (token) => {
    try {
        return jwtDecode(token);
    } catch (error) {
        console.error('Invalid JWT token:', error);
        return null;
    }
};

const ProtectedRoute = ({ children, allowedRoles, requireTenant = true }) => {
    const token = localStorage.getItem('token');
    const location = useLocation();
    const { tenantSlug } = useParams();
    const [error, setError] = useState(null);

    // Reset error state when location changes
    useEffect(() => {
        setError(null);
    }, [location.pathname]);

    // 1. Check Authentication
    if (!token) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 2. Decode JWT token to get user info
    const decodedToken = decodeToken(token);
    if (!decodedToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        toast.error('Sesi Anda tidak valid. Silakan login kembali.');
        return <Navigate to="/login" replace />;
    }

    // Extract user info from JWT token (source of truth)
    const userRole = decodedToken.role;
    const userTenantSlug = decodedToken.tenantSlug || decodedToken.tenant;
    const userId = decodedToken.id;

    console.log('[ProtectedRoute] User info from JWT:', {
        userId,
        userRole,
        userTenantSlug,
        allowedRoles,
        requireTenant
    });

    // 3. Check if tenant validation is required
    if (requireTenant) {
        // Check if user has tenant assigned
        if (!userTenantSlug) {
            console.warn('[ProtectedRoute] User has no tenant assigned');
            toast.error('Akun Anda belum terhubung dengan kafe. Silakan hubungi admin.');
            return <Navigate to="/login" replace />;
        }

        // 4. Validate slug format (alphanumeric with hyphens only)
        if (tenantSlug) {
            const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
            if (!slugPattern.test(tenantSlug)) {
                console.error('[ProtectedRoute] Invalid slug format:', tenantSlug);
                if (!error) {
                    setError('invalid-slug');
                }
                return <InvalidSlug />;
            }
        }

        // 5. Validate URL slug matches JWT tenant slug
        if (tenantSlug && tenantSlug !== userTenantSlug) {
            // Log potential unauthorized access attempt
            console.warn('[ProtectedRoute] Slug mismatch detected:', {
                urlSlug: tenantSlug,
                jwtSlug: userTenantSlug,
                userId: userId,
                timestamp: new Date().toISOString()
            });

            // Check if this is a cross-tenant access attempt
            if (error !== 'unauthorized') {
                setError('unauthorized');
                toast.error('Anda tidak memiliki akses ke kafe ini');
            }
            return <UnauthorizedAccess />;
        }
    }

    // 6. Check Authorization (Role)
    if (allowedRoles && allowedRoles.length > 0) {
        if (!userRole) {
            console.error('[ProtectedRoute] User has no role assigned:', {
                userId,
                allowedRoles,
                timestamp: new Date().toISOString()
            });
            toast.error('Akun Anda tidak memiliki role. Silakan hubungi admin.');
            return <Navigate to="/login" replace />;
        }

        if (!allowedRoles.includes(userRole)) {
            console.warn('[ProtectedRoute] Role authorization failed:', {
                userRole,
                allowedRoles,
                userId,
                timestamp: new Date().toISOString()
            });

            // If user tries to access restricted area, redirect based on role
            if (requireTenant && userTenantSlug) {
                toast.error('Anda tidak memiliki izin untuk mengakses halaman ini');
                // Staff roles → Kasir (POS). Admin roles → Dashboard.
                const isStaffRole = ['staf', 'kasir', 'waiter', 'kitchen', 'barista'].includes(userRole);
                const redirectPath = isStaffRole ? 'kasir' : 'dashboard';
                return <Navigate to={`/${userTenantSlug}/admin/${redirectPath}`} replace />;
            }
            return <Navigate to="/admin/dashboard" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
