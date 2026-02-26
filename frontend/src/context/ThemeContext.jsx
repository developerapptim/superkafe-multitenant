import React, { createContext, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { themePresets, getThemeConfig } from '../config/themeStyles';

/**
 * ThemeContext - Manages global theme state for Admin Panel
 * 
 * Provides theme configuration and switching functionality to all child components.
 * Loads theme from authentication response or API, applies CSS variables, and
 * persists theme changes to the database.
 * 
 * Error Handling:
 * - Network failures: Display Indonesian error messages and fallback to default theme
 * - Invalid theme data: Validate against presets and fallback to default theme
 * - Save failures: Maintain previous theme and show error notification
 * 
 * Feature: Seamless Branding Integration
 * Requirements: 2.5, 3.5, 5.1, 5.2, 9.3, 9.4
 */

const ThemeContext = createContext(null);

/**
 * Hook to access theme context
 * @returns {Object} Theme context value with currentTheme, themeConfig, setTheme, isLoading
 */
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

/**
 * ThemeProvider Component
 * 
 * Wraps the application and provides theme state management.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @param {string} props.initialTheme - Initial theme name from auth response (optional)
 * @param {string} props.tenantId - Tenant ID for API calls (optional)
 */
export const ThemeProvider = ({ children, initialTheme = 'default', tenantId = null }) => {
    const [currentTheme, setCurrentTheme] = useState(initialTheme);
    const [themeConfig, setThemeConfig] = useState(getThemeConfig(initialTheme));
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Apply CSS variables to document root
     * @param {Object} config - Theme configuration object
     */
    const applyCSSVariables = (config) => {
        try {
            const root = document.documentElement;
            root.style.setProperty('--bg-main', config.bgMain);
            root.style.setProperty('--bg-sidebar', config.bgSidebar);
            root.style.setProperty('--accent-color', config.accentColor);
            root.style.setProperty('--text-primary', config.textPrimary);
            
            console.log('[Theme] CSS variables applied:', config);
        } catch (error) {
            console.error('[Theme] Failed to apply CSS variables:', error);
        }
    };

    /**
     * Set data-theme attribute on document root for CSS selectors
     * @param {string} themeName - Name of the theme
     */
    const setThemeAttribute = (themeName) => {
        try {
            document.documentElement.setAttribute('data-theme', themeName);
            console.log('[Theme] data-theme attribute set:', themeName);
        } catch (error) {
            console.error('[Theme] Failed to set data-theme attribute:', error);
        }
    };

    /**
     * Load theme from API
     * Fallback to default theme if API call fails
     * Requirements: 9.4 - Fallback to default theme on connection failure
     */
    const loadThemeFromAPI = async () => {
        if (!tenantId) {
            console.warn('[Theme] No tenantId provided, using default theme');
            return;
        }

        try {
            setIsLoading(true);
            const response = await api.get(`/tenants/${tenantId}/theme`);
            const themeName = response.data.theme || 'default';
            
            // Validate theme name against preset keys
            // Requirements: 3.5 - Validate theme and fallback if invalid
            if (!themePresets[themeName]) {
                console.warn(`[Theme] Invalid theme "${themeName}" from server, using default`);
                toast.error('Tema tidak valid. Menggunakan tema default.', {
                    duration: 3000,
                    position: 'top-center'
                });
                setCurrentTheme('default');
                setThemeConfig(getThemeConfig('default'));
                applyCSSVariables(getThemeConfig('default'));
                setThemeAttribute('default');
            } else {
                setCurrentTheme(themeName);
                const config = getThemeConfig(themeName);
                setThemeConfig(config);
                applyCSSVariables(config);
                setThemeAttribute(themeName);
                console.log('[Theme] Loaded from API:', themeName);
            }
        } catch (error) {
            console.error('[Theme] Failed to load theme from API:', error);
            console.log('[Theme] Falling back to default theme');
            
            // Display user-friendly error message in Indonesian
            // Requirements: 9.4 - Display error and use default theme as fallback
            toast.error('Gagal memuat tema. Menggunakan tema default.', {
                duration: 3000,
                position: 'top-center'
            });
            
            // Fallback to default theme on error
            setCurrentTheme('default');
            setThemeConfig(getThemeConfig('default'));
            applyCSSVariables(getThemeConfig('default'));
            setThemeAttribute('default');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Set theme and persist to database
     * Requirements: 2.5 - Maintain previous theme if update fails
     * @param {string} themeName - Name of the theme to apply
     * @returns {Promise<boolean>} Success status
     */
    const setTheme = async (themeName) => {
        // Validate theme name against preset keys
        // Requirements: 3.5 - Validate theme name
        if (!themePresets[themeName]) {
            console.error(`[Theme] Invalid theme name: ${themeName}`);
            toast.error('Tema tidak valid.', {
                duration: 3000,
                position: 'top-center'
            });
            return false;
        }

        const previousTheme = currentTheme;
        const newConfig = getThemeConfig(themeName);

        try {
            setIsLoading(true);
            
            // Optimistically update UI
            setCurrentTheme(themeName);
            setThemeConfig(newConfig);
            applyCSSVariables(newConfig);
            setThemeAttribute(themeName);

            // Persist to database if tenantId is available
            if (tenantId) {
                await api.put(`/tenants/${tenantId}/theme`, { theme: themeName });
                console.log('[Theme] Theme updated successfully:', themeName);
                
                // Update localStorage tenant data
                const tenantData = localStorage.getItem('tenant');
                if (tenantData) {
                    try {
                        const tenant = JSON.parse(tenantData);
                        tenant.selectedTheme = themeName;
                        localStorage.setItem('tenant', JSON.stringify(tenant));
                        console.log('[Theme] Updated theme in localStorage');
                    } catch (parseError) {
                        console.error('[Theme] Failed to update tenant data in localStorage:', parseError);
                    }
                }
            } else {
                console.warn('[Theme] No tenantId, theme not persisted to database');
            }

            return true;
        } catch (error) {
            console.error('[Theme] Failed to update theme:', error);
            
            // Display user-friendly error message in Indonesian
            // Requirements: 2.5 - Display error message on save failure
            const errorMessage = error.response?.data?.message || 'Gagal menyimpan tema. Silakan coba lagi.';
            toast.error(errorMessage, {
                duration: 4000,
                position: 'top-center'
            });
            
            // Revert to previous theme on error
            // Requirements: 2.5 - Maintain previous theme if update fails
            console.log('[Theme] Reverting to previous theme:', previousTheme);
            setCurrentTheme(previousTheme);
            const previousConfig = getThemeConfig(previousTheme);
            setThemeConfig(previousConfig);
            applyCSSVariables(previousConfig);
            setThemeAttribute(previousTheme);
            
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Apply initial theme on mount
    useEffect(() => {
        const config = getThemeConfig(initialTheme);
        setThemeConfig(config);
        applyCSSVariables(config);
        setThemeAttribute(initialTheme);
        console.log('[Theme] Initial theme applied:', initialTheme);
    }, [initialTheme]);

    // Load theme from API only if tenantId is provided and initialTheme is default
    // This serves as a fallback if theme wasn't in auth response
    useEffect(() => {
        if (tenantId && initialTheme === 'default') {
            console.log('[Theme] Initial theme is default, checking API for saved preference');
            loadThemeFromAPI();
        }
    }, [tenantId]);

    const value = {
        currentTheme,
        themeConfig,
        setTheme,
        isLoading
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

