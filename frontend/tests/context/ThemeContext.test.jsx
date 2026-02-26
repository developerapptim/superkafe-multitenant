/**
 * Unit Tests for ThemeContext
 * 
 * Tests theme loading, state management, API calls, error handling, and loading states.
 * 
 * Feature: Seamless Branding Integration
 * Task: 5.3 Write unit tests for ThemeContext
 * Requirements: 5.1, 5.2, 9.3, 9.4
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../../src/context/ThemeContext';
import { themePresets } from '../../src/config/themeStyles';
import api from '../../src/services/api';
import toast from 'react-hot-toast';

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

describe('ThemeContext Unit Tests', () => {
  beforeEach(() => {
    // Clear CSS variables
    const root = document.documentElement;
    root.style.removeProperty('--bg-main');
    root.style.removeProperty('--bg-sidebar');
    root.style.removeProperty('--accent-color');
    root.style.removeProperty('--text-primary');
    root.removeAttribute('data-theme');
    
    // Clear localStorage
    localStorage.clear();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock successful API responses by default
    api.get.mockResolvedValue({ data: { theme: 'default' } });
    api.put.mockResolvedValue({ data: { success: true } });
  });

  describe('Theme loading from initial data', () => {
    test('loads default theme when no initialTheme provided', () => {
      const wrapper = ({ children }) => (
        <ThemeProvider>
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.currentTheme).toBe('default');
      expect(result.current.themeConfig).toEqual(themePresets.default);
    });

    test('loads specified initial theme', () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="light-coffee">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.currentTheme).toBe('light-coffee');
      expect(result.current.themeConfig).toEqual(themePresets['light-coffee']);
    });

    test('applies theme from auth response on mount', () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="light-coffee" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.currentTheme).toBe('light-coffee');
      expect(result.current.themeConfig.bgMain).toBe('#FFFFFF');
      expect(result.current.themeConfig.bgSidebar).toBe('#4E342E');
    });

    test('loads theme from API when tenantId provided and initialTheme is default', async () => {
      api.get.mockResolvedValue({ data: { theme: 'light-coffee' } });

      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      // Wait for API call to complete
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/tenants/test-tenant-123/theme');
      });

      await waitFor(() => {
        expect(result.current.currentTheme).toBe('light-coffee');
      });
    });

    test('does not call API when initialTheme is not default', async () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="light-coffee" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      renderHook(() => useTheme(), { wrapper });

      // Wait a bit to ensure no API call is made
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(api.get).not.toHaveBeenCalled();
    });
  });

  describe('setTheme function updates state and calls API', () => {
    test('updates theme state when setTheme is called', async () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      // Wait for initial API call to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setTheme('light-coffee');
      });

      expect(result.current.currentTheme).toBe('light-coffee');
      expect(result.current.themeConfig).toEqual(themePresets['light-coffee']);
    });

    test('calls API to persist theme change', async () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await result.current.setTheme('light-coffee');
      });

      expect(api.put).toHaveBeenCalledWith('/tenants/test-tenant-123/theme', {
        theme: 'light-coffee'
      });
    });

    test('returns true on successful theme update', async () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      let success;
      await act(async () => {
        success = await result.current.setTheme('light-coffee');
      });

      expect(success).toBe(true);
    });

    test('updates localStorage tenant data after successful theme change', async () => {
      const tenantData = {
        id: 'test-tenant-123',
        slug: 'test-cafe',
        selectedTheme: 'default'
      };
      localStorage.setItem('tenant', JSON.stringify(tenantData));

      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await result.current.setTheme('light-coffee');
      });

      const updatedTenant = JSON.parse(localStorage.getItem('tenant'));
      expect(updatedTenant.selectedTheme).toBe('light-coffee');
    });

    test('does not call API when tenantId is not provided', async () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await result.current.setTheme('light-coffee');
      });

      expect(api.put).not.toHaveBeenCalled();
      expect(result.current.currentTheme).toBe('light-coffee');
    });

    test('rejects invalid theme names', async () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      let success;
      await act(async () => {
        success = await result.current.setTheme('invalid-theme');
      });

      expect(success).toBe(false);
      expect(result.current.currentTheme).toBe('default');
      expect(toast.error).toHaveBeenCalledWith('Tema tidak valid.', expect.any(Object));
    });
  });

  describe('CSS variables are applied correctly', () => {
    test('applies all four CSS variables on initial render', () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="light-coffee">
          {children}
        </ThemeProvider>
      );

      renderHook(() => useTheme(), { wrapper });

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--bg-main')).toBe('#FFFFFF');
      expect(root.style.getPropertyValue('--bg-sidebar')).toBe('#4E342E');
      expect(root.style.getPropertyValue('--accent-color')).toBe('#A0522D');
      expect(root.style.getPropertyValue('--text-primary')).toBe('#2D2D2D');
    });

    test('updates CSS variables when theme changes', async () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      // Wait for initial API call to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setTheme('light-coffee');
      });

      const root = document.documentElement;
      expect(root.style.getPropertyValue('--bg-main')).toBe('#FFFFFF');
      expect(root.style.getPropertyValue('--bg-sidebar')).toBe('#4E342E');
      expect(root.style.getPropertyValue('--accent-color')).toBe('#A0522D');
      expect(root.style.getPropertyValue('--text-primary')).toBe('#2D2D2D');
    });

    test('sets data-theme attribute on document root', () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="light-coffee">
          {children}
        </ThemeProvider>
      );

      renderHook(() => useTheme(), { wrapper });

      expect(document.documentElement.getAttribute('data-theme')).toBe('light-coffee');
    });

    test('updates data-theme attribute when theme changes', async () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      // Wait for initial API call to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setTheme('light-coffee');
      });

      expect(document.documentElement.getAttribute('data-theme')).toBe('light-coffee');
    });
  });

  describe('Error handling falls back to default theme', () => {
    test('falls back to default theme when API call fails', async () => {
      api.get.mockRejectedValue(new Error('Network error'));

      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.currentTheme).toBe('default');
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Gagal memuat tema. Menggunakan tema default.',
        expect.any(Object)
      );
    });

    test('falls back to default theme when invalid theme received from API', async () => {
      api.get.mockResolvedValue({ data: { theme: 'invalid-theme' } });

      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await waitFor(() => {
        expect(result.current.currentTheme).toBe('default');
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Tema tidak valid. Menggunakan tema default.',
        expect.any(Object)
      );
    });

    test('reverts to previous theme when update fails', async () => {
      api.put.mockRejectedValue(new Error('Update failed'));

      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await result.current.setTheme('light-coffee');
      });

      // Should revert to default theme
      expect(result.current.currentTheme).toBe('default');
      expect(toast.error).toHaveBeenCalledWith(
        'Gagal menyimpan tema. Silakan coba lagi.',
        expect.any(Object)
      );
    });

    test('displays custom error message from API response', async () => {
      const errorMessage = 'Unauthorized access';
      api.put.mockRejectedValue({
        response: {
          data: {
            message: errorMessage
          }
        }
      });

      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await result.current.setTheme('light-coffee');
      });

      expect(toast.error).toHaveBeenCalledWith(errorMessage, expect.any(Object));
    });

    test('maintains previous theme and CSS variables on update failure', async () => {
      api.put.mockRejectedValue(new Error('Update failed'));

      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="light-coffee" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      // Try to change to default theme
      await act(async () => {
        await result.current.setTheme('default');
      });

      // Should revert to light-coffee
      expect(result.current.currentTheme).toBe('light-coffee');
      
      const root = document.documentElement;
      expect(root.style.getPropertyValue('--bg-main')).toBe('#FFFFFF');
      expect(root.style.getPropertyValue('--bg-sidebar')).toBe('#4E342E');
    });

    test('uses default theme when no tenantId and API call would fail', async () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      // Wait a bit to ensure no API call is made
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(api.get).not.toHaveBeenCalled();
      expect(result.current.currentTheme).toBe('default');
    });
  });

  describe('isLoading state during theme updates', () => {
    test('isLoading is false initially', () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.isLoading).toBe(false);
    });

    test('isLoading is true during theme update', async () => {
      let resolvePromise;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      api.put.mockReturnValue(promise);

      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('light-coffee');
      });

      // Check loading state before promise resolves
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise({ data: { success: true } });
        await promise;
      });

      // Loading should be false after completion
      expect(result.current.isLoading).toBe(false);
    });

    test('isLoading is true during API theme load', async () => {
      let resolvePromise;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      api.get.mockReturnValue(promise);

      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      // Wait for loading to start
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Resolve the promise
      await act(async () => {
        resolvePromise({ data: { theme: 'light-coffee' } });
        await promise;
      });

      // Loading should be false after completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    test('isLoading returns to false after error', async () => {
      api.put.mockRejectedValue(new Error('Update failed'));

      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default" tenantId="test-tenant-123">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await result.current.setTheme('light-coffee');
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Context provider requirements', () => {
    test('throws error when useTheme is used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleError.mockRestore();
    });

    test('provides all required context values', () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current).toHaveProperty('currentTheme');
      expect(result.current).toHaveProperty('themeConfig');
      expect(result.current).toHaveProperty('setTheme');
      expect(result.current).toHaveProperty('isLoading');
    });

    test('setTheme is a function', () => {
      const wrapper = ({ children }) => (
        <ThemeProvider initialTheme="default">
          {children}
        </ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(typeof result.current.setTheme).toBe('function');
    });
  });
});
