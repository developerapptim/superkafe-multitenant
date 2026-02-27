import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import api from '../services/api';
import toast from 'react-hot-toast';
import { usePendingOrdersCount } from '../hooks/usePendingOrdersCount';
import { useTenant } from './TenantRouter';

// Import admin theme generated CSS classes
import '../styles/admin-theme.css';

// Fetcher
const fetcher = url => api.get(url).then(res => res.data);

// Base menu items with access keys for role_access array filtering
// Paths will be dynamically prefixed with tenant slug
const baseMenuItems = [
  { path: '/admin/dashboard', icon: '📊', label: 'Dashboard', section: 'dashboard', access: 'Dashboard' },
  { path: '/admin/menu', icon: '🍽️', label: 'Manajemen Menu', section: 'menu', access: 'Menu' },
  { path: '/admin/kasir', icon: '🧾', label: 'Kasir (POS)', section: 'pos', access: 'POS' },
  { path: '/admin/gramasi', icon: '⚖️', label: 'Gramasi & HPP', section: 'gramasi', access: 'Gramasi' },
  { path: '/admin/inventaris', icon: '📦', label: 'Inventaris', section: 'inventory', access: 'Inventori' },
  { path: '/admin/keuangan', icon: '💰', label: 'Keuangan & Kas', section: 'finance', access: 'Keuangan', roles: ['admin', 'owner'] },
  { path: '/admin/pegawai', icon: '👥', label: 'Pegawai', section: 'employee', access: 'Pegawai', roles: ['admin', 'owner'] },
  { path: '/admin/meja', icon: '🪑', label: 'Meja & Reservasi', section: 'table', access: 'Meja' },
  { path: '/admin/laporan', icon: '📈', label: 'Laporan & Analitik', section: 'report', access: 'Laporan', roles: ['admin', 'owner'] },
  { path: '/admin/shift', icon: '🔐', label: 'Laporan Shift', section: 'shiftReport', access: 'Laporan', roles: ['admin', 'owner'] },
  { path: '/admin/pelanggan', icon: '❤️', label: 'Pelanggan & Loyalti', section: 'customer', access: 'Pelanggan' },
  { path: '/admin/feedback', icon: '💬', label: 'Masukan Pelanggan', section: 'feedback', access: 'Dashboard' },
  { path: '/admin/marketing', icon: '📢', label: 'Marketing & Promo', section: 'marketing', access: 'Marketing', roles: ['admin', 'owner'] },
  {
    label: 'Pengaturan',
    icon: '⚙️',
    section: 'settings',
    access: 'Settings',
    roles: ['admin', 'owner'],
    children: [
      { path: '/admin/pengaturan', label: 'Umum' },
      { path: '/admin/data-center', label: 'Pusat Data' }
    ]
  },
  {
    path: '/',
    icon: '👁️',
    label: 'Lihat Tampilan Customer',
    section: 'customerPreview',
    access: 'Menu',
    roles: ['admin', 'owner']
  },
];

