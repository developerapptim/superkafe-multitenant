/**
 * Test: CSS Variable Application Logic
 * Feature: Seamless Branding Integration
 * Task: 5.2 Implement CSS variable application logic
 * Validates: Requirements 5.1, 5.2
 */

import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../../src/context/ThemeContext';
import { themePresets } from '../../src/config/themeStyles';
import api from '../../src/services/api';

// Mock API
jest.mock('../../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn()
  }
}));

describe('Task 5.2: CSS Variable Application Logic', () => {
  beforeEach(() => {
    // Clear any existing CSS variables
    const root = document.documentElement;
    root.style.removeProperty('--bg-main');
    root.style.removeProperty('--bg-sidebar');
    root.style.removeProperty('--accent-color');
    root.style.removeProperty('--text-primary');
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock successful API responses
    api.get.mockResolvedValue({ data: { theme: 'default' } });
    api.put.mockResolvedValue({ data: { success: true } });
  });

  test('applies all four CSS variables on initial render', () => {
    const wrapper = ({ children }) => (
      <ThemeProvider initialTheme="default">
        {children}
      </ThemeProvider>
    );

    renderHook(() => useTheme(), { wrapper });

    const root = document.documentElement;
    const bgMain = root.style.getPropertyValue('--bg-main');
    const bgSidebar = root.style.getPropertyValue('--bg-sidebar');
    const accentColor = root.style.getPropertyValue('--accent-color');
    const textPrimary = root.style.getPropertyValue('--text-primary');

    expect(bgMain).toBe(themePresets.default.bgMain);
    expect(bgSidebar).toBe(themePresets.default.bgSidebar);
    expect(accentColor).toBe(themePresets.default.accentColor);
    expect(textPrimary).toBe(themePresets.default.textPrimary);
  });

  test('updates CSS variables immediately when theme changes', async () => {
    const wrapper = ({ children }) => (
      <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
        {children}
      </ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    // Wait for initial render to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Change theme to light-coffee
    await act(async () => {
      await result.current.setTheme('light-coffee');
    });

    // Wait for CSS variables to be applied
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const root = document.documentElement;
    const bgMain = root.style.getPropertyValue('--bg-main');
    const bgSidebar = root.style.getPropertyValue('--bg-sidebar');
    const accentColor = root.style.getPropertyValue('--accent-color');
    const textPrimary = root.style.getPropertyValue('--text-primary');

    expect(bgMain).toBe(themePresets['light-coffee'].bgMain);
    expect(bgSidebar).toBe(themePresets['light-coffee'].bgSidebar);
    expect(accentColor).toBe(themePresets['light-coffee'].accentColor);
    expect(textPrimary).toBe(themePresets['light-coffee'].textPrimary);
  });

  test('handles errors during CSS variable application gracefully', () => {
    // Mock setProperty to throw an error
    const originalSetProperty = document.documentElement.style.setProperty;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    document.documentElement.style.setProperty = jest.fn(() => {
      throw new Error('CSS variable application failed');
    });

    const wrapper = ({ children }) => (
      <ThemeProvider initialTheme="default">
        {children}
      </ThemeProvider>
    );

    // Should not throw, but log error
    expect(() => {
      renderHook(() => useTheme(), { wrapper });
    }).not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Theme] Failed to apply CSS variables:',
      expect.any(Error)
    );

    // Restore
    document.documentElement.style.setProperty = originalSetProperty;
    consoleErrorSpy.mockRestore();
  });

  test('CSS variables persist after multiple theme changes', async () => {
    const wrapper = ({ children }) => (
      <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
        {children}
      </ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    // Wait for initial render
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Change to light-coffee
    await act(async () => {
      await result.current.setTheme('light-coffee');
    });

    // Wait for CSS variables to be applied
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    let root = document.documentElement;
    expect(root.style.getPropertyValue('--bg-main')).toBe(themePresets['light-coffee'].bgMain);

    // Change back to default
    await act(async () => {
      await result.current.setTheme('default');
    });

    // Wait for CSS variables to be applied
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    root = document.documentElement;
    expect(root.style.getPropertyValue('--bg-main')).toBe(themePresets.default.bgMain);
    expect(root.style.getPropertyValue('--bg-sidebar')).toBe(themePresets.default.bgSidebar);
    expect(root.style.getPropertyValue('--accent-color')).toBe(themePresets.default.accentColor);
    expect(root.style.getPropertyValue('--text-primary')).toBe(themePresets.default.textPrimary);
  });

  test('all four CSS variables are set with correct property names', () => {
    const wrapper = ({ children }) => (
      <ThemeProvider initialTheme="light-coffee">
        {children}
      </ThemeProvider>
    );

    renderHook(() => useTheme(), { wrapper });

    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);

    // Verify all four CSS variables exist
    expect(computedStyle.getPropertyValue('--bg-main')).toBeTruthy();
    expect(computedStyle.getPropertyValue('--bg-sidebar')).toBeTruthy();
    expect(computedStyle.getPropertyValue('--accent-color')).toBeTruthy();
    expect(computedStyle.getPropertyValue('--text-primary')).toBeTruthy();
  });
});
