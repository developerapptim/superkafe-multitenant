import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy, useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import Loading from './components/Loading';
import './App.css';

// Auth & Protected Routes
import ProtectedRoute from './components/ProtectedRoute';
const Login = lazy(() => import('./pages/auth/Login'));

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
const DataCenter = lazy(() => import('./pages/admin/DataCenter'));
const FeedbackList = lazy(() => import('./pages/admin/FeedbackList'));

// Customer Layout & Pages
const CustomerLayout = lazy(() => import('./pages/customer/CustomerLayout'));
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

      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Public Routes (Customer Menu as Default) */}
          <Route path="/" element={<CustomerLayout />}>
            <Route index element={<MenuCustomer />} />
            <Route path="keranjang" element={<Keranjang />} />
            <Route path="pesanan" element={<PesananSaya />} />
            <Route path="bantuan" element={<Bantuan />} />
          </Route>

          <Route path="/login" element={<Login />} />

          {/* Admin Routes - Protected (Admin & Kasir) */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin', 'kasir', 'staf']}>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="dashboard" replace />} />

            {/* Accessible by All Roles (Admin + Kasir) */}
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="menu" element={<MenuManagement />} />
            <Route path="kasir" element={<Kasir />} />
            <Route path="inventaris" element={<Inventaris />} />
            <Route path="meja" element={<Meja />} />
            <Route path="pelanggan" element={<Pelanggan />} />

            {/* Restricted to Admin Only */}
            <Route path="keuangan" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Keuangan />
              </ProtectedRoute>
            } />
            <Route path="pegawai" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Pegawai />
              </ProtectedRoute>
            } />
            <Route path="pengaturan" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Pengaturan />
              </ProtectedRoute>
            } />
            <Route path="data-center" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DataCenter />
              </ProtectedRoute>
            } />
            <Route path="feedback" element={<FeedbackList />} />
            <Route path="gramasi" element={
              <ProtectedRoute allowedRoles={['admin', 'staf']}>
                <Gramasi />
              </ProtectedRoute>
            } />
            <Route path="laporan" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Laporan />
              </ProtectedRoute>
            } />
            <Route path="shift" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Shift />
              </ProtectedRoute>
            } />
          </Route>

          {/* 404 - Redirect to customer menu */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

