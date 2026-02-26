/**
 * Theme Presets Configuration
 * 
 * Defines predefined theme presets for the Admin Panel.
 * Each preset contains color values for background, sidebar, accent, and text.
 * 
 * Feature: Seamless Branding Integration
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

export const themePresets = {
  default: {
    name: 'Default (Dark Purple)',
    bgMain: '#0F0A1F',
    bgSidebar: '#1E1B4B',
    accentColor: '#8B5CF6',
    textPrimary: '#FFFFFF'
  },
  'light-coffee': {
    name: 'Light Coffee',
    bgMain: '#FFFFFF',
    bgSidebar: '#4E342E',
    accentColor: '#A0522D',
    textPrimary: '#2D2D2D'
  }
};

/**
 * Get theme configuration by name
 * 
 * @param {string} themeName - Name of the theme preset ('default' or 'light-coffee')
 * @returns {Object} Theme configuration object with color properties
 * 
 * If the theme name is invalid or not found, returns the default theme.
 */
export const getThemeConfig = (themeName) => {
  return themePresets[themeName] || themePresets.default;
};
