import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route, MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../../src/components/ProtectedRoute';
import toast from 'react-hot-toast';

// Mock dependencies
jest.mock('react-hot-toast');
jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn()
}));

const { jwtDecode } = require('jwt-decode');

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  const TestComponent = () => <div>Protected Content</div>;
  const LoginComponent = () => <div>Login Page</div>;
  const SetupComponent = () => <div>Setup Page</div>;

  const renderWithRouter = (initialPath, tenantSlug = null) => {
    const path = tenantSlug ? `/${tenantSlug}/admin/dashboard` : '/admin/dashboard';
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<LoginComponent />} />
          <Route path="/setup-cafe" element={<SetupComponent />} />
          <Route
            path="/:tenantSlug/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin', 'kasir']}>
                <TestComponent />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin', 'kasir']} requireTenant={false}>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Authentication Checks', () => {
    test('should redirect to login when no token exists', () => {
      renderWithRouter('/cafe-test/admin/dashboard');
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });

    test('should redirect to login when token is invalid', () => {
      localStorage.setItem('token', 'invalid-token');
      localStorage.setItem('user', JSON.stringify({ role: 'admin' }));
      jwtDecode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      renderWithRouter('/cafe-test/admin/dashboard');
      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  describe('Tenant Validation (requireTenant=true)', () => {
    test('should redirect to setup when user has not completed setup', () => {
      const token = 'valid-token';
      const user = { role: 'admin', hasCompletedSetup: false };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      jwtDecode.mockReturnValue({ tenant: null });

      renderWithRouter('/cafe-test/admin/dashboard');
      expect(screen.getByText('Setup Page')).toBeInTheDocument();
    });

    test('should redirect to setup when JWT has no tenant', () => {
      const token = 'valid-token';
      const user = { role: 'admin', hasCompletedSetup: true };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      jwtDecode.mockReturnValue({ tenant: null });

      renderWithRouter('/cafe-test/admin/dashboard');
      expect(screen.getByText('Setup Page')).toBeInTheDocument();
    });

    test('should redirect to correct tenant when URL slug mismatches JWT slug', () => {
      const token = 'valid-token';
      const user = { 
        role: 'admin', 
        hasCompletedSetup: true,
        tenantSlug: 'correct-cafe'
      };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      jwtDecode.mockReturnValue({ tenant: 'correct-cafe' });

      renderWithRouter('/wrong-cafe/admin/dashboard');
      
      // Should show toast error
      expect(toast.error).toHaveBeenCalledWith('Redirecting to your dashboard...');
    });

    test('should allow access when URL slug matches JWT slug', () => {
      const token = 'valid-token';
      const user = { 
        role: 'admin', 
        hasCompletedSetup: true,
        tenantSlug: 'cafe-test'
      };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      jwtDecode.mockReturnValue({ tenant: 'cafe-test' });

      renderWithRouter('/cafe-test/admin/dashboard');
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('Tenant Validation (requireTenant=false)', () => {
    test('should allow access without tenant validation', () => {
      const token = 'valid-token';
      const user = { role: 'admin' };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      jwtDecode.mockReturnValue({});

      renderWithRouter('/admin/dashboard');
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('Role Authorization', () => {
    test('should redirect when user role is not allowed', () => {
      const token = 'valid-token';
      const user = { 
        role: 'staf', 
        hasCompletedSetup: true,
        tenantSlug: 'cafe-test'
      };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      jwtDecode.mockReturnValue({ tenant: 'cafe-test' });

      renderWithRouter('/cafe-test/admin/dashboard');
      
      // Should redirect to dashboard (which would then show unauthorized)
      // In real app, this would redirect to appropriate page
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    test('should allow access when user role is allowed', () => {
      const token = 'valid-token';
      const user = { 
        role: 'kasir', 
        hasCompletedSetup: true,
        tenantSlug: 'cafe-test'
      };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      jwtDecode.mockReturnValue({ tenant: 'cafe-test' });

      renderWithRouter('/cafe-test/admin/dashboard');
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });
});
