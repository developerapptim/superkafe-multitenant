import { Navigate, useLocation, useParams } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import InvalidSlug from '../pages/errors/InvalidSlug';
import UnauthorizedAccess from '../pages/errors/UnauthorizedAccess';

const ProtectedRoute = ({ children, allowedRoles, requireTenant = true }) => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
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

    // 2. Check if tenant validation is required
    if (requireTenant) {
        let decodedToken;
        try {
            decodedToken = jwtDecode(token);
        } catch (error) {
            console.error('Invalid JWT token:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            toast.error('Sesi Anda tidak valid. Silakan login kembali.');
            return <Navigate to="/login" replace />;
        }

        // 3. Check if user has completed setup
        if (!user.hasCompletedSetup || !decodedToken.tenant) {
            return <Navigate to="/setup-cafe" replace />;
        }

        // 4. Validate slug format (alphanumeric with hyphens only)
        if (tenantSlug) {
            const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
            if (!slugPattern.test(tenantSlug)) {
                console.error('Invalid slug format:', tenantSlug);
                if (!error) {
                    setError('invalid-slug');
                }
                return <InvalidSlug />;
            }
        }

        // 5. Validate URL slug matches JWT tenant slug
        if (tenantSlug && tenantSlug !== decodedToken.tenant) {
            // Log potential unauthorized access attempt
            console.warn('Slug mismatch detected:', {
                urlSlug: tenantSlug,
                jwtSlug: decodedToken.tenant,
                userId: decodedToken.id,
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
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        console.warn('Role authorization failed:', {
            userRole: user.role,
            allowedRoles,
            userId: user.id,
            timestamp: new Date().toISOString()
        });

        // If user tries to access restricted area, redirect to their main dashboard
        if (requireTenant && user.tenantSlug) {
            toast.error('Anda tidak memiliki izin untuk mengakses halaman ini');
            return <Navigate to={`/${user.tenantSlug}/admin/dashboard`} replace />;
        }
        return <Navigate to="/admin/dashboard" replace />;
    }

    return children;
};

export default ProtectedRoute;
