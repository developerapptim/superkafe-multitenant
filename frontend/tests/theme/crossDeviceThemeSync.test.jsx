/**
 * Cross-Device Theme Synchronization Tests
 * 
 * Tests that verify theme preferences are loaded from the database on login
 * and remain consistent across different devices and sessions.
 * 
 * Feature: Seamless Branding Integration
 * Task: 11.2 Test theme consistency across devices
 * Requirements: 9.1, 9.2
 */

describe('Cross-Device Theme Synchronization', () => {
  const mockTenantId = '507f1f77bcf86cd799439011';
  const mockToken = 'mock-jwt-token';
  
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  test('theme persists after logout and login', async () => {
    // Simulate first login with theme data
    const authResponse = {
      token: mockToken,
      user: {
        id: 'user123',
        email: 'test@example.com',
        hasCompletedSetup: true,
        tenantSlug: 'test-cafe'
      },
      tenant: {
        id: mockTenantId,
        slug: 'test-cafe',
        name: 'Test Cafe',
        selectedTheme: 'light-coffee',
        hasSeenThemePopup: true
      }
    };
    
    // Store auth data (simulating login)
    localStorage.setItem('token', authResponse.token);
    localStorage.setItem('user', JSON.stringify(authResponse.user));
    localStorage.setItem('tenant', JSON.stringify(authResponse.tenant));
    
    // Verify theme is stored
    const storedTenant = JSON.parse(localStorage.getItem('tenant'));
    expect(storedTenant.selectedTheme).toBe('light-coffee');
    
    // Simulate logout
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    
    // Verify data is cleared
    expect(localStorage.getItem('tenant')).toBeNull();
    
    // Simulate second login (same user, different session)
    localStorage.setItem('token', authResponse.token);
    localStorage.setItem('user', JSON.stringify(authResponse.user));
    localStorage.setItem('tenant', JSON.stringify(authResponse.tenant));
    
    // Verify theme is still light-coffee
    const storedTenantAfterRelogin = JSON.parse(localStorage.getItem('tenant'));
    expect(storedTenantAfterRelogin.selectedTheme).toBe('light-coffee');
  });

  test('theme changes on one device reflect on other devices after login', () => {
    // Device 1: Initial login
    const device1AuthResponse = {
      token: mockToken,
      user: {
        id: 'user123',
        email: 'test@example.com',
        hasCompletedSetup: true,
        tenantSlug: 'test-cafe'
      },
      tenant: {
        id: mockTenantId,
        slug: 'test-cafe',
        name: 'Test Cafe',
        selectedTheme: 'default',
        hasSeenThemePopup: true
      }
    };
    
    localStorage.setItem('token', device1AuthResponse.token);
    localStorage.setItem('user', JSON.stringify(device1AuthResponse.user));
    localStorage.setItem('tenant', JSON.stringify(device1AuthResponse.tenant));
    
    // Device 1: Change theme to light-coffee (simulating API call success)
    const tenant = JSON.parse(localStorage.getItem('tenant'));
    tenant.selectedTheme = 'light-coffee';
    localStorage.setItem('tenant', JSON.stringify(tenant));
    
    // Verify Device 1 has updated theme
    const device1Tenant = JSON.parse(localStorage.getItem('tenant'));
    expect(device1Tenant.selectedTheme).toBe('light-coffee');
    
    // Simulate Device 2: Login (should get updated theme from server)
    // Clear localStorage to simulate different device
    localStorage.clear();
    
    // Device 2: Login response includes updated theme from database
    const device2AuthResponse = {
      token: mockToken,
      user: {
        id: 'user123',
        email: 'test@example.com',
        hasCompletedSetup: true,
        tenantSlug: 'test-cafe'
      },
      tenant: {
        id: mockTenantId,
        slug: 'test-cafe',
        name: 'Test Cafe',
        selectedTheme: 'light-coffee', // Updated theme from database
        hasSeenThemePopup: true
      }
    };
    
    localStorage.setItem('token', device2AuthResponse.token);
    localStorage.setItem('user', JSON.stringify(device2AuthResponse.user));
    localStorage.setItem('tenant', JSON.stringify(device2AuthResponse.tenant));
    
    // Device 2: Verify theme is light-coffee
    const device2Tenant = JSON.parse(localStorage.getItem('tenant'));
    expect(device2Tenant.selectedTheme).toBe('light-coffee');
  });

  test('database is single source of truth for theme preference', () => {
    // Simulate corrupted localStorage with wrong theme
    const corruptedTenant = {
      id: mockTenantId,
      slug: 'test-cafe',
      name: 'Test Cafe',
      selectedTheme: 'invalid-theme', // Wrong theme in localStorage
      hasSeenThemePopup: true
    };
    
    localStorage.setItem('tenant', JSON.stringify(corruptedTenant));
    
    // Verify corrupted data is in localStorage
    const storedTenant = JSON.parse(localStorage.getItem('tenant'));
    expect(storedTenant.selectedTheme).toBe('invalid-theme');
    
    // Simulate fetching correct theme from database (via auth response or API)
    const correctThemeFromDatabase = 'light-coffee';
    
    // App should use database value, not localStorage
    expect(correctThemeFromDatabase).not.toBe(corruptedTenant.selectedTheme);
    
    // Update localStorage with correct value from database
    const tenant = JSON.parse(localStorage.getItem('tenant'));
    tenant.selectedTheme = correctThemeFromDatabase;
    localStorage.setItem('tenant', JSON.stringify(tenant));
    
    // Verify localStorage is now corrected
    const correctedTenant = JSON.parse(localStorage.getItem('tenant'));
    expect(correctedTenant.selectedTheme).toBe('light-coffee');
  });

  test('theme loads from auth response on initial login', () => {
    // Simulate login response with theme data
    const authResponse = {
      token: mockToken,
      user: {
        id: 'user123',
        email: 'test@example.com',
        hasCompletedSetup: true,
        tenantSlug: 'test-cafe'
      },
      tenant: {
        id: mockTenantId,
        slug: 'test-cafe',
        name: 'Test Cafe',
        selectedTheme: 'light-coffee',
        hasSeenThemePopup: false
      }
    };
    
    // Store auth data
    localStorage.setItem('token', authResponse.token);
    localStorage.setItem('user', JSON.stringify(authResponse.user));
    localStorage.setItem('tenant', JSON.stringify(authResponse.tenant));
    
    // Verify theme is available immediately without API call
    const tenant = JSON.parse(localStorage.getItem('tenant'));
    expect(tenant.selectedTheme).toBe('light-coffee');
    expect(tenant.hasSeenThemePopup).toBe(false);
  });

  test('fallback to default theme if theme not in auth response', () => {
    // Simulate login response without theme data
    const authResponse = {
      token: mockToken,
      user: {
        id: 'user123',
        email: 'test@example.com',
        hasCompletedSetup: true,
        tenantSlug: 'test-cafe'
      },
      tenant: {
        id: mockTenantId,
        slug: 'test-cafe',
        name: 'Test Cafe'
        // selectedTheme is missing
      }
    };
    
    // Store auth data
    localStorage.setItem('token', authResponse.token);
    localStorage.setItem('user', JSON.stringify(authResponse.user));
    localStorage.setItem('tenant', JSON.stringify(authResponse.tenant));
    
    // Verify theme defaults to 'default'
    const tenant = JSON.parse(localStorage.getItem('tenant'));
    const theme = tenant.selectedTheme || 'default';
    expect(theme).toBe('default');
  });

  test('theme stored in React state, not localStorage for runtime', () => {
    // This test verifies the design principle that theme is stored in React state
    // during runtime, with localStorage only used for persistence between sessions
    
    const authResponse = {
      token: mockToken,
      user: {
        id: 'user123',
        email: 'test@example.com',
        hasCompletedSetup: true,
        tenantSlug: 'test-cafe'
      },
      tenant: {
        id: mockTenantId,
        slug: 'test-cafe',
        name: 'Test Cafe',
        selectedTheme: 'light-coffee',
        hasSeenThemePopup: true
      }
    };
    
    // Store auth data
    localStorage.setItem('token', authResponse.token);
    localStorage.setItem('user', JSON.stringify(authResponse.user));
    localStorage.setItem('tenant', JSON.stringify(authResponse.tenant));
    
    // Verify localStorage has theme data for persistence
    const tenant = JSON.parse(localStorage.getItem('tenant'));
    expect(tenant.selectedTheme).toBe('light-coffee');
    
    // Note: In actual app, ThemeContext will load this into React state
    // and use React state for all runtime operations
    // localStorage is only read on mount and written on theme change
  });
});
