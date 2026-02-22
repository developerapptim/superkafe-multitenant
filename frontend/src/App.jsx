import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy, useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { SWRConfig } from 'swr';
import { RefreshProvider } from './context/RefreshContext';
import { IdleProvider } from './context/IdleContext';
import api from './services/api';
import Loading from './components/Loading';
import './App.css';

// Auth & Protected Routes
import ProtectedRoute from './components/ProtectedRoute';
import LegacyAdminRedirect from './components/LegacyAdminRedirect';
import TenantRouter from './components/TenantRouter';

// Error Pages
const InvalidSlug = lazy(() => import('./pages/errors/InvalidSlug'));
const TenantNotFound = lazy(() => import('./pages/errors/TenantNotFound'));
const UnauthorizedAccess = lazy(() => import('./pages/errors/UnauthorizedAccess'));

// Landing & Auth Pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const SimpleLogin = lazy(() => import('./pages/auth/SimpleLogin'));
const SimpleRegister = lazy(() => import('./pages/auth/SimpleRegister'));
const GlobalLogin = lazy(() => import('./pages/auth/GlobalLogin'));
const DeviceLogin = lazy(() => import('./pages/auth/DeviceLogin'));
const OTPVerification = lazy(() => import('./pages/auth/OTPVerification'));
const SetupWizard = lazy(() => import('./pages/SetupWizard'));

// Admin Layout
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const MenuManagement = lazy(() => import('./pages/admin/MenuManagement'));
const Kasir = lazy(() => import('./pages/admin/Kasir'));
const Gramasi = lazy(() => import('./pages/admin/Gramasi'));
const Inventaris = lazy(() => import('./pages/admin/Inventaris'));
const Keuangan = lazy(() => import('./pages/admin/Keuangan'));
const Pegawai = lazy(() => import('./pages/admin/Pegawai'));
const Meja = lazy(() => import('./pages/admin/Meja'));
const Laporan = lazy(() => import('./pages/admin/Laporan'));
const Shift = lazy(() => import('./pages/admin/Shift'));
const Pelanggan = lazy(() => import('./pages/admin/Pelanggan'));
const Pengaturan = lazy(() => import('./pages/admin/Pengaturan'));
const SubscriptionUpgrade = lazy(() => import('./pages/admin/SubscriptionUpgrade'));
const SubscriptionSuccess = lazy(() => import('./pages/admin/SubscriptionSuccess'));
const DataCenter = lazy(() => import('./pages/admin/DataCenter'));
const FeedbackList = lazy(() => import('./pages/admin/FeedbackList'));
const Marketing = lazy(() => import('./pages/admin/Marketing'));

// Customer Layout & Pages
const CustomerLayout = lazy(() => import('./pages/customer/CustomerLayout'));
const DynamicStorefront = lazy(() => import('./pages/customer/DynamicStorefront'));
const MenuCustomer = lazy(() => import('./pages/customer/MenuCustomer'));
const Keranjang = lazy(() => import('./pages/customer/Keranjang'));
const PesananSaya = lazy(() => import('./pages/customer/PesananSaya'));
const Bantuan = lazy(() => import('./pages/customer/Bantuan'));
const DemoPortal = lazy(() => import('./pages/DemoPortal'));

const BackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    CapacitorApp.removeAllListeners();

    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (location.pathname === '/' || location.pathname === '/login') {
        CapacitorApp.exitApp();
      } else {
        navigate(-1);
      }
    });
  }, [navigate, location]);

  return null;
};

