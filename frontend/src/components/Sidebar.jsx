import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import useSWR from 'swr';
import api from '../services/api';
import toast from 'react-hot-toast';

// Fetcher
const fetcher = url => api.get(url).then(res => res.data);

// Menu items with access keys for role_access array filtering
const menuItems = [
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
];

function Sidebar({ onLogout }) {
  // Safe User Parsing
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch (err) {
    console.error('Error parsing user data:', err);
  }
  const userRole = user?.role || 'staf';
  const userRoleAccess = user?.role_access || [];
  console.log('Sidebar User:', user, 'Role:', userRole, 'Access:', userRoleAccess);
  const location = useLocation();
  const [expanded, setExpanded] = useState({ settings: true });

  // Filter items based on role_access array
  // Admin (role_access: ['*']) has full access
  // Staf has limited access based on their role_access array
  const filteredItems = menuItems.filter(item => {
    // 1. Safe Navigation: Check user existence
    if (!user) return false;

    // 2. Admin/Owner Bypass
    if (userRole === 'admin' || userRole === 'owner' || userRoleAccess?.includes('*')) {
      return true;
    }

    // 3. Granular Access Check (using Optional Chaining)
    if (item.access && userRoleAccess?.includes(item.access)) {
      return true;
    }

    // 4. Role Restriction for specific items
    if (item.roles && !item.roles.includes(userRole)) {
      return false;
    }

    // 5. Default Access (Public)
    if (!item.roles && !item.access) {
      return true;
    }

    return false;
  });

  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [endCash, setEndCash] = useState('');
  const { data: currentShift } = useSWR('/shifts/current', fetcher);

  const handleLogoutClick = () => {
    // Admin/Owner Bypass: Don't show "Close Shift" popup
    if ((userRole === 'admin' || userRole === 'owner') && currentShift) {
      onLogout();
      return;
    }

    if (currentShift) {
      setShowCloseShiftModal(true);
    } else {
      onLogout();
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    try {
      await api.put('/shifts/close', {
        endCash: Number(endCash)
      });
      toast.success('Shift ditutup. Sampai jumpa!');
      onLogout();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menutup shift');
    }
  };



  const toggleExpand = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <aside
      id="sidebar"
      className="h-full w-full bg-[#1E1B4B]/95 backdrop-blur-xl border-r border-purple-500/20 flex flex-col transition-all duration-300 shadow-2xl"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-center lg:justify-start px-2 lg:px-4 border-b border-purple-500/30 bg-[#151235]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold shrink-0">
            WS
          </div>
          <div className="hidden lg:block overflow-hidden">
            <h1 className="font-bold text-white text-sm whitespace-nowrap">Admin Panel</h1>
            <p className="text-xs text-gray-400 whitespace-nowrap">
              {userRole === 'admin' || userRole === 'owner' ? 'Administrator' :
                userRole === 'staf' ? 'Staf Server' : 'Kasir'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        <ul className="space-y-1 px-2">
          {filteredItems.map((item) => {
            // Removed redundant check that caused crash (item.roles is undefined now)
            // if (!item.roles?.includes(userRole)) return null;

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
                      <span className="hidden lg:block text-sm font-medium whitespace-nowrap">{item.label}</span>
                    </div>
                    <span className="hidden lg:block text-xs opacity-50">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Submenu */}
                  {isExpanded && (
                    <ul className="mt-1 space-y-1 pl-0 lg:pl-4 bg-black/20 rounded-lg lg:bg-transparent p-1 lg:p-0">
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
                            {/* Small dot for submenu items on desktop */}
                            <span className="hidden lg:block w-1.5 h-1.5 rounded-full bg-current opacity-50"></span>
                            <span className="hidden lg:block truncate">{child.label}</span>
                            {/* Mobile: Show first letter or full label? Mobile sidebar is 16px (w-16), so hidden lg:block hides text. 
                                 For mobile submenu, maybe just show Icon if available or simple dot? 
                                 Current simple sidebar hides text on mobile. Submenu on mobile w-16 is tricky. 
                                 Let's keep it simple: On mobile, expanding shows children but they have no icon, so they might be invisible text?
                                 Wait, the parent logic: <span className="hidden lg:block ...">{item.label}</span>
                                 So on mobile, only Icon is visible.
                                 For children, I didn't verify mobile view. 
                                 Let's add a small icon/char for children on mobile.
                             */}
                            <span className="lg:hidden text-[10px]">{child.label.substring(0, 2)}</span>
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
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-2 lg:px-3 py-3 rounded-lg transition-colors duration-200 ${isActive
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    } justify-center lg:justify-start`
                  }
                  title={item.label}
                >
                  <span className="text-lg lg:text-xl shrink-0 leading-none">{item.icon}</span>
                  <span className="hidden lg:block text-sm font-medium whitespace-nowrap">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-purple-500/30 bg-[#151235]">
        <button
          onClick={handleLogoutClick}
          className="w-full flex items-center gap-3 px-2 lg:px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors justify-center lg:justify-start"
          title="Keluar"
        >
          <span className="text-lg lg:text-xl leading-none">🚪</span>
          <span className="hidden lg:block text-sm font-medium">Keluar</span>
        </button>
      </div>

      {/* Close Shift Modal - Using Portal to escape Sidebar constraints */}
      {showCloseShiftModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1E1B4B] p-6 rounded-2xl w-full max-w-sm border border-purple-500/30 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-4 text-white">Tutup Shift & Keluar</h3>
            <p className="text-gray-400 text-sm mb-4">Masukkan total uang tunai di laci saat ini.</p>

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Uang Tunai (Cash)</label>
                <input
                  type="number"
                  value={endCash}
                  onChange={(e) => setEndCash(e.target.value)}
                  className="w-full px-4 py-2 mt-1 rounded bg-white/10 border border-purple-500/30 text-white focus:outline-none focus:border-purple-500"
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
    </aside>
  );
}

export default Sidebar;
