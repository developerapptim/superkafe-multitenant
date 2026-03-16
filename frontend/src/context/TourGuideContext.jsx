import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { driver } from 'driver.js';
import confetti from 'canvas-confetti';
import api from '../services/api';
import '../styles/TourGuide.css';

const TourGuideContext = createContext(null);

// =========================================
// Tour Steps Configuration
// All selectors MUST point to elements that are always in the DOM
// (i.e. buttons, sections — NOT modals or conditional elements)
// =========================================
const TOUR_STEPS = [
  {
    id: 'profil-usaha',
    page: 'pengaturan',
    accordion: 'profile',
    selector: '#tour-profil-usaha',
    title: '🏪 Langkah 1: Profil Usaha',
    description: 'Selamat datang! Mari lengkapi identitas kafemu. Upload logo dan nama usaha agar struk belanja dan halaman order pelanggan terlihat profesional.',
  },
  {
    id: 'aturan-kasir',
    page: 'pengaturan',
    accordion: 'payment',
    selector: '#tour-pembayaran-kasir',
    title: '💳 Langkah 2: Aturan Kasir',
    description: 'Tentukan alur kerjamu. Pilih apakah pelanggan \'Wajib Bayar Dulu\' sebelum pesanan diproses atau tidak. Ini akan menentukan cara kasirmu bekerja.',
  },
  {
    id: 'tambah-menu',
    page: 'menu',
    selector: '#tour-tambah-menu',
    title: '🍽️ Langkah 3: Menambahkan Menu',
    description: 'Klik tombol ini untuk membuat daftar produk yang ingin kamu jual (misal: Kopi Susu). Isi nama menu, kategori, dan harga jualnya.',
  },
  {
    id: 'tambah-bahan',
    page: 'inventaris',
    selector: '#tour-tambah-bahan',
    title: '📦 Langkah 4: Menambahkan Bahan',
    description: 'Klik tombol ini untuk memasukkan bahan baku (misal: Susu UHT). Masukkan harga beli dan satuan agar SuperKafe bisa menghitung Harga Modal Dasar secara otomatis.',
  },
  {
    id: 'gramasi',
    page: 'gramasi',
    selector: '#tour-tambah-gramasi',
    title: '⚖️ Langkah 5: Resep Menu & HPP',
    description: 'Hubungkan Menu dengan Bahan. Masukkan takaran bahan per menu (misal: 200ml susu per gelas kopi). SuperKafe otomatis menghitung profit dan memotong stok setiap kali menu terjual!',
  },
  {
    id: 'marketing',
    page: 'marketing',
    selector: '#tour-tambah-voucher',
    title: '📢 Langkah 6: Pusat Marketing',
    description: 'Tarik perhatian pelanggan dengan Banner Promo dan Voucher. Ini akan tampil di halaman menu digital yang dilihat pelanggan saat scan QR.',
  },
  {
    id: 'meja',
    page: 'meja',
    selector: '#tour-tambah-meja',
    title: '🪑 Langkah 7: Manajemen Meja',
    description: 'Daftarkan meja kafemu dan download QR Code-nya. Pelanggan cukup scan dari meja untuk memesan!',
  },
  {
    id: 'notifikasi',
    page: 'pengaturan',
    accordion: 'notification',
    selector: '#tour-notifikasi',
    title: '🔔 Langkah 8: Setup Notifikasi',
    description: 'Upload suara notifikasi agar kamu dengar setiap ada orderan masuk. Kamu bisa test suaranya langsung dari sini!',
  },
  {
    id: 'kasir',
    page: 'kasir',
    selector: '#tour-tambah-pesanan',
    title: '🧾 Langkah 9: Simulasi Kasir',
    description: 'Coba buat pesanan pertama kamu secara manual untuk melihat bagaimana semua data yang sudah dimasukkan tadi bekerja bersama. Selamat, kafemu siap beroperasi! 🎉',
  },
];

// =========================================
// Utility: Poll for an element in the DOM
// Retries every intervalMs until found or maxWaitMs exceeded
// =========================================
function waitForElement(selector, maxWaitMs = 12000, intervalMs = 300) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const startTime = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        resolve(el);
      } else if (Date.now() - startTime > maxWaitMs) {
        clearInterval(timer);
        console.warn(`[TourGuide] waitForElement timeout: ${selector} not found after ${maxWaitMs}ms`);
        resolve(null);
      }
    }, intervalMs);
  });
}