function App() {
  return (
    <BrowserRouter>
      <BackButtonHandler />
      <Toaster
        position="top-right"
        containerStyle={{ zIndex: 99999, pointerEvents: 'none' }}
        toastOptions={{
          style: {
            background: '#1E1B4B',
            color: '#fff',
            border: '1px solid #8B5CF6',
            pointerEvents: 'auto'
          }
        }}
      />
      <SWRConfig
        value={{
          revalidateOnFocus: false, // Don't revalidate on window focus
          revalidateOnReconnect: false, // Don't revalidate on reconnect
          dedupingInterval: 5000, // Revalidate after 5 seconds
          shouldRetryOnError: false, // Don't retry immediately on error
          fetcher: (url) => api.get(url).then(res => res.data)
        }}
      >
        <Suspense fallback={<Loading />}>
          <RefreshProvider>
            <IdleProvider>
              <Routes>
              {/* ============================================ */}
              {/* CRITICAL: Route order matters for priority! */}
              {/* Static routes MUST come before dynamic routes */}
              {/* ============================================ */}

              {/* Priority 1: Landing Page */}
              <Route path="/" element={<LandingPage />} />

              {/* Priority 2: Auth Routes - Must be before dynamic routes */}
              <Route path="/auth/login" element={<SimpleLogin />} /> {/* Unified login with Google OAuth */}
              <Route path="/auth/register" element={<SimpleRegister />} /> {/* Unified register with Google OAuth */}
              <Route path="/auth/verify-otp" element={<OTPVerification />} />
              <Route path="/auth/device-login" element={<DeviceLogin />} /> {/* Shared tablet login */}
              <Route path="/auth/global-login" element={<GlobalLogin />} /> {/* Legacy global login */}

              {/* Priority 2.5: Error Pages - Must be before dynamic routes */}
              <Route path="/errors/invalid-slug" element={<InvalidSlug />} />
              <Route path="/errors/tenant-not-found" element={<TenantNotFound />} />
              <Route path="/errors/unauthorized" element={<UnauthorizedAccess />} />

              {/* Priority 3: Setup Wizard - Must be before dynamic routes */}
              <Route path="/setup-cafe" element={<SetupWizard />} />

              {/* Priority 4: Legacy Admin Redirect - Must be before tenant-specific routes */}
              <Route path="/admin/*" element={<LegacyAdminRedirect />} />

              {/* Priority 5: Tenant-Specific Admin Routes - Must be before dynamic storefront */}
              <Route path="/:tenantSlug/admin" element={
                <ProtectedRoute allowedRoles={['admin', 'kasir', 'staf']} requireTenant={true}>
                  <TenantRouter>
                    <AdminLayout />
                  </TenantRouter>
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="dashboard" replace />} />

                {/* Accessible by All Roles (Admin + Kasir + Staf) */}
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="menu" element={<MenuManagement />} />
                <Route path="kasir" element={<Kasir />} />
                <Route path="inventaris" element={<Inventaris />} />
                <Route path="meja" element={<Meja />} />
                <Route path="pelanggan" element={<Pelanggan />} />
                <Route path="feedback" element={<FeedbackList />} />

                {/* Restricted to Admin + Staf */}
                <Route path="gramasi" element={
                  <ProtectedRoute allowedRoles={['admin', 'staf']} requireTenant={true}>
                    <Gramasi />
                  </ProtectedRoute>
                } />

                {/* Restricted to Admin Only */}
                <Route path="keuangan" element={
                  <ProtectedRoute allowedRoles={['admin']} requireTenant={true}>
                    <Keuangan />
                  </ProtectedRoute>
                } />
                <Route path="pegawai" element={
                  <ProtectedRoute allowedRoles={['admin']} requireTenant={true}>
                    <Pegawai />
                  </ProtectedRoute>
                } />
                <Route path="pengaturan" element={
                  <ProtectedRoute allowedRoles={['admin']} requireTenant={true}>
                    <Pengaturan />
                  </ProtectedRoute>
                } />
                <Route path="subscription/upgrade" element={
                  <ProtectedRoute allowedRoles={['admin']} requireTenant={true}>
                    <SubscriptionUpgrade />
                  </ProtectedRoute>
                } />
                <Route path="subscription/success" element={
                  <ProtectedRoute allowedRoles={['admin']} requireTenant={true}>
                    <SubscriptionSuccess />
                  </ProtectedRoute>
                } />
                <Route path="data-center" element={
                  <ProtectedRoute allowedRoles={['admin']} requireTenant={true}>
                    <DataCenter />
                  </ProtectedRoute>
                } />
                <Route path="marketing" element={
                  <ProtectedRoute allowedRoles={['admin']} requireTenant={true}>
                    <Marketing />
                  </ProtectedRoute>
                } />
                <Route path="laporan" element={
                  <ProtectedRoute allowedRoles={['admin']} requireTenant={true}>
                    <Laporan />
                  </ProtectedRoute>
                } />
                <Route path="shift" element={
                  <ProtectedRoute allowedRoles={['admin']} requireTenant={true}>
                    <Shift />
                  </ProtectedRoute>
                } />
              </Route>

              {/* Priority 6: Dynamic Tenant Storefront (LOWEST PRIORITY) */}
              {/* IMPORTANT: This MUST be last among functional routes */}
              {/* The /:slug pattern will match ANY single-segment path */}
              <Route path="/:slug" element={<DynamicStorefront />}>
                <Route element={<CustomerLayout />}>
                  <Route index element={<MenuCustomer />} />
                  <Route path="keranjang" element={<Keranjang />} />
                  <Route path="pesanan" element={<PesananSaya />} />
                  <Route path="bantuan" element={<Bantuan />} />
                </Route>
              </Route>

              {/* Priority 7: Fallback - 404 Redirect to landing page */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </IdleProvider>
          </RefreshProvider>
        </Suspense>
      </SWRConfig>
    </BrowserRouter>
  );
}

export default App;

