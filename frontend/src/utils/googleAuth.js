/**
 * Google Identity Services Loader
 * 
 * Load Google Sign-In script secara dinamis
 * Docs: https://developers.google.com/identity/gsi/web/guides/client-library
 */

let isGoogleScriptLoaded = false;
let isGoogleScriptLoading = false;
const loadCallbacks = [];

export const loadGoogleScript = () => {
  return new Promise((resolve, reject) => {
    // Jika sudah loaded, resolve langsung
    if (isGoogleScriptLoaded) {
      resolve();
      return;
    }

    // Jika sedang loading, tambahkan ke callback queue
    if (isGoogleScriptLoading) {
      loadCallbacks.push({ resolve, reject });
      return;
    }

    // Mulai loading
    isGoogleScriptLoading = true;

    // Check jika script sudah ada di DOM
    const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existingScript) {
      isGoogleScriptLoaded = true;
      isGoogleScriptLoading = false;
      resolve();
      loadCallbacks.forEach(cb => cb.resolve());
      loadCallbacks.length = 0;
      return;
    }

    // Load script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      isGoogleScriptLoaded = true;
      isGoogleScriptLoading = false;
      console.log('[Google Auth] Script loaded successfully');
      resolve();
      loadCallbacks.forEach(cb => cb.resolve());
      loadCallbacks.length = 0;
    };

    script.onerror = (error) => {
      isGoogleScriptLoading = false;
      console.error('[Google Auth] Failed to load script:', error);
      reject(new Error('Failed to load Google Sign-In script'));
      loadCallbacks.forEach(cb => cb.reject(error));
      loadCallbacks.length = 0;
    };

    document.head.appendChild(script);
  });
};

/**
 * Initialize Google Sign-In dengan callback
 */
export const initializeGoogleSignIn = async (callback) => {
  try {
    await loadGoogleScript();

    if (typeof window.google === 'undefined') {
      throw new Error('Google Sign-In not available');
    }

    // Initialize dengan callback
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: callback,
      auto_select: false,
      cancel_on_tap_outside: true
    });

    console.log('[Google Auth] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[Google Auth] Initialization failed:', error);
    return false;
  }
};

/**
 * Render Google Sign-In button
 */
export const renderGoogleButton = (elementId, options = {}) => {
  if (typeof window.google === 'undefined') {
    console.error('[Google Auth] Google Sign-In not loaded');
    return;
  }

  const defaultOptions = {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width: '100%'
  };

  window.google.accounts.id.renderButton(
    document.getElementById(elementId),
    { ...defaultOptions, ...options }
  );
};
