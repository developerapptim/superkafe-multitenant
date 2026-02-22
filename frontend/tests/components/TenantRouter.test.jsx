import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TenantRouter, { 
    isValidSlugFormat, 
    extractTenantFromJWT,
    useTenant 
} from '../../src/components/TenantRouter';

// Mock localStorage
const mockLocalStorage = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        clear: () => { store = {}; },
        removeItem: (key) => { delete store[key]; }
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage
});

// Helper to create JWT token
function createMockJWT(payload) {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = btoa(JSON.stringify(payload));
    const signature = 'mock-signature';
    return `${header}.${body}.${signature}`;
}

describe('TenantRouter - Slug Validation', () => {
    describe('isValidSlugFormat', () => {
        it('should accept valid lowercase alphanumeric slugs', () => {
            expect(isValidSlugFormat('cafe-mocha')).toBe(true);
            expect(isValidSlugFormat('warung-kopi-123')).toBe(true);
            expect(isValidSlugFormat('abc123')).toBe(true);
        });

        it('should reject slugs with uppercase letters', () => {
            expect(isValidSlugFormat('Cafe-Mocha')).toBe(false);
            expect(isValidSlugFormat('CAFE')).toBe(false);
        });

        it('should reject slugs with special characters', () => {
            expect(isValidSlugFormat('cafe_mocha')).toBe(false);
            expect(isValidSlugFormat('cafe.mocha')).toBe(false);
            expect(isValidSlugFormat('café-mocha')).toBe(false);
        });

        it('should reject slugs starting or ending with hyphen', () => {
            expect(isValidSlugFormat('-cafe')).toBe(false);
            expect(isValidSlugFormat('cafe-')).toBe(false);
        });

        it('should reject empty or invalid inputs', () => {
            expect(isValidSlugFormat('')).toBe(false);
            expect(isValidSlugFormat(null)).toBe(false);
            expect(isValidSlugFormat(undefined)).toBe(false);
            expect(isValidSlugFormat(123)).toBe(false);
        });

        it('should reject slugs with consecutive hyphens', () => {
            expect(isValidSlugFormat('cafe--mocha')).toBe(false);
        });
    });
});

describe('TenantRouter - JWT Extraction', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('extractTenantFromJWT', () => {
        it('should extract tenant information from valid JWT', () => {
            const token = createMockJWT({
                tenant: 'cafe-mocha',
                userId: 'user123',
                tenantDbName: 'tenant_cafe_mocha'
            });

            const result = extractTenantFromJWT(token);
            
            expect(result).toEqual({
                tenantSlug: 'cafe-mocha',
                tenantId: 'user123',
                tenantDbName: 'tenant_cafe_mocha'
            });
        });

        it('should return null for missing token', () => {
            expect(extractTenantFromJWT(null)).toBe(null);
            expect(extractTenantFromJWT(undefined)).toBe(null);
            expect(extractTenantFromJWT('')).toBe(null);
        });

        it('should return null for invalid JWT format', () => {
            expect(extractTenantFromJWT('invalid-token')).toBe(null);
            expect(extractTenantFromJWT('not.a.jwt')).toBe(null);
        });

        it('should handle JWT without tenant information', () => {
            const token = createMockJWT({
                email: 'user@example.com',
                role: 'admin'
            });

            const result = extractTenantFromJWT(token);
            
            expect(result).toEqual({
                tenantSlug: null,
                tenantId: null,
                tenantDbName: null
            });
        });

        it('should handle partial tenant information', () => {
            const token = createMockJWT({
                tenant: 'cafe-mocha'
                // Missing userId and tenantDbName
            });

            const result = extractTenantFromJWT(token);
            
            expect(result.tenantSlug).toBe('cafe-mocha');
            expect(result.tenantId).toBe(null);
            expect(result.tenantDbName).toBe(null);
        });
    });
});

describe('TenantRouter - Context Provider', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should provide tenant context to children when authenticated', () => {
        const token = createMockJWT({
            tenant: 'cafe-mocha',
            userId: 'user123',
            tenantDbName: 'tenant_cafe_mocha'
        });
        localStorage.setItem('token', token);

        function TestComponent() {
            const tenant = useTenant();
            return (
                <div>
                    <span data-testid="slug">{tenant.tenantSlug}</span>
                    <span data-testid="id">{tenant.tenantId}</span>
                    <span data-testid="auth">{tenant.isAuthenticated.toString()}</span>
                </div>
            );
        }

        render(
            <BrowserRouter>
                <TenantRouter>
                    <TestComponent />
                </TenantRouter>
            </BrowserRouter>
        );

        expect(screen.getByTestId('slug').textContent).toBe('cafe-mocha');
        expect(screen.getByTestId('id').textContent).toBe('user123');
        expect(screen.getByTestId('auth').textContent).toBe('true');
    });

    it('should provide null context when not authenticated', () => {
        // No token in localStorage

        function TestComponent() {
            const tenant = useTenant();
            return (
                <div>
                    <span data-testid="slug">{String(tenant.tenantSlug)}</span>
                    <span data-testid="auth">{tenant.isAuthenticated.toString()}</span>
                </div>
            );
        }

        render(
            <BrowserRouter>
                <TenantRouter>
                    <TestComponent />
                </TenantRouter>
            </BrowserRouter>
        );

        expect(screen.getByTestId('slug').textContent).toBe('null');
        expect(screen.getByTestId('auth').textContent).toBe('false');
    });

    it('should throw error when useTenant is used outside TenantRouter', () => {
        function TestComponent() {
            useTenant();
            return <div>Test</div>;
        }

        // Suppress console.error for this test
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => {
            render(
                <BrowserRouter>
                    <TestComponent />
                </BrowserRouter>
            );
        }).toThrow('useTenant must be used within TenantRouter');

        consoleSpy.mockRestore();
    });
});

