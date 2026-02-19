import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';

/**
 * Dynamic Storefront Wrapper
 * Mengambil slug dari URL dan set tenant_slug di localStorage
 * untuk digunakan oleh axios interceptor
 */
const DynamicStorefront = () => {
  const { slug } = useParams();

  useEffect(() => {
    if (slug) {
      // Set tenant_slug di localStorage untuk axios interceptor
      localStorage.setItem('tenant_slug', slug.toLowerCase());
      console.log('[STOREFRONT] Tenant slug set:', slug);
    }
  }, [slug]);

  // Jika tidak ada slug, redirect ke landing page
  if (!slug) {
    return <Navigate to="/" replace />;
  }

  // Render CustomerLayout dengan tenant context
  return <Outlet />;
};

export default DynamicStorefront;
