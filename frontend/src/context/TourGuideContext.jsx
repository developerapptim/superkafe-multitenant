import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { driver } from 'driver.js';
import confetti from 'canvas-confetti';
import api from '../services/api';
import '../styles/TourGuide.css';

const TourGuideContext = createContext(null);

// =========================================
// Tour Steps Configuration
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
    description: 'Pertama, buatlah daftar produk yang ingin kamu jual (misal: Kopi Susu). Isi nama menu, kategori, dan harga jualnya di sini.',
    action: 'open-menu-modal',
  },
  {
    id: 'tambah-bahan',
    page: 'inventaris',
    selector: '#tour-tambah-bahan',
    title: '📦 Langkah 4: Menambahkan Bahan',
    description: 'Langkah terpenting: Masukkan bahan bakumu. Mari kita coba masukkan Susu UHT.',
    action: 'open-bahan-modal',
    autoFill: {
      name: 'Susu UHT',
      price: 16000,
      buyUnit: 'pcs',
      contentPerUnit: 950,
      productionUnit: 'ml',
    },
  },
  {
    id: 'hpp-result',
    page: 'inventaris',
    selector: '#tour-hpp-result',
    title: '📊 Harga Modal Dasar',
    description: '🎯 Perhatikan hasil "Harga Modal Dasar (Rp 16,84/ml)" — ini adalah kunci akurasi profit kamu! Setiap menu yang menggunakan susu akan dihitung berdasarkan harga per ml ini.',
  },
  {
    id: 'gramasi',
    page: 'gramasi',
    selector: '#tour-gramasi',
    title: '⚖️ Langkah 5: Resep Menu & HPP',
    description: 'Inilah bagian tercanggihnya! Hubungkan Menu dengan Bahan. Masukkan berapa ml susu yang digunakan untuk satu gelas kopi. SuperKafe akan langsung menampilkan Profit Bersih kamu! Sistem otomatis memotong stok dan menghitung profit setiap kali menu ini terjual.',
  },
  {
    id: 'marketing',
    page: 'marketing',
    selector: '#tour-marketing',
    title: '📢 Langkah 6: Pusat Marketing',
    description: 'Tarik perhatian pelanggan dengan Banner Promo. Banner ini akan tampil di halaman menu digital yang dilihat pelanggan saat mereka scan QR.',
  },
  {
    id: 'meja',
    page: 'meja',
    selector: '#tour-meja',
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
    selector: '#tour-kasir',
    title: '🧾 Langkah 9: Simulasi Kasir',
    description: 'Coba buat pesanan pertama kamu secara manual untuk melihat bagaimana semua data yang sudah dimasukkan tadi bekerja bersama. Selamat, kafemu siap beroperasi! 🎉',
  },
];

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

  // Check tour status on mount
  useEffect(() => {
    if (!tenantId) return;
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
  }, [tenantId]);

  // Trigger welcome popup only when status is retrieved and parent signals readiness (e.g. no blocking popups)
  useEffect(() => {
    if (tourStatusRetrieved === false && isReady && !hasCompletedTour) {
      // Small delay so UI renders first
      const timer = setTimeout(() => setShowWelcome(true), 800);
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
    fireConfetti();

    if (tenantId) {
      try {
        await api.put(`/tenants/${tenantId}/tour-status`, { hasCompletedTour: true });
        setHasCompletedTour(true);
      } catch (error) {
        console.error('[TourGuide] Failed to save tour completion:', error);
      }
    }
  }, [tenantId, fireConfetti]);

  // Dispatch a custom event to open accordions or modals on target pages
  const dispatchTourAction = useCallback((step) => {
    if (step.accordion) {
      window.dispatchEvent(new CustomEvent('tour:open-accordion', { detail: { section: step.accordion } }));
    }
    if (step.action) {
      window.dispatchEvent(new CustomEvent('tour:action', { detail: { action: step.action, autoFill: step.autoFill } }));
    }
  }, []);

  // Execute a specific tour step using driver.js
  const executeStep = useCallback((stepIndex) => {
    const step = tourStepsRef.current[stepIndex];
    if (!step) return;

    setCurrentStepIndex(stepIndex);

    // Dispatch actions first (open accordion, modal, etc.)
    dispatchTourAction(step);

    // Wait for DOM to settle after accordion/modal opens
    const delay = step.accordion || step.action ? 600 : 200;

    const initDriverObj = (stepIndex, step) => {
      // Destroy existing driver instance
      if (driverRef.current) {
        try { driverRef.current.destroy(); } catch (e) { /* ignore */ }
      }

      const isLastStep = stepIndex === tourStepsRef.current.length - 1;
      const isFirstStep = stepIndex === 0;
      const totalSteps = tourStepsRef.current.length;

      const driverObj = driver({
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        progressText: `Langkah {{current}} dari {{total}}`,
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
                driverObj.destroy();
                if (isLastStep) {
                  completeTour();
                } else {
                  goToStep(stepIndex + 1);
                }
              },
              onPrevClick: () => {
                driverObj.destroy();
                goToStep(stepIndex - 1);
              },
              onCloseClick: () => {
                driverObj.destroy();
                skipTour();
              },
            },
          },
        ],
        onDestroyStarted: () => {
          // Don't call destroy again if triggered by our code
        },
      });

      // Override progress text after creation
      driverObj.drive(0);
      driverRef.current = driverObj;

      // Update progress text manually
      setTimeout(() => {
        const progressEl = document.querySelector('.driver-popover-progress-text');
        if (progressEl) {
          progressEl.textContent = `Langkah ${stepIndex + 1} dari ${totalSteps}`;
        }
      }, 50);
    };

    setTimeout(() => {
      const el = document.querySelector(step.selector);
      if (!el) {
        // Log warning and retry once after a delay if first try fails.
        // It could be that the modal hasn't finished rendering yet.
        console.warn(`[TourGuide] Element not found: ${step.selector}, trying one more time in 800ms...`);
        setTimeout(() => {
          const retryEl = document.querySelector(step.selector);
          if (!retryEl) {
            console.error(`[TourGuide] Retry failed. Element still not found: ${step.selector}, skipping step ${stepIndex}`);
            // Try next step
            if (stepIndex < tourStepsRef.current.length - 1) {
              executeStep(stepIndex + 1);
            } else {
              completeTour();
            }
          } else {
             initDriverObj(stepIndex, step);
          }
        }, 800);
        return;
      }
      initDriverObj(stepIndex, step);
    }, delay);
  }, [dispatchTourAction, completeTour]);

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
      // Same page, execute step directly
      executeStep(stepIndex);
    }
  }, [getCurrentPage, getAdminPath, navigate, executeStep]);

  // Watch for route changes to execute pending steps
  useEffect(() => {
    if (pendingStepRef.current !== null && isTourActive) {
      const stepIndex = pendingStepRef.current;
      pendingStepRef.current = null;
      setIsNavigating(false);
      // Wait for page to render (increased delay to 800ms to ensure the page is fully loaded before executing the step)
      setTimeout(() => executeStep(stepIndex), 800);
    }
  }, [location.pathname, isTourActive, executeStep]);

  // Start the tour
  const startTour = useCallback(() => {
    setShowWelcome(false);
    setIsTourActive(true);
    setCurrentStepIndex(0);
    // Navigate to first step's page
    goToStep(0);
  }, [goToStep]);

  // Skip / close tour  
  const skipTour = useCallback(async () => {
    setShowWelcome(false);
    setIsTourActive(false);
    setCurrentStepIndex(0);

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

  // Reset tour (for "Tour Guide Aplikasi" button)
  const resetTour = useCallback(async () => {
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
    goToStep(0);
  }, [tenantId, goToStep]);

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
