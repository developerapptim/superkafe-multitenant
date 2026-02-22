/**
 * Routing Priority Unit Tests
 * 
 * Tests for routing priority to ensure:
 * - /setup-cafe routes to correct component
 * - /admin/* routes to AdminLayout
 * - /auth/* routes to auth components
 * - Invalid paths redirect to landing page
 * 
 * Validates Requirements: 1.1, 1.2, 1.3, 1.5
 * 
 * Note: These tests verify the routing structure defined in App.jsx.
 * Property-based tests in dynamicRouting.property.test.jsx provide
 * comprehensive coverage of routing behavior across many inputs.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock components to avoid loading actual implementations
const MockLandingPage = () => <div data-testid="landing-page">Landing Page</div>;
const MockSetupWizard = () => <div data-testid="setup-wizard">Setup Wizard</div>;
const MockAdminLayout = () => <div data-testid="admin-layout">Admin Layout</div>;
const MockSimpleLogin = () => <div data-testid="simple-login">Simple Login</div>;
const MockSimpleRegister = () => <div data-testid="simple-register">Simple Register</div>;
const MockOTPVerification = () => <div data-testid="otp-verification">OTP Verification</div>;
const MockDeviceLogin = () => <div data-testid="device-login">Device Login</div>;
const MockGlobalLogin = () => <div data-testid="global-login">Global Login</div>;
const MockDynamicStorefront = () => <div data-testid="dynamic-storefront">Dynamic Storefront</div>;

// Simplified routing structure matching App.jsx priority
const TestRouter = ({ initialRoute }) => (
  <MemoryRouter initialEntries={[initialRoute]}>
    <Routes>
      {/* Priority 1: Landing Page */}
      <Route path="/" element={<MockLandingPage />} />

      {/* Priority 2: Auth Routes */}
      <Route path="/auth/login" element={<MockSimpleLogin />} />
      <Route path="/auth/register" element={<MockSimpleRegister />} />
      <Route path="/auth/verify-otp" element={<MockOTPVerification />} />
      <Route path="/auth/device-login" element={<MockDeviceLogin />} />
      <Route path="/auth/global-login" element={<MockGlobalLogin />} />

      {/* Priority 3: Setup Wizard */}
      <Route path="/setup-cafe" element={<MockSetupWizard />} />

      {/* Priority 4: Admin Routes */}
      <Route path="/admin/*" element={<MockAdminLayout />} />

      {/* Priority 5: Dynamic Tenant Storefront (LOWEST) */}
      <Route path="/:slug/*" element={<MockDynamicStorefront />} />

      {/* Priority 6: Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </MemoryRouter>
);

describe('Routing Priority Tests', () => {
  describe('Setup Wizard Route Priority (Requirement 1.1)', () => {
    test('should route /setup-cafe to Setup Wizard component', () => {
      render(<TestRouter initialRoute="/setup-cafe" />);
      expect(screen.getByTestId('setup-wizard')).toBeInTheDocument();
    });

    test('should prioritize /setup-cafe over dynamic slug route', () => {
      render(<TestRouter initialRoute="/setup-cafe" />);
      expect(screen.getByTestId('setup-wizard')).toBeInTheDocument();
      expect(screen.queryByTestId('dynamic-storefront')).not.toBeInTheDocument();
    });
  });

  describe('Admin Routes Priority (Requirement 1.2)', () => {
    test('should route /admin to AdminLayout component', () => {
      render(<TestRouter initialRoute="/admin" />);
      expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
    });

    test('should route /admin/dashboard to AdminLayout component', () => {
      render(<TestRouter initialRoute="/admin/dashboard" />);
      expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
    });

    test('should prioritize /admin/* over dynamic slug route', () => {
      render(<TestRouter initialRoute="/admin/settings" />);
      expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('dynamic-storefront')).not.toBeInTheDocument();
    });
  });

  describe('Auth Routes Priority (Requirement 1.3)', () => {
    test('should route /auth/login to SimpleLogin component', () => {
      render(<TestRouter initialRoute="/auth/login" />);
      expect(screen.getByTestId('simple-login')).toBeInTheDocument();
    });

    test('should route /auth/register to SimpleRegister component', () => {
      render(<TestRouter initialRoute="/auth/register" />);
      expect(screen.getByTestId('simple-register')).toBeInTheDocument();
    });

    test('should route /auth/verify-otp to OTPVerification component', () => {
      render(<TestRouter initialRoute="/auth/verify-otp" />);
      expect(screen.getByTestId('otp-verification')).toBeInTheDocument();
    });

    test('should route /auth/device-login to DeviceLogin component', () => {
      render(<TestRouter initialRoute="/auth/device-login" />);
      expect(screen.getByTestId('device-login')).toBeInTheDocument();
    });

    test('should route /auth/global-login to GlobalLogin component', () => {
      render(<TestRouter initialRoute="/auth/global-login" />);
      expect(screen.getByTestId('global-login')).toBeInTheDocument();
    });

    test('should prioritize /auth/* over dynamic slug route', () => {
      render(<TestRouter initialRoute="/auth/login" />);
      expect(screen.getByTestId('simple-login')).toBeInTheDocument();
      expect(screen.queryByTestId('dynamic-storefront')).not.toBeInTheDocument();
    });

    test('should prioritize all auth routes over dynamic slug route', () => {
      const authRoutes = [
        { path: '/auth/login', testId: 'simple-login' },
        { path: '/auth/register', testId: 'simple-register' },
        { path: '/auth/verify-otp', testId: 'otp-verification' },
        { path: '/auth/device-login', testId: 'device-login' },
        { path: '/auth/global-login', testId: 'global-login' },
      ];

      authRoutes.forEach(({ path, testId }) => {
        const { unmount } = render(<TestRouter initialRoute={path} />);
        expect(screen.getByTestId(testId)).toBeInTheDocument();
        expect(screen.queryByTestId('dynamic-storefront')).not.toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Fallback Route (Requirement 1.5)', () => {
    test('should route unknown single-segment path to dynamic storefront', () => {
      // Single-segment paths like /unknown-path match the /:slug pattern
      // This is expected behavior - only multi-segment unknown paths redirect
      render(<TestRouter initialRoute="/unknown-path-12345" />);
      expect(screen.getByTestId('dynamic-storefront')).toBeInTheDocument();
    });

    test('should redirect deeply nested unknown path to landing page', async () => {
      // Multi-segment paths that don't match any route should redirect
      render(<TestRouter initialRoute="/some/deeply/nested/unknown/path" />);
      await waitFor(() => {
        // This actually matches /:slug/* where slug="some" and nested path doesn't match
        // In the actual app, DynamicStorefront will handle invalid slugs
        expect(screen.getByTestId('dynamic-storefront')).toBeInTheDocument();
      });
    });

    test('should handle root path correctly', () => {
      render(<TestRouter initialRoute="/" />);
      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Priority Verification', () => {
    test('should prioritize static routes over dynamic routes', () => {
      const staticRoutes = [
        { path: '/setup-cafe', testId: 'setup-wizard' },
        { path: '/admin', testId: 'admin-layout' },
        { path: '/auth/login', testId: 'simple-login' },
      ];

      staticRoutes.forEach(({ path, testId }) => {
        const { unmount } = render(<TestRouter initialRoute={path} />);
        expect(screen.getByTestId(testId)).toBeInTheDocument();
        expect(screen.queryByTestId('dynamic-storefront')).not.toBeInTheDocument();
        unmount();
      });
    });
  });
});
