import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

/**
 * Idle Context - Auto-lock system untuk keamanan shared tablet
 * Auto-logout setelah 5 menit tidak ada aktivitas
 */

const IdleContext = createContext();

export const useIdle = () => {
  const context = useContext(IdleContext);
  if (!context) {
    throw new Error('useIdle must be used within IdleProvider');
  }
  return context;
};

export const IdleProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isIdle, setIsIdle] = useState(false);
  const [idleTime, setIdleTime] = useState(0);

  // Idle timeout: 3 jam (10800000 ms)
  const IDLE_TIMEOUT = 3 * 60 * 60 * 1000;

  // Warning timeout: 2 jam 59 menit 30 detik (10770000 ms) - 30 detik sebelum auto-lock
  const WARNING_TIMEOUT = IDLE_TIMEOUT - (30 * 1000);

  const resetIdleTimer = useCallback(() => {
    setIdleTime(0);
    setIsIdle(false);
  }, []);

  const handleAutoLock = useCallback(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const tenantSlug = localStorage.getItem('tenant_slug');
    const isPersonalDevice = localStorage.getItem('isPersonalDevice') === 'true';

    // Auto-lock berlaku jika bukan Master Role ATAU bukan Personal Device
    const isMasterRole = ['admin', 'owner'].includes(user.role);
    const shouldLock = !(isMasterRole && isPersonalDevice);

    if (shouldLock && tenantSlug) {
      console.log('[AUTO-LOCK] Locking device due to inactivity');

      // Clear token tapi keep tenant_slug untuk device binding
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      toast.error('Sesi berakhir karena tidak ada aktivitas');

      // Redirect ke device login
      navigate('/auth/device-login', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    // Skip auto-lock di halaman auth
    const isAuthPage = location.pathname.startsWith('/auth') || location.pathname === '/';
    if (isAuthPage) {
      return;
    }

    // Skip auto-lock jika tidak ada user
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) {
      return;
    }

    // Skip auto-lock mutlak jika ini adalah Personal Device milik Owner/Admin
    const isMasterRole = ['admin', 'owner'].includes(user.role);
    const isPersonalDevice = localStorage.getItem('isPersonalDevice') === 'true';

    if (isMasterRole && isPersonalDevice) {
      return;
    }

    let idleTimer;
    let warningTimer;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    const resetTimers = () => {
      clearTimeout(idleTimer);
      clearTimeout(warningTimer);
      resetIdleTimer();

      // Set warning timer (30 detik sebelum auto-lock)
      warningTimer = setTimeout(() => {
        toast('Tidak ada aktivitas. Akan auto-lock dalam 30 detik...', {
          icon: '⚠️',
          duration: 5000
        });
      }, WARNING_TIMEOUT);

      // Set idle timer
      idleTimer = setTimeout(() => {
        setIsIdle(true);
        handleAutoLock();
      }, IDLE_TIMEOUT);
    };

    // Attach event listeners
    events.forEach((event) => {
      window.addEventListener(event, resetTimers);
    });

    // Initialize timers
    resetTimers();

    // Cleanup
    return () => {
      clearTimeout(idleTimer);
      clearTimeout(warningTimer);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimers);
      });
    };
  }, [location.pathname, handleAutoLock, resetIdleTimer]);

  const value = {
    isIdle,
    resetIdleTimer
  };

  return <IdleContext.Provider value={value}>{children}</IdleContext.Provider>;
};
