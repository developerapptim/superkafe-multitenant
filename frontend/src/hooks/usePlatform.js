import { Capacitor } from '@capacitor/core';

/**
 * usePlatform Hook
 *
 * Detects whether the app is running as a native mobile app (APK)
 * or as a standard web browser session.
 *
 * Usage:
 *   const { isNative, isWeb } = usePlatform();
 */
const usePlatform = () => {
    const isNative = Capacitor.isNativePlatform();
    const isWeb = !isNative;

    return { isNative, isWeb };
};

export default usePlatform;
