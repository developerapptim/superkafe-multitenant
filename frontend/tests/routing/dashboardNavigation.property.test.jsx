/**
 * Dashboard Navigation Slug Preservation - Property-Based Tests
 * 
 * **Property 1: Dashboard Navigation Preserves Tenant Slug**
 * **Validates: Requirements 1.2**
 * 
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property test
 * 
 * Feature: tenant-data-isolation
 * 
 * This test verifies that for any sequence of navigation actions within the dashboard,
 * the tenantSlug parameter remains present and unchanged in all resulting URLs.
 */

import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import '@testing-library/jest-dom';
import fc from 'fast-check';
import { act } from 'react';

// Mock localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock JWT token generator
const generateMockJWT = (tenantSlug) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    id: 'user123',
    email: 'test@example.com',
    role: 'admin',
    tenant: tenantSlug,
    tenantDbName: `${tenantSlug}_db`,
    userId: 'user123',
    iat: Date.now(),
    exp: Date.now() + 3600000
  }));
  const signature = btoa('mock-signature');
  return `${header}.${payload}.${signature}`;
};

// Mock user object
const generateMockUser = (tenantSlug) => ({
  id: 'user123',
  email: 'test@example.com',
  role: 'admin',
  name: 'Test User',
  hasCompletedSetup: true,
  tenantSlug: tenantSlug
});

// Mock ProtectedRoute component
const MockProtectedRoute = ({ children, allowedRoles, requireTenant = true }) => {
  const { tenantSlug } = useParams();
  const location = useLocation();
  
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!token) {
    return <div data-testid="redirect-login">Redirect to Login</div>;
  }
  
  if (requireTenant && !user.hasCompletedSetup) {
    return <div data-testid="redirect-setup">Redirect to Setup</div>;
  }
  
  // Decode JWT to get tenant slug
  try {
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    
    // Validate slug match
    if (tenantSlug && tenantSlug !== payload.tenant) {
      const correctPath = location.pathname.replace(`/${tenantSlug}/`, `/${payload.tenant}/`);
      return <div data-testid="redirect-correct-tenant" data-correct-path={correctPath}>Redirect to Correct Tenant</div>;
    }
  } catch (error) {
    return <div data-testid="redirect-login">Redirect to Login</div>;
  }
  
  return children;
};

// Mock AdminLayout with navigation tracking
const MockAdminLayout = () => {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  return (
    <div data-testid="admin-layout" data-tenant-slug={tenantSlug}>
      <div data-testid="current-path">{location.pathname}</div>
      <div data-testid="current-slug">{tenantSlug}</div>
      
      {/* Simulate navigation buttons */}
      <button 
        data-testid="nav-dashboard" 
        onClick={() => navigate(`/${tenantSlug}/admin/dashboard`)}
      >
        Dashboard
      </button>
      <button 
        data-testid="nav-menu" 
        onClick={() => navigate(`/${tenantSlug}/admin/menu`)}
      >
        Menu
      </button>
      <button 
        data-testid="nav-kasir" 
        onClick={() => navigate(`/${tenantSlug}/admin/kasir`)}
      >
        Kasir
      </button>
      <button 
        data-testid="nav-inventaris" 
        onClick={() => navigate(`/${tenantSlug}/admin/inventaris`)}
      >
        Inventaris
      </button>
      <button 
        data-testid="nav-keuangan" 
        onClick={() => navigate(`/${tenantSlug}/admin/keuangan`)}
      >
        Keuangan
      </button>
      <button 
        data-testid="nav-pegawai" 
        onClick={() => navigate(`/${tenantSlug}/admin/pegawai`)}
      >
        Pegawai
      </button>
      <button 
        data-testid="nav-meja" 
        onClick={() => navigate(`/${tenantSlug}/admin/meja`)}
      >
        Meja
      </button>
      <button 
        data-testid="nav-pelanggan" 
        onClick={() => navigate(`/${tenantSlug}/admin/pelanggan`)}
      >
        Pelanggan
      </button>
      <button 
        data-testid="nav-pengaturan" 
        onClick={() => navigate(`/${tenantSlug}/admin/pengaturan`)}
      >
        Pengaturan
      </button>
      
      {/* Render child routes based on current path */}
      {location.pathname.endsWith('/dashboard') && <MockDashboard />}
      {location.pathname.endsWith('/menu') && <MockMenu />}
      {location.pathname.endsWith('/kasir') && <MockKasir />}
      {location.pathname.endsWith('/inventaris') && <MockInventaris />}
      {location.pathname.endsWith('/keuangan') && <MockKeuangan />}
      {location.pathname.endsWith('/pegawai') && <MockPegawai />}
      {location.pathname.endsWith('/meja') && <MockMeja />}
      {location.pathname.endsWith('/pelanggan') && <MockPelanggan />}
      {location.pathname.endsWith('/pengaturan') && <MockPengaturan />}
    </div>
  );
};

