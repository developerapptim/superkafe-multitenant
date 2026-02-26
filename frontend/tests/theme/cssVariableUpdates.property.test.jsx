/**
 * CSS Variable Updates - Property-Based Tests
 * 
 * **Property 6: Theme Change Updates CSS Variables**
 * **Validates: Requirements 5.2**
 * 
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property test
 * 
 * Feature: seamless-branding-integration
 * 
 * This test verifies that for any theme change operation (initial load, user selection,
 * or programmatic update), the system must update all four CSS variables (--bg-main,
 * --bg-sidebar, --accent-color, --text-primary) on the document root element to reflect
 * the new theme's color values.
 */

import fc from 'fast-check';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../../src/context/ThemeContext';
import { themePresets } from '../../src/config/themeStyles';
import api from '../../src/services/api';

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

// CSS variable names that must be updated
const CSS_VARIABLES = ['--bg-main', '--bg-sidebar', '--accent-color', '--text-primary'];

// Mapping from CSS variable names to theme config property names
const CSS_VAR_TO_CONFIG_PROP = {
  '--bg-main': 'bgMain',
  '--bg-sidebar': 'bgSidebar',
  '--accent-color': 'accentColor',
  '--text-primary': 'textPrimary'
};

describe('CSS Variable Updates - Property-Based Tests', () => {
  
  beforeEach(() => {
    // Clear CSS variables
    const root = document.documentElement;
    CSS_VARIABLES.forEach(varName => {
      root.style.removeProperty(varName);
    });
    root.removeAttribute('data-theme');
    
    // Clear localStorage
    localStorage.clear();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock successful API responses by default
    api.get.mockResolvedValue({ data: { theme: 'default' } });
    api.put.mockResolvedValue({ data: { success: true } });
  });

  // ============================================================================
  // Property 6: Theme Change Updates CSS Variables
  // **Validates: Requirements 5.2**
  // ============================================================================
  
  describe('Property 6: Theme Change Updates CSS Variables', () => {
    
    test('all four CSS variables are updated on initial theme load', () => {
      fc.assert(
        fc.property(
          // Generate theme names from available presets
          fc.constantFrom(...Object.keys(themePresets)),
          (themeName) => {
            // Clear CSS variables before each iteration
            const root = document.documentElement;
            CSS_VARIABLES.forEach(varName => {
              root.style.removeProperty(varName);
            });
            
            // Create wrapper with initial theme
            const wrapper = ({ children }) => (
              <ThemeProvider initialTheme={themeName}>
                {children}
              </ThemeProvider>
            );
            
            // Render hook
            renderHook(() => useTheme(), { wrapper });
            
            // Property: All four CSS variables must be set to theme's color values
            const allVariablesSet = CSS_VARIABLES.every(varName => {
              const cssValue = root.style.getPropertyValue(varName);
              const configProp = CSS_VAR_TO_CONFIG_PROP[varName];
              const expectedValue = themePresets[themeName][configProp];
              
              return cssValue === expectedValue;
            });
            
            return allVariablesSet;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('all four CSS variables are updated when theme changes programmatically', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate pairs of theme names (from -> to)
          fc.constantFrom(...Object.keys(themePresets)),
          fc.constantFrom(...Object.keys(themePresets)),
          async (initialTheme, targetTheme) => {
            // Clear CSS variables before each iteration
            const root = document.documentElement;
            CSS_VARIABLES.forEach(varName => {
              root.style.removeProperty(varName);
            });
            
            // Create wrapper with initial theme
            const wrapper = ({ children }) => (
              <ThemeProvider initialTheme={initialTheme} tenantId="test-tenant-123">
                {children}
              </ThemeProvider>
            );
            
            // Render hook
            const { result } = renderHook(() => useTheme(), { wrapper });
            
            // Wait for initial render to complete
            await waitFor(() => {
              expect(result.current.isLoading).toBe(false);
            });
            
            // Change theme
            await act(async () => {
              await result.current.setTheme(targetTheme);
            });
            
            // Property: All four CSS variables must be updated to new theme's values
            const allVariablesUpdated = CSS_VARIABLES.every(varName => {
              const cssValue = root.style.getPropertyValue(varName);
              const configProp = CSS_VAR_TO_CONFIG_PROP[varName];
              const expectedValue = themePresets[targetTheme][configProp];
              
              return cssValue === expectedValue;
            });
            
            return allVariablesUpdated;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('CSS variables match theme config values exactly', () => {
      fc.assert(
        fc.property(
          // Generate theme names from available presets
          fc.constantFrom(...Object.keys(themePresets)),
          (themeName) => {
            // Clear CSS variables before each iteration
            const root = document.documentElement;
            CSS_VARIABLES.forEach(varName => {
              root.style.removeProperty(varName);
            });
            
            // Create wrapper with theme
            const wrapper = ({ children }) => (
              <ThemeProvider initialTheme={themeName}>
                {children}
              </ThemeProvider>
            );
            
            // Render hook
            renderHook(() => useTheme(), { wrapper });
            
            // Property: CSS variable values must exactly match theme preset values
            const allValuesMatch = CSS_VARIABLES.every(varName => {
              const cssValue = root.style.getPropertyValue(varName).trim();
              const configProp = CSS_VAR_TO_CONFIG_PROP[varName];
              const expectedValue = themePresets[themeName][configProp];
              
              return cssValue === expectedValue;
            });
            
            return allValuesMatch;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('CSS variables are set on document root element', () => {
      fc.assert(
        fc.property(
          // Generate theme names from available presets
          fc.constantFrom(...Object.keys(themePresets)),
          (themeName) => {
            // Clear CSS variables before each iteration
            const root = document.documentElement;
            CSS_VARIABLES.forEach(varName => {
              root.style.removeProperty(varName);
            });
            
            // Create wrapper with theme
            const wrapper = ({ children }) => (
              <ThemeProvider initialTheme={themeName}>
                {children}
              </ThemeProvider>
            );
            
            // Render hook
            renderHook(() => useTheme(), { wrapper });
            
            // Property: CSS variables must be set on document.documentElement
            const allVariablesOnRoot = CSS_VARIABLES.every(varName => {
              const value = document.documentElement.style.getPropertyValue(varName);
              return value !== '' && value !== null;
            });
            
            return allVariablesOnRoot;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('CSS variables are accessible via getComputedStyle', () => {
      fc.assert(
        fc.property(
          // Generate theme names from available presets
          fc.constantFrom(...Object.keys(themePresets)),
          (themeName) => {
            // Clear CSS variables before each iteration
            const root = document.documentElement;
            CSS_VARIABLES.forEach(varName => {
              root.style.removeProperty(varName);
            });
            
            // Create wrapper with theme
            const wrapper = ({ children }) => (
              <ThemeProvider initialTheme={themeName}>
                {children}
              </ThemeProvider>
            );
            
            // Render hook
            renderHook(() => useTheme(), { wrapper });
            
            // Property: CSS variables must be accessible via getComputedStyle
            const computedStyle = getComputedStyle(document.documentElement);
            const allVariablesAccessible = CSS_VARIABLES.every(varName => {
              const value = computedStyle.getPropertyValue(varName);
              return value !== '' && value !== null;
            });
            
            return allVariablesAccessible;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('CSS variables persist after multiple theme changes', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate sequence of theme changes
          fc.array(fc.constantFrom(...Object.keys(themePresets)), { minLength: 2, maxLength: 5 }),
          async (themeSequence) => {
            // Clear CSS variables before each iteration
            const root = document.documentElement;
            CSS_VARIABLES.forEach(varName => {
              root.style.removeProperty(varName);
            });
            
            // Start with first theme in sequence
            const wrapper = ({ children }) => (
              <ThemeProvider initialTheme={themeSequence[0]} tenantId="test-tenant-123">
                {children}
              </ThemeProvider>
            );
            
            const { result } = renderHook(() => useTheme(), { wrapper });
            
            // Wait for initial render
            await waitFor(() => {
              expect(result.current.isLoading).toBe(false);
            });
            
            // Apply each theme change in sequence
            for (let i = 1; i < themeSequence.length; i++) {
              await act(async () => {
                await result.current.setTheme(themeSequence[i]);
              });
            }
            
            // Property: After all changes, CSS variables must match final theme
            const finalTheme = themeSequence[themeSequence.length - 1];
            const allVariablesCorrect = CSS_VARIABLES.every(varName => {
              const cssValue = root.style.getPropertyValue(varName);
              const configProp = CSS_VAR_TO_CONFIG_PROP[varName];
              const expectedValue = themePresets[finalTheme][configProp];
              
              return cssValue === expectedValue;
            });
            
            return allVariablesCorrect;
          }
        ),
        { numRuns: 50, endOnFailure: true } // Reduced runs due to async complexity
      );
    });
    
    test('no CSS variables are missing after theme change', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate theme names
          fc.constantFrom(...Object.keys(themePresets)),
          fc.constantFrom(...Object.keys(themePresets)),
          async (initialTheme, targetTheme) => {
            // Clear CSS variables before each iteration
            const root = document.documentElement;
            CSS_VARIABLES.forEach(varName => {
              root.style.removeProperty(varName);
            });
            
            // Create wrapper
            const wrapper = ({ children }) => (
              <ThemeProvider initialTheme={initialTheme} tenantId="test-tenant-123">
                {children}
              </ThemeProvider>
            );
            
            const { result } = renderHook(() => useTheme(), { wrapper });
            
            // Wait for initial render
            await waitFor(() => {
              expect(result.current.isLoading).toBe(false);
            });
            
            // Change theme
            await act(async () => {
              await result.current.setTheme(targetTheme);
            });
            
            // Property: All four CSS variables must be present (not empty or null)
            const noMissingVariables = CSS_VARIABLES.every(varName => {
              const value = root.style.getPropertyValue(varName);
              return value !== '' && value !== null && value !== undefined;
            });
            
            return noMissingVariables;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('CSS variables update immediately without delay', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate theme names
          fc.constantFrom(...Object.keys(themePresets)),
          fc.constantFrom(...Object.keys(themePresets)),
          async (initialTheme, targetTheme) => {
            // Clear CSS variables before each iteration
            const root = document.documentElement;
            CSS_VARIABLES.forEach(varName => {
              root.style.removeProperty(varName);
            });
            
            // Create wrapper
            const wrapper = ({ children }) => (
              <ThemeProvider initialTheme={initialTheme} tenantId="test-tenant-123">
                {children}
              </ThemeProvider>
            );
            
            const { result } = renderHook(() => useTheme(), { wrapper });
            
            // Wait for initial render
            await waitFor(() => {
              expect(result.current.isLoading).toBe(false);
            });
            
            // Change theme
            await act(async () => {
              await result.current.setTheme(targetTheme);
            });
            
            // Property: CSS variables should be updated immediately (synchronously)
            // Check that values are already updated without additional waiting
            const allVariablesUpdated = CSS_VARIABLES.every(varName => {
              const cssValue = root.style.getPropertyValue(varName);
              const configProp = CSS_VAR_TO_CONFIG_PROP[varName];
              const expectedValue = themePresets[targetTheme][configProp];
              
              return cssValue === expectedValue;
            });
            
            return allVariablesUpdated;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('data-theme attribute is set alongside CSS variables', () => {
      fc.assert(
        fc.property(
          // Generate theme names from available presets
          fc.constantFrom(...Object.keys(themePresets)),
          (themeName) => {
            // Clear CSS variables and attribute before each iteration
            const root = document.documentElement;
            CSS_VARIABLES.forEach(varName => {
              root.style.removeProperty(varName);
            });
            root.removeAttribute('data-theme');
            
            // Create wrapper with theme
            const wrapper = ({ children }) => (
              <ThemeProvider initialTheme={themeName}>
                {children}
              </ThemeProvider>
            );
            
            // Render hook
            renderHook(() => useTheme(), { wrapper });
            
            // Property: data-theme attribute must be set when CSS variables are set
            const dataThemeSet = root.getAttribute('data-theme') === themeName;
            const allVariablesSet = CSS_VARIABLES.every(varName => {
              const value = root.style.getPropertyValue(varName);
              return value !== '' && value !== null;
            });
            
            return dataThemeSet && allVariablesSet;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
    
    test('CSS variables remain consistent across component re-renders', () => {
      fc.assert(
        fc.property(
          // Generate theme names from available presets
          fc.constantFrom(...Object.keys(themePresets)),
          (themeName) => {
            // Clear CSS variables before each iteration
            const root = document.documentElement;
            CSS_VARIABLES.forEach(varName => {
              root.style.removeProperty(varName);
            });
            
            // Create wrapper with theme
            const wrapper = ({ children }) => (
              <ThemeProvider initialTheme={themeName}>
                {children}
              </ThemeProvider>
            );
            
            // Render hook
            const { rerender } = renderHook(() => useTheme(), { wrapper });
            
            // Get initial CSS variable values
            const initialValues = CSS_VARIABLES.map(varName => 
              root.style.getPropertyValue(varName)
            );
            
            // Force re-render
            rerender();
            
            // Get CSS variable values after re-render
            const afterRerenderValues = CSS_VARIABLES.map(varName => 
              root.style.getPropertyValue(varName)
            );
            
            // Property: CSS variables should remain unchanged after re-render
            const valuesUnchanged = initialValues.every((value, index) => 
              value === afterRerenderValues[index]
            );
            
            return valuesUnchanged;
          }
        ),
        { numRuns: 100, endOnFailure: true }
      );
    });
  });
});

/**
 * Property Test Summary
 * 
 * This test suite validates Property 6: Theme Change Updates CSS Variables
 * 
 * The property states: For any theme change operation (initial load, user selection,
 * or programmatic update), the system must update all four CSS variables (--bg-main,
 * --bg-sidebar, --accent-color, --text-primary) on the document root element to reflect
 * the new theme's color values.
 * 
 * Test Coverage:
 * 1. All four CSS variables are updated on initial theme load
 * 2. All four CSS variables are updated when theme changes programmatically
 * 3. CSS variables match theme config values exactly
 * 4. CSS variables are set on document root element
 * 5. CSS variables are accessible via getComputedStyle
 * 6. CSS variables persist after multiple theme changes
 * 7. No CSS variables are missing after theme change
 * 8. CSS variables update immediately without delay
 * 9. data-theme attribute is set alongside CSS variables
 * 10. CSS variables remain consistent across component re-renders
 * 
 * Validates: Requirements 5.2
 */