function Sidebar({ onLogout, isCollapsed, toggleSidebar }) {
  // Get tenant context for dynamic path generation
  // Wrap in try-catch to handle cases where TenantRouter is not available
  let tenantSlug = null;
  try {
    const tenantContext = useTenant();
    tenantSlug = tenantContext?.tenantSlug;
  } catch (err) {
    console.warn('[Sidebar] TenantRouter context not available, using localStorage fallback');
    tenantSlug = localStorage.getItem('tenant_slug');
  }

  const navigate = useNavigate();

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('appSettings');
    return saved ? JSON.parse(saved) : {
      businessName: 'SuperKafe',
      tagline: 'Sistem Manajemen Kafe Modern',
      logo: 'https://res.cloudinary.com/dhjqb65mf/image/upload/v1770018588/Picsart_26-02-02_15-46-53-772_vw9xc3.png'
    };
  });

  // Generate tenant-specific menu items
  const menuItems = useMemo(() => {
    // Fallback: use localStorage tenant_slug if useTenant() returns undefined
    const effectiveTenantSlug = tenantSlug || localStorage.getItem('tenant_slug');

    console.log('[Sidebar] Generating menu items:', {
      tenantSlug,
      effectiveTenantSlug,
      baseMenuItemsCount: baseMenuItems.length
    });

    if (!effectiveTenantSlug) {
      console.warn('[Sidebar] No tenant slug available, using base paths');
      return baseMenuItems;
    }

    const generated = baseMenuItems.map(item => {
      if (item.children) {
        return {
          ...item,
          children: item.children.map(child => ({
            ...child,
            path: `/${effectiveTenantSlug}${child.path}`
          }))
        };
      }
      return {
        ...item,
        path: `/${effectiveTenantSlug}${item.path}`
      };
    });

    console.log('[Sidebar] Generated menu items:', generated.length);
    return generated;
  }, [tenantSlug]);

  // Fetch settings to keep it updated
  useSWR('/settings', fetcher, {
    onSuccess: (data) => {
      if (data) {
        const newSettings = {
          businessName: data.name || data.businessName || 'SuperKafe',
          tagline: data.tagline || 'Sistem Manajemen Kafe Modern',
          logo: data.logo || 'https://res.cloudinary.com/dhjqb65mf/image/upload/v1770018588/Picsart_26-02-02_15-46-53-772_vw9xc3.png'
        };
        setSettings(newSettings);
        localStorage.setItem('appSettings', JSON.stringify(newSettings));
      }
    }
  });

  // Safe User Parsing with loading state
  const [userLoaded, setUserLoaded] = useState(false);
  let user = {};
  let userRole = 'staf';
  let userRoleAccess = [];

  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      user = JSON.parse(userStr);
      userRole = user?.role || 'admin'; // Default to admin if no role
      userRoleAccess = user?.role_access || ['*']; // Default to full access if no role_access
      if (!userLoaded) setUserLoaded(true);
    }
  } catch (err) {
    console.error('Error parsing user data:', err);
    // Default to admin access on error
    userRole = 'admin';
    userRoleAccess = ['*'];
  }

  // Debug logging
  console.log('[Sidebar Debug]', {
    tenantSlug,
    userLoaded,
    userRole,
    userRoleAccess,
    menuItemsCount: menuItems.length,
    user
  });

  const location = useLocation();
  const [expanded, setExpanded] = useState({ settings: true });

  // Filter items based on role_access array
  // Admin (role_access: ['*']) has full access
  // Staf has limited access based on their role_access array
  const filteredItems = useMemo(() => {
    // Don't filter if user data not loaded yet
    if (!userLoaded || !user) {
      console.log('[Sidebar] User data not loaded yet, showing all items');
      return menuItems;
    }

    const filtered = menuItems.filter(item => {
      // 1. Admin/Owner Bypass
      if (userRole === 'admin' || userRole === 'owner' || userRoleAccess?.includes('*')) {
        return true;
      }

      // 2. Granular Access Check
      if (item.access && userRoleAccess?.includes(item.access)) {
        return true;
      }

      // 3. Role Restriction for specific items
      if (item.roles && !item.roles.includes(userRole)) {
        return false;
      }

      // 4. Default Access (Public)
      if (!item.roles && !item.access) {
        return true;
      }

      return false;
    });

    console.log('[Sidebar] Filtered items:', {
      totalMenuItems: menuItems.length,
      filteredCount: filtered.length,
      userRole,
      userRoleAccess
    });

    return filtered;
  }, [menuItems, userLoaded, user, userRole, userRoleAccess]);

  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showAdminLogoutModal, setShowAdminLogoutModal] = useState(false);
  const [endCash, setEndCash] = useState('');
  const { data: currentShift } = useSWR('/shifts/current', fetcher);

  const handleLogoutClick = () => {
    const isAdminOrOwner = userRole === 'admin' || userRole === 'owner';

    if (isAdminOrOwner) {
      // Admin/Owner: Show role-aware popup (Keluar Akun vs Login Kasir)
      setShowAdminLogoutModal(true);
      return;
    }

    // Staff: Close shift if active, then go to Lock Screen
    if (currentShift) {
      setShowCloseShiftModal(true);
    } else {
      // No active shift — go directly to Lock Screen
      handleStaffLogout();
    }
  };

  // Staff logout: clear session, redirect to Lock Screen
  const handleStaffLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isPersonalDevice');
    // Keep tenant_slug so Lock Screen knows which tenant to load staff from
    toast.success('Sesi ditutup. Silakan login kembali.');
    navigate('/auth/device-login');
  };

  // Admin: Full Logout → clear everything → back to login page
  const handleAdminFullLogout = () => {
    setShowAdminLogoutModal(false);
    onLogout();
  };

  // Admin: Switch to Kasir mode → keep tenant_slug → go to Lock Screen  
  const handleAdminToKasir = () => {
    setShowAdminLogoutModal(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isPersonalDevice');
    // Keep tenant_slug for Lock Screen tenant binding
    toast.success('Beralih ke mode Kasir...');
    navigate('/auth/device-login');
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    try {
      await api.put('/shifts/close', {
        endCash: Number(endCash)
      });
      toast.success('Shift ditutup. Sampai jumpa!');
      handleStaffLogout();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menutup shift');
    }
  };


  const toggleExpand = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const pendingOrderCount = usePendingOrdersCount(5000); // Poll every 5s
  const { data: pendingReservations } = useSWR('/reservations?status=pending', fetcher, { refreshInterval: 15000 });
  const pendingReservationsCount = Array.isArray(pendingReservations) ? pendingReservations.length : 0;

  return (
    <aside
      id="sidebar"
      className="h-full w-full admin-bg-sidebar/95 backdrop-blur-xl border-r admin-border-accent flex flex-col transition-all duration-300 shadow-2xl relative"
    >
      {/* Header */}
      <div
        onClick={toggleSidebar}
        className="hidden lg:flex h-16 items-center justify-center lg:justify-start px-2 lg:px-4 border-b admin-border-accent admin-bg-sidebar cursor-pointer hover:brightness-110 transition-colors group relative overflow-hidden"
        title={isCollapsed ? "Klik untuk expand" : "Klik untuk collapse"}
      >
        <div className={`flex items-center gap-3 transition-all duration-300 ${isCollapsed ? 'justify-center w-full' : ''}`}>
          <img
            src={settings.logo}
            alt="Logo"
            className="theme-aware-logo w-8 h-8 rounded bg-transparent object-cover shrink-0 shadow-lg group-hover:scale-105 transition-transform"
          />
          <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 hidden lg:block'}`}>
            <h1 className="font-bold text-white text-sm whitespace-nowrap">{settings.businessName}</h1>
            <p className="text-xs text-gray-400 whitespace-nowrap">
              {userRole === 'admin' || userRole === 'owner' ? 'Administrator' :
                userRole === 'staf' ? 'Staf Server' : 'Kasir'}
            </p>
          </div>
        </div>

        {/* Mobile: Arrow indicator when collapsed (optional, maybe too cluttered) */}
        {/* {isCollapsed && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 lg:hidden text-gray-500 text-[10px]">
                ▶
            </div>
         )} */}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto py-4 custom-scrollbar transition-all duration-300 ${isCollapsed ? 'hidden lg:block opacity-0 lg:opacity-100' : 'block opacity-100'}`}>
        <ul className="space-y-1 px-2">
          {filteredItems.map((item) => {
            if (item.children) {
              const isExpanded = expanded[item.section];
              // Check if any child is active
              const isChildActive = item.children.some(child => location.pathname === child.path);

              return (
                <li key={item.section} className="mb-1">
                  <button
                    onClick={() => toggleExpand(item.section)}
                    className={`w-full flex items-center justify-center lg:justify-between px-2 lg:px-3 py-3 rounded-lg transition-colors duration-200 ${isChildActive ? 'bg-purple-600/10 text-purple-200' : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      } group`}
                    title={item.label}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg lg:text-xl shrink-0 leading-none group-hover:scale-110 transition-transform">{item.icon}</span>
                      <span className={`hidden lg:block text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>{item.label}</span>
                    </div>
                    <span className={`hidden lg:block text-xs opacity-50 transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-50'}`}>{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Submenu */}
                  {isExpanded && !isCollapsed && (
                    <ul className="mt-1 space-y-1 pl-0 lg:pl-4 bg-black/20 rounded-lg lg:bg-transparent p-1 lg:p-0 animate-slide-down">
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <NavLink
                            to={child.path}
                            className={({ isActive }) =>
                              `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-200 ${isActive
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                              } justify-center lg:justify-start text-sm`
                            }
                          >
                            <span className="hidden lg:block w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0"></span>
                            <span className="hidden lg:block truncate">{child.label}</span>
                            <span className="lg:hidden text-[10px] text-center w-full">{child.label.substring(0, 2)}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            }

            return (
              <li key={item.section}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => {
                    const isCustomerPreview = item.path === '/';
                    if (isCustomerPreview) {
                      return `flex items-center gap-3 px-2 lg:px-3 py-3 rounded-lg transition-colors duration-200 text-gray-300 hover:bg-white/10 hover:text-white justify-center lg:justify-start relative`;
                    }
                    return `flex items-center gap-3 px-2 lg:px-3 py-3 rounded-lg transition-colors duration-200 ${isActive
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                      } justify-center lg:justify-start relative`;
                  }}
                  title={item.label}
                >
                  <span className="text-lg lg:text-xl shrink-0 leading-none relative">
                    {item.icon}
                    {item.path === '/admin/kasir' && pendingOrderCount > 0 && (
                      <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm border border-[#1e1b4b] animate-bounce-slow">
                        {pendingOrderCount > 99 ? '99+' : pendingOrderCount}
                      </span>
                    )}
                    {item.path === '/admin/meja' && pendingReservationsCount > 0 && (
                      <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm border border-[#1e1b4b] animate-bounce-slow">
                        {pendingReservationsCount > 99 ? '99+' : pendingReservationsCount}
                      </span>
                    )}
                  </span>
                  <span className={`hidden lg:block text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
                    {item.label}
                    {item.path === '/admin/kasir' && pendingOrderCount > 0 && isCollapsed && (
                      <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-[#1e1b4b]"></span>
                    )}
                    {item.path === '/admin/meja' && pendingReservationsCount > 0 && isCollapsed && (
                      <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-[#1e1b4b]"></span>
                    )}
                  </span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer / Logout */}
      <div className={`p-4 border-t admin-border-accent admin-bg-main transition-all duration-300 ${isCollapsed ? 'hidden lg:flex justify-center' : 'block'}`}>
        <button
          onClick={handleLogoutClick}
          className={`w-full flex items-center gap-3 px-2 lg:px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors justify-center lg:justify-start`}
          title="Keluar"
        >
          <span className="text-lg lg:text-xl leading-none">🚪</span>
          <span className={`hidden lg:block text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto'}`}>Keluar</span>
        </button>
      </div>

      {/* Close Shift Modal - Using Portal to escape Sidebar constraints */}
      {showCloseShiftModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="admin-bg-sidebar p-6 rounded-2xl w-full max-w-sm border admin-border-accent shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-4 admin-text-primary">Tutup Shift & Keluar</h3>
            <p className="text-gray-400 text-sm mb-4">Masukkan total uang tunai di laci saat ini.</p>

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Uang Tunai (Cash)</label>
                <input
                  type="number"
                  value={endCash}
                  onChange={(e) => setEndCash(e.target.value)}
                  className="w-full px-4 py-2 mt-1 rounded admin-input focus:outline-none"
                  placeholder="0"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCloseShiftModal(false)}
                  className="flex-1 py-2 rounded bg-white/10 text-white hover:bg-white/20"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded bg-red-600 text-white hover:bg-red-700 font-bold"
                >
                  Tutup & Keluar
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Admin Logout Popup - "Keluar Akun" vs "Login Kasir" */}
      {showAdminLogoutModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="admin-bg-sidebar p-6 rounded-2xl w-full max-w-sm border admin-border-accent shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">
                🚪
              </div>
              <h3 className="text-xl font-bold admin-text-primary">Apa yang ingin Anda lakukan?</h3>
              <p className="text-gray-400 text-sm mt-2">
                Pilih antara keluar sepenuhnya atau beralih ke mode Kasir untuk staf.
              </p>
            </div>

            <div className="space-y-3">
              {/* Option 1: Switch to Kasir (Lock Screen) */}
              <button
                onClick={handleAdminToKasir}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🧾
                </div>
                <div className="text-left">
                  <p className="font-bold text-white">Login Kasir</p>
                  <p className="text-xs text-gray-400">Buka layar Ganti Kasir (Lock Screen) untuk staf</p>
                </div>
              </button>

              {/* Option 2: Full Logout */}
              <button
                onClick={handleAdminFullLogout}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🔓
                </div>
                <div className="text-left">
                  <p className="font-bold text-white">Keluar Akun</p>
                  <p className="text-xs text-gray-400">Logout total, kembali ke halaman login utama</p>
                </div>
              </button>

              {/* Cancel */}
              <button
                onClick={() => setShowAdminLogoutModal(false)}
                className="w-full py-2.5 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white text-sm font-medium transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
}

export default Sidebar;