// =========================================
// TourGuide Provider Component
// =========================================
export function TourGuideProvider({ children, tenantId, tenantSlug, isReady = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isTourActive, setIsTourActive] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(true); // default true to avoid flash
  const [tourStatusRetrieved, setTourStatusRetrieved] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const driverRef = useRef(null);
  const tourStepsRef = useRef(TOUR_STEPS);
  const pendingStepRef = useRef(null);

  // Get User Role to disable tour for staff
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = user?.role || 'admin';
  const isAdmin = userRole === 'admin';

  // =========================================
  // Refs to break circular dependency
  // goToStepRef is used inside executeStep so we never have a stale closure
  // =========================================
  const goToStepRef = useRef(null);
  const executeStepRef = useRef(null);
  const skipTourRef = useRef(null);
  const completeTourRef = useRef(null);

  // Check tour status on mount
  useEffect(() => {
    if (!tenantId) return;
    
    // If not admin, instantly mark as completed so tour never tries to load
    if (!isAdmin) {
      setTourStatusRetrieved(true);
      setHasCompletedTour(true);
      return;
    }

    const fetchTourStatus = async () => {
      try {
        const res = await api.get(`/tenants/${tenantId}/tour-status`);
        const completed = res.data.hasCompletedTour;
        setTourStatusRetrieved(completed);
        setHasCompletedTour(completed);
      } catch (error) {
        console.error('[TourGuide] Failed to check tour status:', error);
        setHasCompletedTour(true); // fail-safe
        setTourStatusRetrieved(true);
      }
    };
    fetchTourStatus();
  }, [tenantId, isAdmin]);

  // Trigger welcome popup only once per session for users who haven't completed the tour
  useEffect(() => {
    if (tourStatusRetrieved === false && isReady && !hasCompletedTour && !sessionStorage.getItem('tourWelcomeShown')) {
      const timer = setTimeout(() => {
        setShowWelcome(true);
        sessionStorage.setItem('tourWelcomeShown', 'true');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [tourStatusRetrieved, isReady, hasCompletedTour]);

  // Get the current admin base path
  const getAdminPath = useCallback((page) => {
    return `/${tenantSlug}/admin/${page}`;
  }, [tenantSlug]);

  // Determine current admin page from location
  const getCurrentPage = useCallback(() => {
    const match = location.pathname.match(/\/admin\/([^/]+)/);
    return match ? match[1] : '';
  }, [location.pathname]);

  // Fire confetti celebration
  const fireConfetti = useCallback(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#8B5CF6', '#6D28D9', '#A78BFA', '#DDD6FE', '#F59E0B'],
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#8B5CF6', '#6D28D9', '#A78BFA', '#DDD6FE', '#F59E0B'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  // Complete the tour
  const completeTour = useCallback(async () => {
    setIsTourActive(false);
    setCurrentStepIndex(0);
    setIsNavigating(false);
    fireConfetti();

    if (driverRef.current) {
      try { driverRef.current.destroy(); } catch (e) { /* ignore */ }
      driverRef.current = null;
    }

    if (tenantId) {
      try {
        await api.put(`/tenants/${tenantId}/tour-status`, { hasCompletedTour: true });
        setHasCompletedTour(true);
      } catch (error) {
        console.error('[TourGuide] Failed to save tour completion:', error);
      }
    }
  }, [tenantId, fireConfetti]);

  // Skip / close tour  
  const skipTour = useCallback(async () => {
    setShowWelcome(false);
    setIsTourActive(false);
    setCurrentStepIndex(0);
    setIsNavigating(false);

    if (driverRef.current) {
      try { driverRef.current.destroy(); } catch (e) { /* ignore */ }
      driverRef.current = null;
    }

    if (tenantId) {
      try {
        await api.put(`/tenants/${tenantId}/tour-status`, { hasCompletedTour: true });
        setHasCompletedTour(true);
      } catch (error) {
        console.error('[TourGuide] Failed to save tour skip:', error);
      }
    }
  }, [tenantId]);

  // Dispatch a custom event to open accordions on target pages
  const dispatchTourAction = useCallback((step) => {
    if (step.accordion) {
      window.dispatchEvent(new CustomEvent('tour:open-accordion', { detail: { section: step.accordion } }));
    }
  }, []);

  // =========================================
  // Core step execution logic
  // Uses refs to avoid stale closures
  // =========================================
  const executeStep = useCallback(async (stepIndex) => {
    const step = tourStepsRef.current[stepIndex];
    if (!step) return;

    // Clear navigating state
    setIsNavigating(false);
    setCurrentStepIndex(stepIndex);

    // Dispatch accordion open action first
    dispatchTourAction(step);

    // Small delay to let React re-render the accordion before polling
    await new Promise(r => setTimeout(r, 150));

    // Use polling to wait for the element (handles SWR loading, accordion animation, etc.)
    const el = await waitForElement(step.selector, 12000, 300);

    if (!el) {
      console.error(`[TourGuide] Element not found after polling: ${step.selector}, skipping step ${stepIndex}`);
      // Skip to next step using ref to avoid stale closure
      if (stepIndex < tourStepsRef.current.length - 1) {
        setTimeout(() => {
          if (goToStepRef.current) goToStepRef.current(stepIndex + 1);
        }, 200);
      } else {
        if (completeTourRef.current) completeTourRef.current();
      }
      return;
    }

    // Scroll element into view gently
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) { /* ignore */ }

    // Small delay after scrolling
    await new Promise(r => setTimeout(r, 200));

    // Destroy existing driver instance
    if (driverRef.current) {
      try { driverRef.current.destroy(); } catch (e) { /* ignore */ }
      driverRef.current = null;
    }

    const isLastStep = stepIndex === tourStepsRef.current.length - 1;
    const isFirstStep = stepIndex === 0;
    const totalSteps = tourStepsRef.current.length;

    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      progressText: `Langkah {{current}} dari {{total}}`,
      allowInteraction: true,
      steps: [
        {
          element: step.selector,
          popover: {
            title: step.title,
            description: step.description,
            side: 'bottom',
            align: 'start',
            nextBtnText: isLastStep ? '🎉 Selesai!' : 'Lanjut →',
            prevBtnText: '← Kembali',
            doneBtnText: '🎉 Selesai!',
            showButtons: isFirstStep
              ? ['next', 'close']
              : ['next', 'previous', 'close'],
            onNextClick: () => {
              try {
                driverObj.destroy();
              } catch (e) { /* ignore */ }
              driverRef.current = null;
              if (isLastStep) {
                if (completeTourRef.current) completeTourRef.current();
              } else {
                // Use ref to always call the latest goToStep
                setTimeout(() => {
                  if (goToStepRef.current) goToStepRef.current(stepIndex + 1);
                }, 50);
              }
            },
            onPrevClick: () => {
              try {
                driverObj.destroy();
              } catch (e) { /* ignore */ }
              driverRef.current = null;
              // Use ref to always call the latest goToStep
              setTimeout(() => {
                if (goToStepRef.current) goToStepRef.current(stepIndex - 1);
              }, 50);
            },
            onCloseClick: () => {
              try {
                driverObj.destroy();
              } catch (e) { /* ignore */ }
              driverRef.current = null;
              if (skipTourRef.current) skipTourRef.current();
            },
          },
        },
      ],
      onDestroyStarted: () => {
        // Don't call destroy again if triggered by our code
      },
    });

    driverObj.drive(0);
    driverRef.current = driverObj;

    // Update progress text manually
    setTimeout(() => {
      const progressEl = document.querySelector('.driver-popover-progress-text');
      if (progressEl) {
        progressEl.textContent = `Langkah ${stepIndex + 1} dari ${totalSteps}`;
      }
    }, 100);
  }, [dispatchTourAction]);

  // Navigate to a step's page and execute it
  const goToStep = useCallback((stepIndex) => {
    if (stepIndex < 0 || stepIndex >= tourStepsRef.current.length) return;

    const step = tourStepsRef.current[stepIndex];
    const currentPage = getCurrentPage();
    const targetPath = getAdminPath(step.page);

    if (currentPage !== step.page) {
      // Need to navigate to a different page
      setIsNavigating(true);
      pendingStepRef.current = stepIndex;
      navigate(targetPath);
    } else {
      // Same page — execute step directly
      // For accordion steps on the same page, we still need a small delay
      // so the accordion event can be processed
      executeStep(stepIndex);
    }
  }, [getCurrentPage, getAdminPath, navigate, executeStep]);

  // =========================================
  // Keep refs up to date with latest function references
  // This is the key fix for stale closures
  // =========================================
  useEffect(() => {
    goToStepRef.current = goToStep;
  }, [goToStep]);

  useEffect(() => {
    executeStepRef.current = executeStep;
  }, [executeStep]);

  useEffect(() => {
    skipTourRef.current = skipTour;
  }, [skipTour]);

  useEffect(() => {
    completeTourRef.current = completeTour;
  }, [completeTour]);

  // Watch for route changes to execute pending steps
  useEffect(() => {
    let timeoutId;
    if (pendingStepRef.current !== null && isTourActive) {
      const stepIndex = pendingStepRef.current;
      pendingStepRef.current = null;
      // Use executeStepRef to avoid stale closure  
      timeoutId = setTimeout(() => {
        if (executeStepRef.current) executeStepRef.current(stepIndex);
      }, 400);
    }

    // Safety fallback: if isNavigating is stuck for more than 10 seconds, clear it
    let stuckTimeoutId;
    if (isNavigating) {
      stuckTimeoutId = setTimeout(() => {
        console.warn('[TourGuide] Navigation stuck for 10s, clearing navigation state.');
        setIsNavigating(false);
      }, 10000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (stuckTimeoutId) clearTimeout(stuckTimeoutId);
    };
  }, [location.pathname, isTourActive, isNavigating]);

  // Start the tour
  const startTour = useCallback(() => {
    setShowWelcome(false);
    setIsTourActive(true);
    setCurrentStepIndex(0);
    // Navigate to first step's page
    // Use setTimeout to ensure state is set before navigating
    setTimeout(() => {
      if (goToStepRef.current) goToStepRef.current(0);
    }, 50);
  }, []);

  // Reset tour (for "Tour Guide Aplikasi" button)
  const resetTour = useCallback(async () => {
    // Clear session flag so welcome can show again
    sessionStorage.removeItem('tourWelcomeShown');

    if (tenantId) {
      try {
        await api.put(`/tenants/${tenantId}/tour-status`, { hasCompletedTour: false });
        setHasCompletedTour(false);
      } catch (error) {
        console.error('[TourGuide] Failed to reset tour:', error);
      }
    }
    setCurrentStepIndex(0);
    setIsTourActive(true);
    // Use setTimeout + ref to ensure state is set
    setTimeout(() => {
      if (goToStepRef.current) goToStepRef.current(0);
    }, 50);
  }, [tenantId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        try { driverRef.current.destroy(); } catch (e) { /* ignore */ }
      }
    };
  }, []);

  const value = {
    isTourActive,
    showWelcome,
    currentStepIndex,
    hasCompletedTour,
    isNavigating,
    totalSteps: TOUR_STEPS.length,
    startTour,
    skipTour,
    completeTour,
    resetTour,
    setShowWelcome,
  };

  return (
    <TourGuideContext.Provider value={value}>
      {children}

      {/* Welcome Modal */}
      {showWelcome && (
        <div className="tour-welcome-overlay">
          <div className="tour-welcome-card">
            <div className="tour-welcome-emoji">🚀</div>
            <h2 className="tour-welcome-title">Selamat Datang di SuperKafe!</h2>
            <p className="tour-welcome-desc">
              Kami akan memandu kamu menyiapkan kafemu dalam 9 langkah mudah.
              Tour ini akan mengajarimu cara setup menu, stok bahan, hingga kasir.
              <br /><br />
              <strong>⏱️ Hanya butuh 5 menit!</strong>
            </p>
            <button className="tour-welcome-start-btn" onClick={startTour}>
              🎯 Mulai Tour Sekarang
            </button>
            <button className="tour-welcome-skip-btn" onClick={skipTour}>
              Lewati, saya sudah familiar
            </button>
          </div>
        </div>
      )}

      {/* Navigating indicator */}
      {isNavigating && (
        <div className="fixed inset-0 z-[99997] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            <p className="text-purple-300 text-sm font-medium">Berpindah halaman...</p>
          </div>
        </div>
      )}
    </TourGuideContext.Provider>
  );
}

export function useTourGuide() {
  const ctx = useContext(TourGuideContext);
  if (!ctx) {
    // Return inert object instead of throwing, since some pages may render outside TourGuideProvider
    return {
      isTourActive: false,
      showWelcome: false,
      currentStepIndex: 0,
      hasCompletedTour: true,
      isNavigating: false,
      totalSteps: 0,
      startTour: () => {},
      skipTour: () => {},
      completeTour: () => {},
      resetTour: () => {},
      setShowWelcome: () => {},
    };
  }
  return ctx;
}

export default TourGuideContext;