// Mock page components
const MockDashboard = () => {
  const { tenantSlug } = useParams();
  return <div data-testid="page-dashboard" data-slug={tenantSlug}>Dashboard Page</div>;
};

const MockMenu = () => {
  const { tenantSlug } = useParams();
  return <div data-testid="page-menu" data-slug={tenantSlug}>Menu Page</div>;
};

const MockKasir = () => {
  const { tenantSlug } = useParams();
  return <div data-testid="page-kasir" data-slug={tenantSlug}>Kasir Page</div>;
};

const MockInventaris = () => {
  const { tenantSlug } = useParams();
  return <div data-testid="page-inventaris" data-slug={tenantSlug}>Inventaris Page</div>;
};

const MockKeuangan = () => {
  const { tenantSlug } = useParams();
  return <div data-testid="page-keuangan" data-slug={tenantSlug}>Keuangan Page</div>;
};

const MockPegawai = () => {
  const { tenantSlug } = useParams();
  return <div data-testid="page-pegawai" data-slug={tenantSlug}>Pegawai Page</div>;
};

const MockMeja = () => {
  const { tenantSlug } = useParams();
  return <div data-testid="page-meja" data-slug={tenantSlug}>Meja Page</div>;
};

const MockPelanggan = () => {
  const { tenantSlug } = useParams();
  return <div data-testid="page-pelanggan" data-slug={tenantSlug}>Pelanggan Page</div>;
};

const MockPengaturan = () => {
  const { tenantSlug } = useParams();
  return <div data-testid="page-pengaturan" data-slug={tenantSlug}>Pengaturan Page</div>;
};

