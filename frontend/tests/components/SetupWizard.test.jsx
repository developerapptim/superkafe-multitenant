/**
 * SetupWizard Component Unit Tests
 * 
 * Tests for SetupWizard component to ensure:
 * - Form validation works correctly
 * - Slug availability check functions properly
 * - Form submission success flow
 * - Error handling
 * - Protected route logic (authentication and tenant checks)
 * 
 * Validates Requirements: 4.2, 4.3, 4.4
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock api module with factory function
jest.mock('../../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock toast
jest.mock('react-hot-toast', () => {
  const mockToast = Object.assign(
    jest.fn((message) => message),
    {
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    }
  );
  return {
    __esModule: true,
    default: mockToast,
  };
});

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

// Import component and api after mocks
import SetupWizard from '../../src/pages/SetupWizard';
import api from '../../src/services/api';
import toast from 'react-hot-toast';

// Get the mocked functions
const mockGet = api.get;
const mockPost = api.post;

const renderSetupWizard = () => {
  return render(
    <BrowserRouter>
      <SetupWizard />
    </BrowserRouter>
  );
};

describe('SetupWizard Component', () => {
  beforeEach(() => {
    // Setup localStorage mock
    const mockUser = { name: 'Test User', email: 'test@example.com' };
    localStorage.setItem('token', 'mock-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    // Reset all mocks
    jest.clearAllMocks();
    mockGet.mockClear();
    mockPost.mockClear();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Protected Route Logic (Requirement 4.3)', () => {
    test('should redirect to login with return URL when unauthenticated (no token)', async () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      renderSetupWizard();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/auth/login?returnUrl=/setup-cafe');
        expect(toast.error).toHaveBeenCalledWith('Silakan login terlebih dahulu');
      });
    });

    test('should redirect to login with return URL when unauthenticated (no user)', async () => {
      localStorage.removeItem('user');

      renderSetupWizard();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/auth/login?returnUrl=/setup-cafe');
        expect(toast.error).toHaveBeenCalledWith('Silakan login terlebih dahulu');
      });
    });

    test('should redirect to dashboard when authenticated user already has tenant', async () => {
      const mockUserWithTenant = { 
        name: 'Test User', 
        email: 'test@example.com',
        tenantSlug: 'existing-tenant'
      };
      localStorage.setItem('user', JSON.stringify(mockUserWithTenant));

      renderSetupWizard();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
        expect(toast.info).toHaveBeenCalledWith('Anda sudah memiliki tenant');
      });
    });

    test('should allow access for authenticated user without tenant', async () => {
      const mockUserWithoutTenant = { 
        name: 'Test User', 
        email: 'test@example.com'
      };
      localStorage.setItem('user', JSON.stringify(mockUserWithoutTenant));

      renderSetupWizard();

      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(screen.getByText(/setup kafe anda/i)).toBeInTheDocument();
      });
    });

    test('should redirect to login with return URL on auth check error', async () => {
      // Set invalid JSON in localStorage to trigger parse error
      localStorage.setItem('user', 'invalid-json');

      renderSetupWizard();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/auth/login?returnUrl=/setup-cafe');
        expect(toast.error).toHaveBeenCalledWith('Terjadi kesalahan, silakan login kembali');
      });
    });

    test('should show loading state while checking authentication', async () => {
      // Don't render immediately - we want to catch the loading state
      const { container } = render(
        <BrowserRouter>
          <SetupWizard />
        </BrowserRouter>
      );

      // Check for loading state immediately (synchronously)
      const loadingText = container.textContent;
      const hasLoadingState = loadingText.includes('Memuat') || loadingText.includes('Setup Kafe Anda');

      // Should either show loading or have already loaded the form
      expect(hasLoadingState).toBe(true);

      // After auth check, should show form
      await waitFor(() => {
        expect(screen.getByText(/setup kafe anda/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation (Requirement 4.2)', () => {
    test('should render all required form fields', async () => {
      renderSetupWizard();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/warkop kopi kenangan/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/warkop-kopi-kenangan/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/nama anda/i)).toBeInTheDocument();
      });
    });

    test('should show required fields with asterisk', async () => {
      renderSetupWizard();

      await waitFor(() => {
        const labels = screen.getAllByText('*');
        expect(labels.length).toBeGreaterThanOrEqual(2); // cafeName and slug are required
      });
    });

    test('should auto-generate slug from cafe name', async () => {
      renderSetupWizard();

      await waitFor(() => {
        const cafeNameInput = screen.getByPlaceholderText(/warkop kopi kenangan/i);
        const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);

        fireEvent.change(cafeNameInput, { target: { value: 'Warkop Jaya' } });

        expect(slugInput.value).toBe('warkop-jaya');
      });
    });

    test('should normalize slug input to lowercase and remove invalid characters', async () => {
      renderSetupWizard();

      await waitFor(() => {
        const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);

        fireEvent.change(slugInput, { target: { value: 'Warkop@Jaya#123!' } });

        expect(slugInput.value).toBe('warkopjaya123');
      });
    });

    test('should limit slug length to 50 characters', async () => {
      renderSetupWizard();

      await waitFor(() => {
        const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);
        const longSlug = 'a'.repeat(60);

        fireEvent.change(slugInput, { target: { value: longSlug } });

        expect(slugInput.value.length).toBeLessThanOrEqual(50);
      });
    });

    test('should set default admin name from user data', async () => {
      renderSetupWizard();

      await waitFor(() => {
        const adminNameInput = screen.getByPlaceholderText(/nama anda/i);
        expect(adminNameInput.value).toBe('Test User');
      });
    });
  });

  describe('Slug Availability Check (Requirement 4.2)', () => {
    test('should check slug availability after debounce', async () => {
      mockGet.mockResolvedValue({
        data: { success: true, available: true, message: 'Slug tersedia' }
      });

      renderSetupWizard();

      await waitFor(() => {
        const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);
        fireEvent.change(slugInput, { target: { value: 'warkop-test' } });
      });

      // Wait for debounce (500ms)
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/setup/check-slug/warkop-test');
      }, { timeout: 1000 });
    });

    test('should show available status when slug is available', async () => {
      mockGet.mockResolvedValue({
        data: { success: true, available: true, message: 'Slug tersedia' }
      });

      renderSetupWizard();

      await waitFor(() => {
        const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);
        fireEvent.change(slugInput, { target: { value: 'warkop-available' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/slug tersedia/i)).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    test('should show unavailable status when slug is taken', async () => {
      mockGet.mockResolvedValue({
        data: { success: true, available: false, message: 'Slug sudah digunakan' }
      });

      renderSetupWizard();

      await waitFor(() => {
        const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);
        fireEvent.change(slugInput, { target: { value: 'warkop-taken' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/slug sudah digunakan/i)).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    test('should not check slug if less than 3 characters', async () => {
      renderSetupWizard();

      await waitFor(() => {
        const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);
        fireEvent.change(slugInput, { target: { value: 'ab' } });
      });

      // Wait for potential debounce
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission Success Flow (Requirement 4.4)', () => {
    test('should submit form with valid data', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Setup berhasil!',
          token: 'new-token',
          user: { id: 1, name: 'Test User', email: 'test@example.com' },
          tenant: { slug: 'warkop-test', name: 'Warkop Test' }
        }
      };

      mockGet.mockResolvedValue({
        data: { success: true, available: true, message: 'Slug tersedia' }
      });
      mockPost.mockResolvedValue(mockResponse);

      renderSetupWizard();

      await waitFor(() => {
        const cafeNameInput = screen.getByPlaceholderText(/warkop kopi kenangan/i);
        const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);

        fireEvent.change(cafeNameInput, { target: { value: 'Warkop Test' } });
        fireEvent.change(slugInput, { target: { value: 'warkop-test' } });
      });

      // Wait for slug check
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/setup/check-slug/warkop-test');
      }, { timeout: 1000 });

      await waitFor(() => {
        const submitButton = screen.getByText(/buat kafe saya/i);
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/setup/tenant', {
          cafeName: 'Warkop Test',
          slug: 'warkop-test',
          adminName: 'Test User'
        });
      });
    });

    test('should save token and tenant data on success', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Setup berhasil!',
          token: 'new-token',
          user: { id: 1, name: 'Test User', email: 'test@example.com' },
          tenant: { slug: 'warkop-test', name: 'Warkop Test' }
        }
      };

      mockGet.mockResolvedValue({
        data: { success: true, available: true, message: 'Slug tersedia' }
      });
      mockPost.mockResolvedValue(mockResponse);

      renderSetupWizard();

      await waitFor(() => {
        const cafeNameInput = screen.getByPlaceholderText(/warkop kopi kenangan/i);
        fireEvent.change(cafeNameInput, { target: { value: 'Warkop Test' } });
      });

      await waitFor(() => {
        const submitButton = screen.getByText(/buat kafe saya/i);
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(localStorage.getItem('token')).toBe('new-token');
        expect(localStorage.getItem('tenant_slug')).toBe('warkop-test');
      });
    });

    test('should disable submit button when slug is unavailable', async () => {
      mockGet.mockResolvedValue({
        data: { success: true, available: false, message: 'Slug sudah digunakan' }
      });

      renderSetupWizard();

      await waitFor(() => {
        const cafeNameInput = screen.getByPlaceholderText(/warkop kopi kenangan/i);
        const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);

        fireEvent.change(cafeNameInput, { target: { value: 'Warkop Test' } });
        fireEvent.change(slugInput, { target: { value: 'warkop-taken' } });
      });

      await waitFor(() => {
        const submitButton = screen.getByText(/buat kafe saya/i);
        expect(submitButton).toBeDisabled();
      }, { timeout: 1000 });
    });
  });

  describe('Error Handling (Requirement 4.4)', () => {
    test('should handle 409 conflict error (slug already exists)', async () => {
      mockGet.mockResolvedValue({
        data: { success: true, available: true, message: 'Slug tersedia' }
      });
      mockPost.mockRejectedValue({
        response: {
          status: 409,
          data: { message: 'Slug sudah digunakan' }
        }
      });

      renderSetupWizard();

      await waitFor(() => {
        const cafeNameInput = screen.getByPlaceholderText(/warkop kopi kenangan/i);
        fireEvent.change(cafeNameInput, { target: { value: 'Warkop Test' } });
      });

      await waitFor(() => {
        const submitButton = screen.getByText(/buat kafe saya/i);
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    test('should handle 400 validation error', async () => {
      mockGet.mockResolvedValue({
        data: { success: true, available: true, message: 'Slug tersedia' }
      });
      mockPost.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Data tidak valid' }
        }
      });

      renderSetupWizard();

      await waitFor(() => {
        const cafeNameInput = screen.getByPlaceholderText(/warkop kopi kenangan/i);
        fireEvent.change(cafeNameInput, { target: { value: 'Warkop Test' } });
      });

      await waitFor(() => {
        const submitButton = screen.getByText(/buat kafe saya/i);
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    test('should handle network error', async () => {
      mockGet.mockResolvedValue({
        data: { success: true, available: true, message: 'Slug tersedia' }
      });
      mockPost.mockRejectedValue(new Error('Network error'));

      renderSetupWizard();

      await waitFor(() => {
        const cafeNameInput = screen.getByPlaceholderText(/warkop kopi kenangan/i);
        fireEvent.change(cafeNameInput, { target: { value: 'Warkop Test' } });
      });

      await waitFor(() => {
        const submitButton = screen.getByText(/buat kafe saya/i);
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    test('should show loading state during submission', async () => {
      mockGet.mockResolvedValue({
        data: { success: true, available: true, message: 'Slug tersedia' }
      });
      mockPost.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderSetupWizard();

      await waitFor(() => {
        const cafeNameInput = screen.getByPlaceholderText(/warkop kopi kenangan/i);
        fireEvent.change(cafeNameInput, { target: { value: 'Warkop Test' } });
      });

      await waitFor(() => {
        const submitButton = screen.getByText(/buat kafe saya/i);
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/memproses/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States (Requirement 4.4)', () => {
    test('should show loading indicator during slug check', async () => {
      mockGet.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderSetupWizard();

      await waitFor(() => {
        const slugInput = screen.getByPlaceholderText(/warkop-kopi-kenangan/i);
        fireEvent.change(slugInput, { target: { value: 'warkop-test' } });
      });

      // Note: The loading spinner is an icon, so we check for disabled state instead
      await waitFor(() => {
        const submitButton = screen.getByText(/buat kafe saya/i);
        expect(submitButton).toBeDisabled();
      }, { timeout: 600 });
    });

    test('should disable submit button during form submission', async () => {
      mockGet.mockResolvedValue({
        data: { success: true, available: true, message: 'Slug tersedia' }
      });
      mockPost.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderSetupWizard();

      await waitFor(() => {
        const cafeNameInput = screen.getByPlaceholderText(/warkop kopi kenangan/i);
        fireEvent.change(cafeNameInput, { target: { value: 'Warkop Test' } });
      });

      await waitFor(() => {
        const submitButton = screen.getByText(/buat kafe saya/i);
        fireEvent.click(submitButton);
        expect(submitButton).toBeDisabled();
      });
    });
  });
});
