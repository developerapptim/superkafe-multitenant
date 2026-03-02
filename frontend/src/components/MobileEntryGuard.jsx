import { Navigate } from 'react-router-dom';
import usePlatform from '../hooks/usePlatform';
import LandingPage from '../pages/LandingPage';

const ONBOARDING_KEY = 'hasSeenOnboarding';

/**
 * MobileEntryGuard
 *
 * Controls what the user sees at the root "/" route:
 *
 * - Web browser:        → Shows LandingPage as usual (no change)
 * - Mobile (APK), first open:    → Redirects to /onboarding
 * - Mobile (APK), returning user: → Redirects directly to /auth/login
 */
const MobileEntryGuard = () => {
    const { isNative } = usePlatform();

    // Web users always see the Landing Page
    if (!isNative) {
        return <LandingPage />;
    }

    // Mobile: check if onboarding was already completed
    const hasSeenOnboarding = localStorage.getItem(ONBOARDING_KEY);

    if (hasSeenOnboarding) {
        // Returning mobile user → go directly to login
        return <Navigate to="/auth/login" replace />;
    }

    // First-time mobile user → show onboarding
    return <Navigate to="/onboarding" replace />;
};

export default MobileEntryGuard;
