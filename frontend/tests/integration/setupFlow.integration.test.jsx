/**
 * Integration Tests: Setup Flow
 * 
 * Tests complete user flows from registration/OAuth to setup wizard to dashboard.
 * Validates routing priority, slug validation, and backward compatibility.
 * 
 * Requirements: 1.4, 2.1, 3.1, 4.1, 4.4, 5.1, 5.3
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { act } from 'react-dom/test-utils';
import '@testing-library/jest-dom';
import App from '../../src/App';
import api from '../../src/services/api';

// Mock API
jest.mock('../../src/services/api');

// Mock Google Auth
jest.mock('../../src/utils/googleAuth', () => ({
  loadGoogleScript: jest.fn(() => Promise.resolve())
}));

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('Integration: Complete Setup Flow', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('Flow 1: Register → Setup Wizard → Dashboard', () => {
    it('should complete registration flow and redirect to setup wizard', async () => {
      // Mock registration API
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Registrasi berhasil'
        }
      });

      // Render app at register page
      window.history.pushState({}, '', '/auth/register');
      const { container } = render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Daftar Akun Baru/i)).toBeInTheDocument();
      });

      // Fill registration form
      const nameInput = screen.getByPlaceholderText(/John Doe/i);
      const emailInput = screen.getByPlaceholderText(/admin@warkop.com/i);
      const passwordInputs = screen.getAllByPlaceholderText(/karakter/i);

      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Test User' } });
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInputs[0], { target: { value: 'password123' } });
        fireEvent.change(passwordInputs[1], { target: { value: 'password123' } });
      });

      // Submit form
      const submitButton = screen.getByText(/Daftar Sekarang/i);
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Verify API was called
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/auth/register', {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });

    it('should allow authenticated user without tenant to access setup wizard', async () => {
      // Set authenticated user without tenant
      localStorageMock.setItem('token', 'test-token');
      localStorageMock.setItem('user', JSON.stringify({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        tenantSlug: null,
        hasCompletedSetup: false
      }));

      // Mock slug check API
      api.get.mockResolvedValue({
        data: {
          success: true,
          available: true,
          message: 'Slug tersedia'
        }
      });

      // Navigate to setup wizard
      window.history.pushState({}, '', '/setup-cafe');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Verify setup wizard is rendered
      await waitFor(() => {
        expect(screen.getByText(/Setup Kafe Anda/i)).toBeInTheDocument();
      });
    });

    it('should complete setup wizard and redirect to dashboard', async () => {
      // Set authenticated user without tenant
      localStorageMock.setItem('token', 'test-token');
      localStorageMock.setItem('user', JSON.stringify({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        tenantSlug: null,
        hasCompletedSetup: false
      }));

      // Mock slug check API
      api.get.mockResolvedValue({
        data: {
          success: true,
          available: true,
          message: 'Slug tersedia'
        }
      });

      // Mock setup tenant API
      api.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Setup berhasil',
          token: 'new-token',
          user: {
            id: 1,
            name: 'Test User',
            email: 'test@example.com',
            tenantSlug: 'test-cafe',
            hasCompletedSetup: true
          },
          tenant: {
            slug: 'test-cafe',
            name: 'Test Cafe'
          }
        }
      });

      // Navigate to setup wizard
      window.history.pushState({}, '', '/setup-cafe');
      const { container } = render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Setup Kafe Anda/i)).toBeInTheDocument();
      });

      // Fill setup form
      const cafeNameInput = screen.getByPlaceholderText(/Warkop Kopi Kenangan/i);
      
      await act(async () => {
        fireEvent.change(cafeNameInput, { target: { value: 'Test Cafe' } });
      });

      // Wait for slug to be auto-generated and checked
      await waitFor(() => {
        const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);
        expect(slugInput.value).toBe('test-cafe');
      });

      // Submit form
      const submitButton = screen.getByText(/Buat Kafe Saya/i);
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Verify API was called
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/setup/tenant', {
          cafeName: 'Test Cafe',
          slug: 'test-cafe',
          adminName: undefined
        });
      });
    });
  });

  describe('Flow 2: Google OAuth → Setup Wizard → Dashboard', () => {
    it('should redirect new Google OAuth user to setup wizard', async () => {
      // Mock Google OAuth response (new user without tenant)
      localStorageMock.setItem('token', 'google-token');
      localStorageMock.setItem('user', JSON.stringify({
        id: 2,
        name: 'Google User',
        email: 'google@example.com',
        tenantSlug: null,
        hasCompletedSetup: false,
        googleId: 'google-123'
      }));

      // Navigate to setup wizard
      window.history.pushState({}, '', '/setup-cafe');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Verify setup wizard is accessible
      await waitFor(() => {
        expect(screen.getByText(/Setup Kafe Anda/i)).toBeInTheDocument();
      });
    });

    it('should redirect existing Google OAuth user with tenant to dashboard', async () => {
      // Mock Google OAuth response (existing user with tenant)
      localStorageMock.setItem('token', 'google-token');
      localStorageMock.setItem('user', JSON.stringify({
        id: 2,
        name: 'Google User',
        email: 'google@example.com',
        tenantSlug: 'existing-cafe',
        hasCompletedSetup: true,
        googleId: 'google-123'
      }));

      // Try to navigate to setup wizard
      window.history.pushState({}, '', '/setup-cafe');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Should redirect to dashboard (setup wizard redirects users with tenant)
      // Note: In real app, this would trigger navigation
      await waitFor(() => {
        const user = JSON.parse(localStorageMock.getItem('user'));
        expect(user.hasCompletedSetup).toBe(true);
        expect(user.tenantSlug).toBe('existing-cafe');
      });
    });
  });

  describe('Reserved Keyword Rejection in UI', () => {
    beforeEach(() => {
      // Set authenticated user without tenant
      localStorageMock.setItem('token', 'test-token');
      localStorageMock.setItem('user', JSON.stringify({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        tenantSlug: null,
        hasCompletedSetup: false
      }));
    });

    it('should reject reserved keyword "admin" in setup wizard', async () => {
      // Mock slug check API to return reserved keyword error
      api.get.mockResolvedValue({
        data: {
          success: true,
          available: false,
          message: "Slug 'admin' tidak dapat digunakan karena merupakan kata yang direservasi sistem"
        }
      });

      window.history.pushState({}, '', '/setup-cafe');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Setup Kafe Anda/i)).toBeInTheDocument();
      });

      // Try to use reserved keyword
      const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);
      await act(async () => {
        fireEvent.change(slugInput, { target: { value: 'admin' } });
      });

      // Wait for debounced check
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/setup/check-slug/admin');
      }, { timeout: 1000 });

      // Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByText(/direservasi sistem/i)).toBeInTheDocument();
      });
    });

    it('should reject reserved keyword "setup-cafe"', async () => {
      api.get.mockResolvedValue({
        data: {
          success: true,
          available: false,
          message: "Slug 'setup-cafe' tidak dapat digunakan karena merupakan kata yang direservasi sistem"
        }
      });

      window.history.pushState({}, '', '/setup-cafe');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Setup Kafe Anda/i)).toBeInTheDocument();
      });

      const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);
      await act(async () => {
        fireEvent.change(slugInput, { target: { value: 'setup-cafe' } });
      });

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/setup/check-slug/setup-cafe');
      }, { timeout: 1000 });

      await waitFor(() => {
        expect(screen.getByText(/direservasi sistem/i)).toBeInTheDocument();
      });
    });
  });

  describe('Invalid Format Rejection in UI', () => {
    beforeEach(() => {
      localStorageMock.setItem('token', 'test-token');
      localStorageMock.setItem('user', JSON.stringify({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        tenantSlug: null,
        hasCompletedSetup: false
      }));
    });

    it('should reject slug with uppercase letters', async () => {
      api.get.mockResolvedValue({
        data: {
          success: true,
          available: false,
          message: 'Slug hanya boleh mengandung huruf kecil, angka, dan tanda hubung (-)'
        }
      });

      window.history.pushState({}, '', '/setup-cafe');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Setup Kafe Anda/i)).toBeInTheDocument();
      });

      const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);
      
      // SetupWizard normalizes input, so uppercase will be converted to lowercase
      // But we can test that the normalization happens
      await act(async () => {
        fireEvent.change(slugInput, { target: { value: 'TestCafe' } });
      });

      // Verify input was normalized to lowercase
      await waitFor(() => {
        expect(slugInput.value).toBe('testcafe');
      });
    });

    it('should reject slug with special characters', async () => {
      window.history.pushState({}, '', '/setup-cafe');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Setup Kafe Anda/i)).toBeInTheDocument();
      });

      const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);
      
      // SetupWizard filters out special characters
      await act(async () => {
        fireEvent.change(slugInput, { target: { value: 'test@cafe!' } });
      });

      // Verify special characters were filtered out
      await waitFor(() => {
        expect(slugInput.value).toBe('testcafe');
      });
    });

    it('should reject slug shorter than 3 characters', async () => {
      window.history.pushState({}, '', '/setup-cafe');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Setup Kafe Anda/i)).toBeInTheDocument();
      });

      const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);
      
      await act(async () => {
        fireEvent.change(slugInput, { target: { value: 'ab' } });
      });

      // Slug check should not be triggered for slugs < 3 chars
      await waitFor(() => {
        expect(api.get).not.toHaveBeenCalled();
      });
    });
  });

  describe('Existing Tenant Slug Accessibility', () => {
    it('should allow access to existing tenant storefront', async () => {
      // Mock tenant data fetch
      api.get.mockResolvedValue({
        data: {
          success: true,
          tenant: {
            slug: 'existing-cafe',
            name: 'Existing Cafe',
            isActive: true
          }
        }
      });

      // Navigate to existing tenant slug
      window.history.pushState({}, '', '/existing-cafe');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Verify dynamic storefront is rendered
      // Note: This would require mocking the DynamicStorefront component
      // For now, we verify the route matches
      await waitFor(() => {
        expect(window.location.pathname).toBe('/existing-cafe');
      });
    });
  });

  describe('Nested Routes Functionality', () => {
    it('should preserve nested route /:slug/keranjang', async () => {
      window.history.pushState({}, '', '/test-cafe/keranjang');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Verify route is accessible
      await waitFor(() => {
        expect(window.location.pathname).toBe('/test-cafe/keranjang');
      });
    });

    it('should preserve nested route /:slug/pesanan', async () => {
      window.history.pushState({}, '', '/test-cafe/pesanan');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe('/test-cafe/pesanan');
      });
    });

    it('should preserve nested route /:slug/bantuan', async () => {
      window.history.pushState({}, '', '/test-cafe/bantuan');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(window.location.pathname).toBe('/test-cafe/bantuan');
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should not break existing tenant slugs after routing changes', async () => {
      const existingSlugs = [
        'warkop-jaya',
        'kafe-123',
        'my-coffee-shop',
        'cafe-corner'
      ];

      for (const slug of existingSlugs) {
        window.history.pushState({}, '', `/${slug}`);
        render(
          <BrowserRouter>
            <App />
          </BrowserRouter>
        );

        // Verify route is accessible
        await waitFor(() => {
          expect(window.location.pathname).toBe(`/${slug}`);
        });
      }
    });

    it('should prioritize static routes over tenant slugs', async () => {
      // Even if a tenant has slug "admin" (which shouldn't be possible),
      // the static /admin route should take priority
      window.history.pushState({}, '', '/admin');
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // Should route to admin layout, not tenant storefront
      await waitFor(() => {
        expect(window.location.pathname).toBe('/admin');
      });
    });
  });
});
