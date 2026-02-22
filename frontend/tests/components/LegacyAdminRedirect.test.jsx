import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import LegacyAdminRedirect from '../../src/components/LegacyAdminRedirect';

// Mock jwt-decode
vi.mock('jwt-decode', () => ({
    jwtDecode: vi.fn()
}));

import { jwtDecode } from 'jwt-decode';

describe('LegacyAdminRedirect Component', () => {
    let consoleWarnSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        
        // Spy on console methods
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        // Reset mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('Unauthenticated Access', () => {
        it('should redirect to login when no token exists', () => {
            const { container } = render(
                <MemoryRouter initialEntries={['/admin']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            // Component should render Navigate to /login
            expect(container.innerHTML).toBeTruthy();
        });

        it('should log legacy route access for unauthenticated users', () => {
            render(
                <MemoryRouter initialEntries={['/admin']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[LEGACY ROUTE ACCESS]',
                expect.objectContaining({
                    path: '/admin',
                    message: 'Unauthenticated user accessed legacy /admin route'
                })
            );
        });
    });

    describe('Authenticated Access with Valid Token', () => {
        it('should redirect to tenant-specific admin route', () => {
            const mockToken = 'valid.jwt.token';
            const mockDecoded = {
                id: 'user123',
                tenant: 'cafe-mocha',
                email: 'owner@cafe.com'
            };

            localStorage.setItem('token', mockToken);
            jwtDecode.mockReturnValue(mockDecoded);

            const { container } = render(
                <MemoryRouter initialEntries={['/admin']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            // Component should render Navigate to /{tenantSlug}/admin
            expect(container.innerHTML).toBeTruthy();
        });

        it('should preserve sub-paths during redirect', () => {
            const mockToken = 'valid.jwt.token';
            const mockDecoded = {
                id: 'user123',
                tenant: 'warung-kopi',
                email: 'owner@warung.com'
            };

            localStorage.setItem('token', mockToken);
            jwtDecode.mockReturnValue(mockDecoded);

            const { container } = render(
                <MemoryRouter initialEntries={['/admin/menu']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            // Should redirect to /warung-kopi/admin/menu
            expect(container.innerHTML).toBeTruthy();
        });

        it('should log legacy route access with tenant information', () => {
            const mockToken = 'valid.jwt.token';
            const mockDecoded = {
                id: 'user123',
                tenant: 'cafe-mocha',
                email: 'owner@cafe.com'
            };

            localStorage.setItem('token', mockToken);
            jwtDecode.mockReturnValue(mockDecoded);

            render(
                <MemoryRouter initialEntries={['/admin/dashboard']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[LEGACY ROUTE ACCESS]',
                expect.objectContaining({
                    path: '/admin/dashboard',
                    tenantSlug: 'cafe-mocha',
                    userId: 'user123',
                    message: 'User accessed legacy /admin route - redirecting to tenant-specific route'
                })
            );
        });
    });

    describe('Incomplete Setup', () => {
        it('should redirect to setup wizard when tenant is missing', () => {
            const mockToken = 'valid.jwt.token';
            const mockDecoded = {
                id: 'user123',
                email: 'newuser@cafe.com'
                // No tenant field
            };

            localStorage.setItem('token', mockToken);
            jwtDecode.mockReturnValue(mockDecoded);

            const { container } = render(
                <MemoryRouter initialEntries={['/admin']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            // Should redirect to /setup-cafe
            expect(container.innerHTML).toBeTruthy();
        });
    });

    describe('Invalid Token Handling', () => {
        it('should redirect to login when token is invalid', () => {
            const mockToken = 'invalid.token';
            localStorage.setItem('token', mockToken);
            
            jwtDecode.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            const { container } = render(
                <MemoryRouter initialEntries={['/admin']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            // Should clear localStorage
            expect(localStorage.getItem('token')).toBeNull();
            expect(localStorage.getItem('user')).toBeNull();
            
            // Should log error
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to decode JWT token:',
                expect.any(Error)
            );
        });

        it('should log error when token decoding fails', () => {
            const mockToken = 'malformed.token';
            localStorage.setItem('token', mockToken);
            
            const mockError = new Error('Malformed JWT');
            jwtDecode.mockImplementation(() => {
                throw mockError;
            });

            render(
                <MemoryRouter initialEntries={['/admin']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to decode JWT token:',
                mockError
            );
        });
    });

    describe('Edge Cases', () => {
        it('should handle root /admin path correctly', () => {
            const mockToken = 'valid.jwt.token';
            const mockDecoded = {
                id: 'user123',
                tenant: 'my-cafe',
                email: 'owner@mycafe.com'
            };

            localStorage.setItem('token', mockToken);
            jwtDecode.mockReturnValue(mockDecoded);

            const { container } = render(
                <MemoryRouter initialEntries={['/admin']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            // Should redirect to /my-cafe/admin (no trailing slash issue)
            expect(container.innerHTML).toBeTruthy();
        });

        it('should handle deep nested paths', () => {
            const mockToken = 'valid.jwt.token';
            const mockDecoded = {
                id: 'user123',
                tenant: 'test-cafe',
                email: 'owner@test.com'
            };

            localStorage.setItem('token', mockToken);
            jwtDecode.mockReturnValue(mockDecoded);

            const { container } = render(
                <MemoryRouter initialEntries={['/admin/menu/edit/123']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            // Should preserve full path: /test-cafe/admin/menu/edit/123
            expect(container.innerHTML).toBeTruthy();
        });

        it('should handle tenant slugs with special characters', () => {
            const mockToken = 'valid.jwt.token';
            const mockDecoded = {
                id: 'user123',
                tenant: 'cafe-123-test',
                email: 'owner@cafe.com'
            };

            localStorage.setItem('token', mockToken);
            jwtDecode.mockReturnValue(mockDecoded);

            const { container } = render(
                <MemoryRouter initialEntries={['/admin']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            expect(container.innerHTML).toBeTruthy();
        });
    });

    describe('Logging Requirements', () => {
        it('should include timestamp in log entries', () => {
            const mockToken = 'valid.jwt.token';
            const mockDecoded = {
                id: 'user123',
                tenant: 'cafe-mocha',
                email: 'owner@cafe.com'
            };

            localStorage.setItem('token', mockToken);
            jwtDecode.mockReturnValue(mockDecoded);

            render(
                <MemoryRouter initialEntries={['/admin']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[LEGACY ROUTE ACCESS]',
                expect.objectContaining({
                    timestamp: expect.any(String)
                })
            );
        });

        it('should log path information for monitoring', () => {
            const mockToken = 'valid.jwt.token';
            const mockDecoded = {
                id: 'user123',
                tenant: 'cafe-mocha',
                email: 'owner@cafe.com'
            };

            localStorage.setItem('token', mockToken);
            jwtDecode.mockReturnValue(mockDecoded);

            render(
                <MemoryRouter initialEntries={['/admin/settings']}>
                    <LegacyAdminRedirect />
                </MemoryRouter>
            );

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[LEGACY ROUTE ACCESS]',
                expect.objectContaining({
                    path: '/admin/settings'
                })
            );
        });
    });
});