describe('TenantRouter - Slug Validation Methods', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should validate matching slugs correctly', () => {
        const token = createMockJWT({
            tenant: 'cafe-mocha',
            userId: 'user123'
        });
        localStorage.setItem('token', token);

        function TestComponent() {
            const tenant = useTenant();
            const isValid = tenant.validateSlugMatch('cafe-mocha');
            return <span data-testid="result">{isValid.toString()}</span>;
        }

        render(
            <BrowserRouter>
                <TenantRouter>
                    <TestComponent />
                </TenantRouter>
            </BrowserRouter>
        );

        expect(screen.getByTestId('result').textContent).toBe('true');
    });

    it('should detect slug mismatch', () => {
        const token = createMockJWT({
            tenant: 'cafe-mocha',
            userId: 'user123'
        });
        localStorage.setItem('token', token);

        function TestComponent() {
            const tenant = useTenant();
            const isValid = tenant.validateSlugMatch('wrong-slug');
            return <span data-testid="result">{isValid.toString()}</span>;
        }

        render(
            <BrowserRouter>
                <TenantRouter>
                    <TestComponent />
                </TenantRouter>
            </BrowserRouter>
        );

        expect(screen.getByTestId('result').textContent).toBe('false');
    });

    it('should handle case-insensitive slug comparison', () => {
        const token = createMockJWT({
            tenant: 'cafe-mocha',
            userId: 'user123'
        });
        localStorage.setItem('token', token);

        function TestComponent() {
            const tenant = useTenant();
            const isValid = tenant.validateSlugMatch('Cafe-Mocha');
            return <span data-testid="result">{isValid.toString()}</span>;
        }

        render(
            <BrowserRouter>
                <TenantRouter>
                    <TestComponent />
                </TenantRouter>
            </BrowserRouter>
        );

        expect(screen.getByTestId('result').textContent).toBe('true');
    });

    it('should return false when no tenant in JWT', () => {
        const token = createMockJWT({
            email: 'user@example.com'
            // No tenant field
        });
        localStorage.setItem('token', token);

        function TestComponent() {
            const tenant = useTenant();
            const isValid = tenant.validateSlugMatch('any-slug');
            return <span data-testid="result">{isValid.toString()}</span>;
        }

        render(
            <BrowserRouter>
                <TenantRouter>
                    <TestComponent />
                </TenantRouter>
            </BrowserRouter>
        );

        expect(screen.getByTestId('result').textContent).toBe('false');
    });
});

describe('TenantRouter - Path Generation', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should generate tenant-specific paths', () => {
        const token = createMockJWT({
            tenant: 'cafe-mocha',
            userId: 'user123'
        });
        localStorage.setItem('token', token);

        function TestComponent() {
            const tenant = useTenant();
            const path = tenant.getTenantPath('/admin/dashboard');
            return <span data-testid="path">{path}</span>;
        }

        render(
            <BrowserRouter>
                <TenantRouter>
                    <TestComponent />
                </TenantRouter>
            </BrowserRouter>
        );

        expect(screen.getByTestId('path').textContent).toBe('/cafe-mocha/admin/dashboard');
    });

    it('should handle paths without leading slash', () => {
        const token = createMockJWT({
            tenant: 'cafe-mocha',
            userId: 'user123'
        });
        localStorage.setItem('token', token);

        function TestComponent() {
            const tenant = useTenant();
            const path = tenant.getTenantPath('admin/menu');
            return <span data-testid="path">{path}</span>;
        }

        render(
            <BrowserRouter>
                <TenantRouter>
                    <TestComponent />
                </TenantRouter>
            </BrowserRouter>
        );

        expect(screen.getByTestId('path').textContent).toBe('/cafe-mocha/admin/menu');
    });

    it('should return original path when no tenant available', () => {
        // No token in localStorage
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        function TestComponent() {
            const tenant = useTenant();
            const path = tenant.getTenantPath('/admin/dashboard');
            return <span data-testid="path">{path}</span>;
        }

        render(
            <BrowserRouter>
                <TenantRouter>
                    <TestComponent />
                </TenantRouter>
            </BrowserRouter>
        );

        expect(screen.getByTestId('path').textContent).toBe('/admin/dashboard');
        expect(consoleSpy).toHaveBeenCalledWith(
            'Cannot generate tenant path: No tenant slug available'
        );

        consoleSpy.mockRestore();
    });
});

describe('TenantRouter - Edge Cases', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should handle malformed JWT gracefully', () => {
        localStorage.setItem('token', 'malformed.jwt.token');

        function TestComponent() {
            const tenant = useTenant();
            return <span data-testid="auth">{tenant.isAuthenticated.toString()}</span>;
        }

        render(
            <BrowserRouter>
                <TenantRouter>
                    <TestComponent />
                </TenantRouter>
            </BrowserRouter>
        );

        expect(screen.getByTestId('auth').textContent).toBe('false');
    });

    it('should handle JWT with invalid base64 encoding', () => {
        localStorage.setItem('token', 'invalid.!!!invalid!!!.signature');

        function TestComponent() {
            const tenant = useTenant();
            return <span data-testid="auth">{tenant.isAuthenticated.toString()}</span>;
        }

        render(
            <BrowserRouter>
                <TenantRouter>
                    <TestComponent />
                </TenantRouter>
            </BrowserRouter>
        );

        expect(screen.getByTestId('auth').textContent).toBe('false');
    });
});
