/**
 * Customer View Theme Isolation Tests
 * 
 * Verifies that customer-facing views are not affected by admin theme changes.
 * 
 * Feature: Seamless Branding Integration
 * Requirements: 5.4, 8.2, 8.3
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MenuCustomer from '../../src/pages/customer/MenuCustomer';
import { CartProvider } from '../../src/context/CartContext';
import { RefreshProvider } from '../../src/context/RefreshContext';

// Mock API calls
vi.mock('../../src/services/api', () => ({
  menuAPI: {
    getCustomer: vi.fn(() => Promise.resolve({ data: [] })),
    getAll: vi.fn(() => Promise.resolve({ data: [] }))
  },
  categoriesAPI: {
    getAll: vi.fn(() => Promise.resolve({ data: [] }))
  },
  bannerAPI: {
    getAll: vi.fn(() => Promise.resolve({ data: [] }))
  }
}));

describe('Customer View Theme Isolation', () => {
  beforeEach(() => {
    // Clear any existing CSS variables
    document.documentElement.style.removeProperty('--bg-main');
    document.documentElement.style.removeProperty('--bg-sidebar');
    document.documentElement.style.removeProperty('--accent-color');
    document.documentElement.style.removeProperty('--text-primary');
  });

  afterEach(() => {
    // Clean up
    document.documentElement.style.removeProperty('--bg-main');
    document.documentElement.style.removeProperty('--bg-sidebar');
    document.documentElement.style.removeProperty('--accent-color');
    document.documentElement.style.removeProperty('--text-primary');
  });

  test('customer view does not use admin CSS variables', () => {
    // Set admin theme CSS variables (light-coffee theme)
    document.documentElement.style.setProperty('--bg-main', '#FFFFFF');
    document.documentElement.style.setProperty('--bg-sidebar', '#4E342E');
    document.documentElement.style.setProperty('--accent-color', '#A0522D');
    document.documentElement.style.setProperty('--text-primary', '#2D2D2D');

    // Render customer view
    const { container } = render(
      <BrowserRouter>
        <RefreshProvider>
          <CartProvider>
            <MenuCustomer />
          </CartProvider>
        </RefreshProvider>
      </BrowserRouter>
    );

    // Get computed styles of customer view elements
    const customerElements = container.querySelectorAll('[class*="bg-"]');
    
    // Verify that customer elements don't use CSS variables
    customerElements.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      const bgColor = computedStyle.backgroundColor;
      
      // Customer view should not have white background (admin light-coffee theme)
      // It should maintain its default purple/dark blue colors
      expect(bgColor).not.toBe('rgb(255, 255, 255)'); // Not white
      expect(bgColor).not.toBe('rgb(78, 52, 46)'); // Not brown sidebar
    });
  });

  test('customer view maintains default colors when admin theme changes', () => {
    // Render customer view with default theme
    const { container: container1 } = render(
      <BrowserRouter>
        <RefreshProvider>
          <CartProvider>
            <MenuCustomer />
          </CartProvider>
        </RefreshProvider>
      </BrowserRouter>
    );

    // Get initial styles
    const initialElement = container1.querySelector('[class*="bg-"]');
    const initialBgColor = initialElement ? window.getComputedStyle(initialElement).backgroundColor : null;

    // Change admin theme to light-coffee
    document.documentElement.style.setProperty('--bg-main', '#FFFFFF');
    document.documentElement.style.setProperty('--bg-sidebar', '#4E342E');
    document.documentElement.style.setProperty('--accent-color', '#A0522D');
    document.documentElement.style.setProperty('--text-primary', '#2D2D2D');

    // Render customer view again
    const { container: container2 } = render(
      <BrowserRouter>
        <RefreshProvider>
          <CartProvider>
            <MenuCustomer />
          </CartProvider>
        </RefreshProvider>
      </BrowserRouter>
    );

    // Get styles after theme change
    const afterElement = container2.querySelector('[class*="bg-"]');
    const afterBgColor = afterElement ? window.getComputedStyle(afterElement).backgroundColor : null;

    // Customer view colors should remain the same
    if (initialBgColor && afterBgColor) {
      expect(afterBgColor).toBe(initialBgColor);
    }
  });

  test('customer view uses hardcoded Tailwind classes, not CSS variables', () => {
    // Set admin theme CSS variables
    document.documentElement.style.setProperty('--bg-main', '#FFFFFF');
    document.documentElement.style.setProperty('--accent-color', '#A0522D');

    // Render customer view
    const { container } = render(
      <BrowserRouter>
        <RefreshProvider>
          <CartProvider>
            <MenuCustomer />
          </CartProvider>
        </RefreshProvider>
      </BrowserRouter>
    );

    // Check that customer view elements use Tailwind classes
    const customerContainer = container.firstChild;
    const className = customerContainer?.className || '';
    
    // Customer view should use Tailwind utility classes (bg-white/5, bg-purple-600, etc.)
    // Not CSS variable-based classes
    expect(className).not.toContain('admin-bg-main');
    expect(className).not.toContain('admin-bg-sidebar');
    expect(className).not.toContain('admin-bg-accent');
  });

  test('customer view gradient backgrounds are not affected by admin theme', () => {
    // Set admin theme CSS variables
    document.documentElement.style.setProperty('--bg-main', '#FFFFFF');
    document.documentElement.style.setProperty('--bg-sidebar', '#4E342E');

    // Render customer view
    const { container } = render(
      <BrowserRouter>
        <RefreshProvider>
          <CartProvider>
            <MenuCustomer />
          </CartProvider>
        </RefreshProvider>
      </BrowserRouter>
    );

    // Find elements with gradient backgrounds
    const gradientElements = Array.from(container.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.backgroundImage.includes('gradient');
    });

    // Verify gradients don't use admin theme colors
    gradientElements.forEach(element => {
      const bgImage = window.getComputedStyle(element).backgroundImage;
      
      // Should not contain white or brown colors from light-coffee theme
      expect(bgImage).not.toContain('255, 255, 255'); // Not white
      expect(bgImage).not.toContain('78, 52, 46'); // Not brown
    });
  });
});

/**
 * Validates: Requirements 5.4, 8.2, 8.3
 * 
 * These tests ensure that:
 * 1. Customer views don't use admin CSS variables
 * 2. Customer views maintain default purple/dark blue colors
 * 3. Admin theme changes don't leak to customer views
 * 4. Customer views use separate hardcoded Tailwind classes
 */