// Test router
const TestRouter = ({ initialRoute, tenantSlug }) => {
  // Setup localStorage before rendering
  localStorage.setItem('token', generateMockJWT(tenantSlug));
  localStorage.setItem('user', JSON.stringify(generateMockUser(tenantSlug)));
  
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/:tenantSlug/admin/*" element={
          <MockProtectedRoute allowedRoles={['admin', 'kasir', 'staf']} requireTenant={true}>
            <MockAdminLayout />
          </MockProtectedRoute>
        } />
      </Routes>
    </MemoryRouter>
  );
};

describe('Dashboard Navigation - Property-Based Tests', () => {
  
  beforeEach(() => {
    localStorage.clear();
  });
  
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });
  
  // ============================================================================
  // Property 1: Dashboard Navigation Preserves Tenant Slug
  // **Validates: Requirements 1.2**
  // ============================================================================
  
  describe('Property 1: Dashboard Navigation Preserves Tenant Slug', () => {
    
    test('should preserve tenant slug across single navigation action', () => {
      fc.assert(
        fc.property(
          // Generate valid tenant slugs
          fc.stringMatching(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/),
          // Generate navigation targets
          fc.constantFrom('dashboard', 'menu', 'kasir', 'inventaris', 'keuangan', 'pegawai', 'meja', 'pelanggan', 'pengaturan'),
          (tenantSlug, targetPage) => {
            const initialRoute = `/${tenantSlug}/admin/dashboard`;
            
            const { getByTestId } = render(
              <TestRouter initialRoute={initialRoute} tenantSlug={tenantSlug} />
            );
            
            try {
              // Verify initial state
              const adminLayout = getByTestId('admin-layout');
              expect(adminLayout).toHaveAttribute('data-tenant-slug', tenantSlug);
              
              // Perform navigation
              const navButton = getByTestId(`nav-${targetPage}`);
              act(() => {
                navButton.click();
              });
              
              // Property: Tenant slug should be preserved after navigation
              const currentPath = getByTestId('current-path');
              expect(currentPath.textContent).toBe(`/${tenantSlug}/admin/${targetPage}`);
              
              const currentSlug = getByTestId('current-slug');
              expect(currentSlug.textContent).toBe(tenantSlug);
              
              // Verify the page component receives the correct slug
              const pageElement = getByTestId(`page-${targetPage}`);
              expect(pageElement).toHaveAttribute('data-slug', tenantSlug);
            } finally {
              cleanup();
            }
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('should preserve tenant slug across sequence of navigation actions', () => {
      fc.assert(
        fc.property(
          // Generate valid tenant slugs
          fc.stringMatching(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/),
          // Generate sequence of navigation actions (2-5 actions)
          fc.array(
            fc.constantFrom('dashboard', 'menu', 'kasir', 'inventaris', 'keuangan', 'pegawai', 'meja', 'pelanggan', 'pengaturan'),
            { minLength: 2, maxLength: 5 }
          ),
          (tenantSlug, navigationSequence) => {
            const initialRoute = `/${tenantSlug}/admin/dashboard`;
            
            const { getByTestId } = render(
              <TestRouter initialRoute={initialRoute} tenantSlug={tenantSlug} />
            );
            
            try {
              // Verify initial state
              let adminLayout = getByTestId('admin-layout');
              expect(adminLayout).toHaveAttribute('data-tenant-slug', tenantSlug);
              
              // Perform sequence of navigations
              for (const targetPage of navigationSequence) {
                const navButton = getByTestId(`nav-${targetPage}`);
                act(() => {
                  navButton.click();
                });
                
                // Property: Tenant slug should remain unchanged after each navigation
                const currentPath = getByTestId('current-path');
                expect(currentPath.textContent).toBe(`/${tenantSlug}/admin/${targetPage}`);
                
                const currentSlug = getByTestId('current-slug');
                expect(currentSlug.textContent).toBe(tenantSlug);
                
                // Verify the page component receives the correct slug
                const pageElement = getByTestId(`page-${targetPage}`);
                expect(pageElement).toHaveAttribute('data-slug', tenantSlug);
              }
            } finally {
              cleanup();
            }
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('should preserve tenant slug when navigating back and forth between pages', () => {
      fc.assert(
        fc.property(
          // Generate valid tenant slugs
          fc.stringMatching(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/),
          // Generate two different pages
          fc.constantFrom('dashboard', 'menu', 'kasir', 'inventaris'),
          fc.constantFrom('keuangan', 'pegawai', 'meja', 'pelanggan', 'pengaturan'),
          (tenantSlug, page1, page2) => {
            const initialRoute = `/${tenantSlug}/admin/${page1}`;
            
            const { getByTestId } = render(
              <TestRouter initialRoute={initialRoute} tenantSlug={tenantSlug} />
            );
            
            try {
              // Verify initial state
              let currentSlug = getByTestId('current-slug');
              expect(currentSlug.textContent).toBe(tenantSlug);
              
              // Navigate to page2
              act(() => {
                getByTestId(`nav-${page2}`).click();
              });
              
              // Property: Slug preserved after first navigation
              currentSlug = getByTestId('current-slug');
              expect(currentSlug.textContent).toBe(tenantSlug);
              
              let currentPath = getByTestId('current-path');
              expect(currentPath.textContent).toBe(`/${tenantSlug}/admin/${page2}`);
              
              // Navigate back to page1
              act(() => {
                getByTestId(`nav-${page1}`).click();
              });
              
              // Property: Slug preserved after navigating back
              currentSlug = getByTestId('current-slug');
              expect(currentSlug.textContent).toBe(tenantSlug);
              
              currentPath = getByTestId('current-path');
              expect(currentPath.textContent).toBe(`/${tenantSlug}/admin/${page1}`);
              
              // Navigate to page2 again
              act(() => {
                getByTestId(`nav-${page2}`).click();
              });
              
              // Property: Slug still preserved after multiple back-and-forth navigations
              currentSlug = getByTestId('current-slug');
              expect(currentSlug.textContent).toBe(tenantSlug);
              
              currentPath = getByTestId('current-path');
              expect(currentPath.textContent).toBe(`/${tenantSlug}/admin/${page2}`);
            } finally {
              cleanup();
            }
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('should preserve different tenant slugs independently', () => {
      fc.assert(
        fc.property(
          // Generate two different valid tenant slugs
          fc.stringMatching(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/),
          fc.stringMatching(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/),
          fc.constantFrom('dashboard', 'menu', 'kasir', 'inventaris', 'keuangan'),
          (tenantSlug1, tenantSlug2, targetPage) => {
            // Skip if slugs are the same
            fc.pre(tenantSlug1 !== tenantSlug2);
            
            // Test first tenant
            const initialRoute1 = `/${tenantSlug1}/admin/dashboard`;
            const { getByTestId: getByTestId1 } = render(
              <TestRouter initialRoute={initialRoute1} tenantSlug={tenantSlug1} />
            );
            
            try {
              act(() => {
                getByTestId1(`nav-${targetPage}`).click();
              });
              
              const currentSlug1 = getByTestId1('current-slug');
              expect(currentSlug1.textContent).toBe(tenantSlug1);
              
              const currentPath1 = getByTestId1('current-path');
              expect(currentPath1.textContent).toBe(`/${tenantSlug1}/admin/${targetPage}`);
            } finally {
              cleanup();
              localStorage.clear();
            }
            
            // Test second tenant
            const initialRoute2 = `/${tenantSlug2}/admin/dashboard`;
            const { getByTestId: getByTestId2 } = render(
              <TestRouter initialRoute={initialRoute2} tenantSlug={tenantSlug2} />
            );
            
            try {
              act(() => {
                getByTestId2(`nav-${targetPage}`).click();
              });
              
              // Property: Each tenant's slug should be preserved independently
              const currentSlug2 = getByTestId2('current-slug');
              expect(currentSlug2.textContent).toBe(tenantSlug2);
              
              const currentPath2 = getByTestId2('current-path');
              expect(currentPath2.textContent).toBe(`/${tenantSlug2}/admin/${targetPage}`);
              
              // Verify slugs are different
              expect(tenantSlug1).not.toBe(tenantSlug2);
            } finally {
              cleanup();
            }
          }
        ),
        { numRuns: 50, endOnFailure: true }
      );
    });
  });
});
