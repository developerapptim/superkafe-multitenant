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
      console.log('[Google Auth] Script already loaded');
      resolve();
      return;
    }

    // Jika sedang loading, tambahkan ke callback queue
    if (isGoogleScriptLoading) {
      console.log('[Google Auth] Script loading in progress, queuing callback');
      loadCallbacks.push({ resolve, reject });
      return;
    }

    // Mulai loading
    isGoogleScriptLoading = true;
    console.log('[Google Auth] Starting to load script...');

    // Check jika script sudah ada di DOM
    const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existingScript) {
      console.log('[Google Auth] Script already exists in DOM');
      
      // Check if window.google is available
      if (typeof window.google !== 'undefined' && window.google.accounts) {
        isGoogleScriptLoaded = true;
        isGoogleScriptLoading = false;
        resolve();
        loadCallbacks.forEach(cb => cb.resolve());
        loadCallbacks.length = 0;
        return;
      }
      
      // Script exists but not loaded yet, wait for it
      existingScript.addEventListener('load', () => {
        isGoogleScriptLoaded = true;
        isGoogleScriptLoading = false;
        console.log('[Google Auth] Existing script loaded');
        resolve();
        loadCallbacks.forEach(cb => cb.resolve());
        loadCallbacks.length = 0;
      });
      
      existingScript.addEventListener('error', (error) => {
        isGoogleScriptLoading = false;
        console.error('[Google Auth] Existing script failed to load:', error);
        reject(new Error('Failed to load Google Sign-In script'));
        loadCallbacks.forEach(cb => cb.reject(error));
        loadCallbacks.length = 0;
      });
      
      return;
    }

    // Load script - CRITICAL: Remove crossOrigin attribute as it causes CORS issues
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    // DO NOT add crossOrigin attribute - it causes CORS blocking

    script.onload = () => {
      // Wait a bit for window.google to be available
      setTimeout(() => {
        if (typeof window.google !== 'undefined' && window.google.accounts) {
          isGoogleScriptLoaded = true;
          isGoogleScriptLoading = false;
          console.log('[Google Auth] Script loaded successfully');
          resolve();
          loadCallbacks.forEach(cb => cb.resolve());
          loadCallbacks.length = 0;
        } else {
          isGoogleScriptLoading = false;
          const error = new Error('Google Sign-In API not available after script load');
          console.error('[Google Auth]', error.message);
          reject(error);
          loadCallbacks.forEach(cb => cb.reject(error));
          loadCallbacks.length = 0;
        }
      }, 100);
    };

    script.onerror = (error) => {
      isGoogleScriptLoading = false;
      console.error('[Google Auth] Failed to load script:', error);
      const errorMsg = new Error('Failed to load Google Sign-In script. Please check your internet connection or try again later.');
      reject(errorMsg);
      loadCallbacks.forEach(cb => cb.reject(errorMsg));
      loadCallbacks.length = 0;
    };

    console.log('[Google Auth] Appending script to document head');
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
