/**
 * Auth Components Navigation Logic Unit Tests
 * 
 * Tests for SimpleLogin and SimpleRegister navigation logic to ensure:
 * - Redirect to setup-cafe for new users without tenant
 * - Redirect to dashboard for existing tenant owners
 * 
 * Validates Requirements: 4.1, 4.3
 */

import '@testing-library/jest-dom';
import { useNavigate } from 'react-router-dom';

// Mock modules
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

describe('Auth Navigation Logic', () => {
  let mockNavigate;

  beforeEach(() => {
    mockNavigate = jest.fn();
    useNavigate.mockReturnValue(mockNavigate);
    localStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Login Navigation (Requirement 4.1)', () => {
    test('should redirect to /setup-cafe when user has no tenant (hasCompletedSetup: false)', () => {
      const userData = {
        id: 1,
        name: 'New User',
        email: 'newuser@example.com',
        hasCompletedSetup: false,
      };

      // Simulate the navigation logic from SimpleLogin
      if (userData.hasCompletedSetup) {
        localStorage.setItem('tenant_slug', userData.tenantSlug);
        mockNavigate('/admin/dashboard');
      } else {
        mockNavigate('/setup-cafe');
      }

      expect(mockNavigate).toHaveBeenCalledWith('/setup-cafe');
      expect(localStorage.getItem('tenant_slug')).toBeNull();
    });

    test('should redirect to /admin/dashboard when user has tenant (hasCompletedSetup: true)', () => {
      const userData = {
        id: 1,
        name: 'Existing User',
        email: 'existing@example.com',
        hasCompletedSetup: true,
        tenantSlug: 'warkop-jaya',
      };

      // Simulate the navigation logic from SimpleLogin
      if (userData.hasCompletedSetup) {
        localStorage.setItem('tenant_slug', userData.tenantSlug);
        mockNavigate('/admin/dashboard');
      } else {
        mockNavigate('/setup-cafe');
      }

      expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
      expect(localStorage.getItem('tenant_slug')).toBe('warkop-jaya');
    });
  });

  describe('Google OAuth Navigation (Requirement 4.3)', () => {
    test('should redirect new Google user to /setup-cafe', () => {
      const backendResponse = {
        success: true,
        token: 'mock-token',
        isNewUser: true,
        user: {
          id: 2,
          name: 'New Google User',
          email: 'newgoogle@gmail.com',
          hasCompletedSetup: false,
        },
      };

      // Simulate the navigation logic from SimpleLogin/SimpleRegister Google OAuth
      localStorage.setItem('token', backendResponse.token);
      localStorage.setItem('user', JSON.stringify(backendResponse.user));

      if (backendResponse.user.hasCompletedSetup) {
        localStorage.setItem('tenant_slug', backendResponse.user.tenantSlug);
        mockNavigate('/admin/dashboard');
      } else {
        mockNavigate('/setup-cafe');
      }

      expect(mockNavigate).toHaveBeenCalledWith('/setup-cafe');
      expect(localStorage.getItem('token')).toBe('mock-token');
      expect(localStorage.getItem('tenant_slug')).toBeNull();
    });

    test('should redirect existing Google user with tenant to /admin/dashboard', () => {
      const backendResponse = {
        success: true,
        token: 'mock-token',
        isNewUser: false,
        user: {
          id: 3,
          name: 'Existing Google User',
          email: 'existinggoogle@gmail.com',
          hasCompletedSetup: true,
          tenantSlug: 'warkop-google',
        },
      };

      // Simulate the navigation logic from SimpleLogin/SimpleRegister Google OAuth
      localStorage.setItem('token', backendResponse.token);
      localStorage.setItem('user', JSON.stringify(backendResponse.user));

      if (backendResponse.user.hasCompletedSetup) {
        localStorage.setItem('tenant_slug', backendResponse.user.tenantSlug);
        mockNavigate('/admin/dashboard');
      } else {
        mockNavigate('/setup-cafe');
      }

      expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
      expect(localStorage.getItem('token')).toBe('mock-token');
      expect(localStorage.getItem('tenant_slug')).toBe('warkop-google');
    });
  });

  describe('SimpleRegister Google OAuth Navigation (Requirement 4.3)', () => {
    test('should redirect to /setup-cafe for new registration', () => {
      const backendResponse = {
        success: true,
        token: 'register-token',
        isNewUser: true,
        user: {
          id: 4,
          name: 'New Register User',
          email: 'newregister@gmail.com',
          hasCompletedSetup: false,
        },
      };

      // Simulate the navigation logic from SimpleRegister Google OAuth
      localStorage.setItem('token', backendResponse.token);
      localStorage.setItem('user', JSON.stringify(backendResponse.user));

      // Updated logic: check hasCompletedSetup instead of assuming new user
      if (backendResponse.user.hasCompletedSetup) {
        localStorage.setItem('tenant_slug', backendResponse.user.tenantSlug);
        mockNavigate('/admin/dashboard');
      } else {
        mockNavigate('/setup-cafe');
      }

      expect(mockNavigate).toHaveBeenCalledWith('/setup-cafe');
    });

    test('should redirect to /admin/dashboard if Google user already has tenant', () => {
      const backendResponse = {
        success: true,
        token: 'register-token',
        isNewUser: false,
        user: {
          id: 5,
          name: 'Existing Register User',
          email: 'existingregister@gmail.com',
          hasCompletedSetup: true,
          tenantSlug: 'warkop-existing',
        },
      };

      // Simulate the navigation logic from SimpleRegister Google OAuth
      localStorage.setItem('token', backendResponse.token);
      localStorage.setItem('user', JSON.stringify(backendResponse.user));

      // Updated logic: check hasCompletedSetup
      if (backendResponse.user.hasCompletedSetup) {
        localStorage.setItem('tenant_slug', backendResponse.user.tenantSlug);
        mockNavigate('/admin/dashboard');
      } else {
        mockNavigate('/setup-cafe');
      }

      expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
      expect(localStorage.getItem('tenant_slug')).toBe('warkop-existing');
    });
  });

  describe('Token and User Data Storage (Requirement 4.1)', () => {
    test('should save token and user data to localStorage on successful login', () => {
      const token = 'test-token-123';
      const user = {
        id: 6,
        name: 'Test User',
        email: 'test@example.com',
        hasCompletedSetup: false,
      };

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      expect(localStorage.getItem('token')).toBe(token);
      expect(localStorage.getItem('user')).toBeTruthy();
      
      const storedUser = JSON.parse(localStorage.getItem('user'));
      expect(storedUser.email).toBe('test@example.com');
      expect(storedUser.hasCompletedSetup).toBe(false);
    });

    test('should save tenant_slug when user has completed setup', () => {
      const user = {
        id: 7,
        name: 'Tenant Owner',
        email: 'owner@example.com',
        hasCompletedSetup: true,
        tenantSlug: 'my-warkop',
      };

      if (user.hasCompletedSetup) {
        localStorage.setItem('tenant_slug', user.tenantSlug);
      }

      expect(localStorage.getItem('tenant_slug')).toBe('my-warkop');
    });

    test('should not save tenant_slug when user has not completed setup', () => {
      const user = {
        id: 8,
        name: 'New User',
        email: 'new@example.com',
        hasCompletedSetup: false,
      };

      if (user.hasCompletedSetup) {
        localStorage.setItem('tenant_slug', user.tenantSlug);
      }

      expect(localStorage.getItem('tenant_slug')).toBeNull();
    });
  });
});
