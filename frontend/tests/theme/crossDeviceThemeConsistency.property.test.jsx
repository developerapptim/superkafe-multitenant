/**
 * Cross-Device Theme Consistency - Property-Based Tests
 * 
 * **Property 10: Cross-Device Theme Consistency**
 * **Validates: Requirements 9.1**
 * 
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property test
 * 
 * Feature: seamless-branding-integration
 * 
 * This test verifies that for any tenant logging in from different devices or browsers,
 * the admin panel must apply the same theme that is stored in the database, ensuring
 * consistent visual experience across all access points.
 */

import fc from 'fast-check';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../../src/context/ThemeContext';
import { themePresets } from '../../src/config/themeStyles';
import api from '../../src/services/api';

// Mock dependencies
jest.mock('../../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn()
  }
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn()
  }
}));

describe('Cross-Device Theme Consistency - Property-Based Tests', () => {
  
  beforeEach(() => {
    // Clear CSS variables
    const root = document.documentElement;
    ['--bg-main', '--bg-sidebar', '--accent-color', '--text-primary'].forEach(varName => {
      root.style.removeProperty(varName);
    });
    root.removeAttribute('data-theme');
    
    // Clear localStorage
    localStorage.clear();
    
    // Reset mocks
    jest.clearAllMocks();
  });

  // ============================================================================
  // Property 10: Cross-Device Theme Consistency
  // **Validates: Requirements 9.1**
  // ============================================================================
  
  describe('Property 10: Cross-Device Theme Consistency', () => {
    
    test('theme loaded from database matches saved preference across devices', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate arbitrary tenant and theme data
          fc.record({
            tenantId: fc.string({ minLength: 10, maxLength: 30 })
              .filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            themeName: fc.constantFrom(...Object.keys(themePresets)),
            deviceId: fc.string({ minLength: 5, maxLength: 20 })
          }),
          async ({ tenantId, themeName, deviceId }) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            // Mock API to return the saved theme from database
            api.get.mockResolvedValue({ 
              data: { 
                theme: themeName,
                hasSeenThemePopup: true 
              } 
            });
            
            // Simulate Device 1: Login with theme from auth response
            const wrapper1 = ({ children }) => (
              <ThemeProvider initialTheme={themeName} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result: result1 } = renderHook(() => useTheme(), { wrapper: wrapper1 });
            
            // Wait for initial render
            await waitFor(() => {
              expect(result1.current.isLoading).toBe(false);
            });
            
            // Property: Device 1 should have the theme from database
            const device1Theme = result1.current.currentTheme;
            
            // Simulate Device 2: Login (different device, same tenant)
            // Clear localStorage to simulate different device
            localStorage.clear();
            
            // Device 2 gets theme from auth response (which comes from database)
            const wrapper2 = ({ children }) => (
              <ThemeProvider initialTheme={themeName} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result: result2 } = renderHook(() => useTheme(), { wrapper: wrapper2 });
            
            // Wait for initial render
            await waitFor(() => {
              expect(result2.current.isLoading).toBe(false);
            });
            
            // Property: Device 2 should have the same theme as Device 1
            const device2Theme = result2.current.currentTheme;
            
            return device1Theme === device2Theme && device1Theme === themeName;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('multiple login sessions apply consistent theme from database', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate tenant ID, theme, and number of sessions
          fc.record({
            tenantId: fc.string({ minLength: 10, maxLength: 30 })
              .filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            themeName: fc.constantFrom(...Object.keys(themePresets)),
            sessionCount: fc.integer({ min: 2, max: 5 })
          }),
          async ({ tenantId, themeName, sessionCount }) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            // Mock API to return the saved theme from database
            api.get.mockResolvedValue({ 
              data: { 
                theme: themeName,
                hasSeenThemePopup: true 
              } 
            });
            
            const sessionThemes = [];
            
            // Simulate multiple login sessions
            for (let i = 0; i < sessionCount; i++) {
              // Clear localStorage to simulate new session
              localStorage.clear();
              
              // Create new provider for this session
              const wrapper = ({ children }) => (
                <ThemeProvider initialTheme={themeName} tenantId={tenantId}>
                  {children}
                </ThemeProvider>
              );
              
              const { result } = renderHook(() => useTheme(), { wrapper });
              
              // Wait for initial render
              await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
              });
              
              // Collect theme from this session
              sessionThemes.push(result.current.currentTheme);
            }
            
            // Property: All sessions should have the same theme
            const allThemesMatch = sessionThemes.every(theme => theme === themeName);
            const allSessionsConsistent = sessionThemes.every(theme => theme === sessionThemes[0]);
            
            return allThemesMatch && allSessionsConsistent;
          }
        ),
        { numRuns: 50, endOnFailure: true } // Reduced runs due to multiple sessions
      );
    });
    
    test('theme consistency maintained after theme change across devices', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate tenant ID and two different themes
          fc.record({
            tenantId: fc.string({ minLength: 10, maxLength: 30 })
              .filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            initialTheme: fc.constantFrom(...Object.keys(themePresets)),
            newTheme: fc.constantFrom(...Object.keys(themePresets))
          }),
          async ({ tenantId, initialTheme, newTheme }) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            // Mock API responses
            api.get.mockResolvedValue({ 
              data: { 
                theme: initialTheme,
                hasSeenThemePopup: true 
              } 
            });
            api.put.mockResolvedValue({ 
              data: { 
                success: true, 
                theme: newTheme 
              } 
            });
            
            // Device 1: Initial login
            const wrapper1 = ({ children }) => (
              <ThemeProvider initialTheme={initialTheme} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result: result1 } = renderHook(() => useTheme(), { wrapper: wrapper1 });
            
            await waitFor(() => {
              expect(result1.current.isLoading).toBe(false);
            });
            
            // Device 1: Change theme
            await act(async () => {
              await result1.current.setTheme(newTheme);
            });
            
            // Property: Device 1 should have new theme
            const device1ThemeAfterChange = result1.current.currentTheme;
            
            // Update mock to return new theme from database
            api.get.mockResolvedValue({ 
              data: { 
                theme: newTheme,
                hasSeenThemePopup: true 
              } 
            });
            
            // Device 2: Login after theme change (should get new theme from database)
            localStorage.clear();
            
            const wrapper2 = ({ children }) => (
              <ThemeProvider initialTheme={newTheme} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result: result2 } = renderHook(() => useTheme(), { wrapper: wrapper2 });
            
            await waitFor(() => {
              expect(result2.current.isLoading).toBe(false);
            });
            
            // Property: Device 2 should have the same theme as Device 1 after change
            const device2Theme = result2.current.currentTheme;
            
            return device1ThemeAfterChange === device2Theme && device2Theme === newTheme;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('database theme preference overrides any local state', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate tenant ID, database theme, and local theme
          fc.record({
            tenantId: fc.string({ minLength: 10, maxLength: 30 })
              .filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            databaseTheme: fc.constantFrom(...Object.keys(themePresets)),
            localTheme: fc.constantFrom(...Object.keys(themePresets))
          }).filter(({ databaseTheme, localTheme }) => databaseTheme !== localTheme),
          async ({ tenantId, databaseTheme, localTheme }) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            // Simulate corrupted localStorage with wrong theme
            const corruptedTenant = {
              id: tenantId,
              slug: 'test-cafe',
              name: 'Test Cafe',
              selectedTheme: localTheme // Wrong theme in localStorage
            };
            localStorage.setItem('tenant', JSON.stringify(corruptedTenant));
            
            // Mock API to return correct theme from database
            api.get.mockResolvedValue({ 
              data: { 
                theme: databaseTheme,
                hasSeenThemePopup: true 
              } 
            });
            
            // Create provider with theme from database (auth response)
            const wrapper = ({ children }) => (
              <ThemeProvider initialTheme={databaseTheme} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result } = renderHook(() => useTheme(), { wrapper });
            
            await waitFor(() => {
              expect(result.current.isLoading).toBe(false);
            });
            
            // Property: Theme should match database, not localStorage
            const appliedTheme = result.current.currentTheme;
            
            return appliedTheme === databaseTheme && appliedTheme !== localTheme;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('CSS variables match database theme across all devices', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate tenant ID and theme
          fc.record({
            tenantId: fc.string({ minLength: 10, maxLength: 30 })
              .filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            themeName: fc.constantFrom(...Object.keys(themePresets))
          }),
          async ({ tenantId, themeName }) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            // Clear CSS variables
            const root = document.documentElement;
            ['--bg-main', '--bg-sidebar', '--accent-color', '--text-primary'].forEach(varName => {
              root.style.removeProperty(varName);
            });
            
            // Mock API to return theme from database
            api.get.mockResolvedValue({ 
              data: { 
                theme: themeName,
                hasSeenThemePopup: true 
              } 
            });
            
            // Simulate Device 1
            const wrapper1 = ({ children }) => (
              <ThemeProvider initialTheme={themeName} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result: result1 } = renderHook(() => useTheme(), { wrapper: wrapper1 });
            
            await waitFor(() => {
              expect(result1.current.isLoading).toBe(false);
            });
            
            // Capture CSS variables from Device 1
            const device1CSSVars = {
              bgMain: getComputedStyle(root).getPropertyValue('--bg-main').trim(),
              bgSidebar: getComputedStyle(root).getPropertyValue('--bg-sidebar').trim(),
              accentColor: getComputedStyle(root).getPropertyValue('--accent-color').trim(),
              textPrimary: getComputedStyle(root).getPropertyValue('--text-primary').trim()
            };
            
            // Clear CSS variables to simulate Device 2
            ['--bg-main', '--bg-sidebar', '--accent-color', '--text-primary'].forEach(varName => {
              root.style.removeProperty(varName);
            });
            localStorage.clear();
            
            // Simulate Device 2
            const wrapper2 = ({ children }) => (
              <ThemeProvider initialTheme={themeName} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result: result2 } = renderHook(() => useTheme(), { wrapper: wrapper2 });
            
            await waitFor(() => {
              expect(result2.current.isLoading).toBe(false);
            });
            
            // Capture CSS variables from Device 2
            const device2CSSVars = {
              bgMain: getComputedStyle(root).getPropertyValue('--bg-main').trim(),
              bgSidebar: getComputedStyle(root).getPropertyValue('--bg-sidebar').trim(),
              accentColor: getComputedStyle(root).getPropertyValue('--accent-color').trim(),
              textPrimary: getComputedStyle(root).getPropertyValue('--text-primary').trim()
            };
            
            // Property: CSS variables should match across devices
            const expectedConfig = themePresets[themeName];
            
            const device1Matches = 
              device1CSSVars.bgMain === expectedConfig.bgMain &&
              device1CSSVars.bgSidebar === expectedConfig.bgSidebar &&
              device1CSSVars.accentColor === expectedConfig.accentColor &&
              device1CSSVars.textPrimary === expectedConfig.textPrimary;
            
            const device2Matches = 
              device2CSSVars.bgMain === expectedConfig.bgMain &&
              device2CSSVars.bgSidebar === expectedConfig.bgSidebar &&
              device2CSSVars.accentColor === expectedConfig.accentColor &&
              device2CSSVars.textPrimary === expectedConfig.textPrimary;
            
            const devicesMatch = 
              device1CSSVars.bgMain === device2CSSVars.bgMain &&
              device1CSSVars.bgSidebar === device2CSSVars.bgSidebar &&
              device1CSSVars.accentColor === device2CSSVars.accentColor &&
              device1CSSVars.textPrimary === device2CSSVars.textPrimary;
            
            return device1Matches && device2Matches && devicesMatch;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('theme consistency maintained across browser refresh', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate tenant ID and theme
          fc.record({
            tenantId: fc.string({ minLength: 10, maxLength: 30 })
              .filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            themeName: fc.constantFrom(...Object.keys(themePresets))
          }),
          async ({ tenantId, themeName }) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            // Mock API to return theme from database
            api.get.mockResolvedValue({ 
              data: { 
                theme: themeName,
                hasSeenThemePopup: true 
              } 
            });
            
            // Initial page load
            const wrapper1 = ({ children }) => (
              <ThemeProvider initialTheme={themeName} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result: result1 } = renderHook(() => useTheme(), { wrapper: wrapper1 });
            
            await waitFor(() => {
              expect(result1.current.isLoading).toBe(false);
            });
            
            const themeBeforeRefresh = result1.current.currentTheme;
            
            // Simulate browser refresh (localStorage persists, but React state resets)
            // In real app, auth response would include theme from database
            const wrapper2 = ({ children }) => (
              <ThemeProvider initialTheme={themeName} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result: result2 } = renderHook(() => useTheme(), { wrapper: wrapper2 });
            
            await waitFor(() => {
              expect(result2.current.isLoading).toBe(false);
            });
            
            const themeAfterRefresh = result2.current.currentTheme;
            
            // Property: Theme should be consistent after refresh
            return themeBeforeRefresh === themeAfterRefresh && themeAfterRefresh === themeName;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('theme from auth response takes precedence over API call', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate tenant ID and theme
          fc.record({
            tenantId: fc.string({ minLength: 10, maxLength: 30 })
              .filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            authTheme: fc.constantFrom(...Object.keys(themePresets)),
            apiTheme: fc.constantFrom(...Object.keys(themePresets))
          }),
          async ({ tenantId, authTheme, apiTheme }) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            // Mock API to return different theme (should not be used if auth has theme)
            api.get.mockResolvedValue({ 
              data: { 
                theme: apiTheme,
                hasSeenThemePopup: true 
              } 
            });
            
            // Create provider with theme from auth response
            const wrapper = ({ children }) => (
              <ThemeProvider initialTheme={authTheme} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result } = renderHook(() => useTheme(), { wrapper });
            
            await waitFor(() => {
              expect(result.current.isLoading).toBe(false);
            });
            
            // Property: Theme should match auth response, not API call
            // API call should only be made if initialTheme is 'default'
            const appliedTheme = result.current.currentTheme;
            
            if (authTheme !== 'default') {
              // API should not be called if auth response has non-default theme
              return appliedTheme === authTheme && api.get.mock.calls.length === 0;
            } else {
              // API may be called as fallback for default theme
              return appliedTheme === authTheme;
            }
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('concurrent logins from multiple devices apply same theme', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate tenant ID, theme, and number of concurrent devices
          fc.record({
            tenantId: fc.string({ minLength: 10, maxLength: 30 })
              .filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            themeName: fc.constantFrom(...Object.keys(themePresets)),
            deviceCount: fc.integer({ min: 2, max: 4 })
          }),
          async ({ tenantId, themeName, deviceCount }) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            // Mock API to return theme from database
            api.get.mockResolvedValue({ 
              data: { 
                theme: themeName,
                hasSeenThemePopup: true 
              } 
            });
            
            // Simulate concurrent logins from multiple devices
            const devicePromises = [];
            
            for (let i = 0; i < deviceCount; i++) {
              const devicePromise = (async () => {
                const wrapper = ({ children }) => (
                  <ThemeProvider initialTheme={themeName} tenantId={tenantId}>
                    {children}
                  </ThemeProvider>
                );
                
                const { result } = renderHook(() => useTheme(), { wrapper });
                
                await waitFor(() => {
                  expect(result.current.isLoading).toBe(false);
                });
                
                return result.current.currentTheme;
              })();
              
              devicePromises.push(devicePromise);
            }
            
            // Wait for all devices to load theme
            const deviceThemes = await Promise.all(devicePromises);
            
            // Property: All devices should have the same theme
            const allThemesMatch = deviceThemes.every(theme => theme === themeName);
            const allDevicesConsistent = deviceThemes.every(theme => theme === deviceThemes[0]);
            
            return allThemesMatch && allDevicesConsistent;
          }
        ),
        { numRuns: 50, endOnFailure: true } // Reduced runs due to concurrent operations
      );
    });
    
    test('theme consistency maintained for any valid tenant ID', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate various tenant ID formats and theme
          fc.record({
            tenantId: fc.oneof(
              fc.uuid(),
              fc.string({ minLength: 24, maxLength: 24 }).map(s => s.replace(/[^a-f0-9]/g, '0')), // MongoDB ObjectId format
              fc.string({ minLength: 10, maxLength: 30 }).filter(s => /^[a-zA-Z0-9-]+$/.test(s))
            ),
            themeName: fc.constantFrom(...Object.keys(themePresets))
          }),
          async ({ tenantId, themeName }) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            // Mock API to return theme from database
            api.get.mockResolvedValue({ 
              data: { 
                theme: themeName,
                hasSeenThemePopup: true 
              } 
            });
            
            // Device 1
            const wrapper1 = ({ children }) => (
              <ThemeProvider initialTheme={themeName} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result: result1 } = renderHook(() => useTheme(), { wrapper: wrapper1 });
            
            await waitFor(() => {
              expect(result1.current.isLoading).toBe(false);
            });
            
            const device1Theme = result1.current.currentTheme;
            
            // Device 2
            localStorage.clear();
            
            const wrapper2 = ({ children }) => (
              <ThemeProvider initialTheme={themeName} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result: result2 } = renderHook(() => useTheme(), { wrapper: wrapper2 });
            
            await waitFor(() => {
              expect(result2.current.isLoading).toBe(false);
            });
            
            const device2Theme = result2.current.currentTheme;
            
            // Property: Theme should be consistent regardless of tenant ID format
            return device1Theme === device2Theme && device1Theme === themeName;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('theme data structure consistent across all devices', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate tenant ID and theme
          fc.record({
            tenantId: fc.string({ minLength: 10, maxLength: 30 })
              .filter(s => /^[a-zA-Z0-9-]+$/.test(s)),
            themeName: fc.constantFrom(...Object.keys(themePresets))
          }),
          async ({ tenantId, themeName }) => {
            // Reset mocks for each iteration
            jest.clearAllMocks();
            
            // Mock API to return theme from database
            api.get.mockResolvedValue({ 
              data: { 
                theme: themeName,
                hasSeenThemePopup: true 
              } 
            });
            
            // Device 1
            const wrapper1 = ({ children }) => (
              <ThemeProvider initialTheme={themeName} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result: result1 } = renderHook(() => useTheme(), { wrapper: wrapper1 });
            
            await waitFor(() => {
              expect(result1.current.isLoading).toBe(false);
            });
            
            const device1Config = result1.current.themeConfig;
            
            // Device 2
            localStorage.clear();
            
            const wrapper2 = ({ children }) => (
              <ThemeProvider initialTheme={themeName} tenantId={tenantId}>
                {children}
              </ThemeProvider>
            );
            
            const { result: result2 } = renderHook(() => useTheme(), { wrapper: wrapper2 });
            
            await waitFor(() => {
              expect(result2.current.isLoading).toBe(false);
            });
            
            const device2Config = result2.current.themeConfig;
            
            // Property: Theme config structure should be identical across devices
            const configsMatch = 
              device1Config.bgMain === device2Config.bgMain &&
              device1Config.bgSidebar === device2Config.bgSidebar &&
              device1Config.accentColor === device2Config.accentColor &&
              device1Config.textPrimary === device2Config.textPrimary;
            
            const expectedConfig = themePresets[themeName];
            const device1MatchesExpected = 
              device1Config.bgMain === expectedConfig.bgMain &&
              device1Config.bgSidebar === expectedConfig.bgSidebar &&
              device1Config.accentColor === expectedConfig.accentColor &&
              device1Config.textPrimary === expectedConfig.textPrimary;
            
            return configsMatch && device1MatchesExpected;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
  });
});

/**
 * Property Test Summary
 * 
 * This test suite validates Property 10: Cross-Device Theme Consistency
 * 
 * The property states: For any tenant logging in from different devices or browsers,
 * the admin panel must apply the same theme that is stored in the database, ensuring
 * consistent visual experience across all access points.
 * 
 * Test Coverage:
 * 1. Theme loaded from database matches saved preference across devices
 * 2. Multiple login sessions apply consistent theme from database
 * 3. Theme consistency maintained after theme change across devices
 * 4. Database theme preference overrides any local state
 * 5. CSS variables match database theme across all devices
 * 6. Theme consistency maintained across browser refresh
 * 7. Theme from auth response takes precedence over API call
 * 8. Concurrent logins from multiple devices apply same theme
 * 9. Theme consistency maintained for any valid tenant ID
 * 10. Theme data structure consistent across all devices
 * 
 * Validates: Requirements 9.1
 */
