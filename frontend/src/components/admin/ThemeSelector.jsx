import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { themePresets } from '../../config/themeStyles';

/**
 * ThemeSelector Component
 * 
 * Displays visual preview cards for each theme preset with radio button selection.
 * Used in the Settings page to allow tenant owners to select their preferred theme.
 * 
 * Feature: Seamless Branding Integration
 * Requirements: 2.1, 2.2
 * 
 * @param {Object} props
 * @param {string} props.currentTheme - Currently selected theme name
 * @param {Function} props.onThemeChange - Callback when theme is selected
 * @param {boolean} props.disabled - Whether the selector is disabled (during loading)
 */
const ThemeSelector = ({ currentTheme, onThemeChange, disabled = false }) => {
    const [isPreviewActive, setIsPreviewActive] = useState(false);
    const originalThemeRef = useRef({});

    const handleThemeSelect = (themeName) => {
        if (!disabled && onThemeChange) {
            onThemeChange(themeName);
        }
    };

    /**
     * Apply temporary CSS variables for theme preview
     * Stores original values to revert later
     */
    const applyThemePreview = (themeName) => {
        if (disabled || themeName === currentTheme) return;

        const root = document.documentElement;
        const themeConfig = themePresets[themeName];

        // Store original values if not already stored
        if (!isPreviewActive) {
            originalThemeRef.current = {
                bgMain: root.style.getPropertyValue('--bg-main'),
                bgSidebar: root.style.getPropertyValue('--bg-sidebar'),
                accentColor: root.style.getPropertyValue('--accent-color'),
                textPrimary: root.style.getPropertyValue('--text-primary')
            };
            setIsPreviewActive(true);
        }

        // Apply preview theme CSS variables
        root.style.setProperty('--bg-main', themeConfig.bgMain);
        root.style.setProperty('--bg-sidebar', themeConfig.bgSidebar);
        root.style.setProperty('--accent-color', themeConfig.accentColor);
        root.style.setProperty('--text-primary', themeConfig.textPrimary);
    };

    /**
     * Revert to the current theme by restoring original CSS variables
     */
    const revertThemePreview = () => {
        if (!isPreviewActive) return;

        const root = document.documentElement;
        const currentThemeConfig = themePresets[currentTheme];

        // Revert to current theme
        root.style.setProperty('--bg-main', currentThemeConfig.bgMain);
        root.style.setProperty('--bg-sidebar', currentThemeConfig.bgSidebar);
        root.style.setProperty('--accent-color', currentThemeConfig.accentColor);
        root.style.setProperty('--text-primary', currentThemeConfig.textPrimary);

        setIsPreviewActive(false);
        originalThemeRef.current = {};
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(themePresets).map(([themeKey, themeConfig]) => {
                    const isSelected = currentTheme === themeKey;
                    const isHovering = isPreviewActive && !isSelected;
                    
                    return (
                        <motion.div
                            key={themeKey}
                            whileHover={!disabled ? { scale: 1.02 } : {}}
                            whileTap={!disabled ? { scale: 0.98 } : {}}
                            className={`relative cursor-pointer transition-all ${
                                disabled ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            onClick={() => handleThemeSelect(themeKey)}
                            onMouseEnter={() => applyThemePreview(themeKey)}
                            onMouseLeave={revertThemePreview}
                        >
                            {/* Preview Indicator */}
                            {isHovering && !isSelected && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-purple-500 text-white text-xs font-medium shadow-lg"
                                >
                                    Vista Previa
                                </motion.div>
                            )}

                            {/* Radio Button */}
                            <div className="absolute top-4 right-4 z-10">
                                <div
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                        isSelected
                                            ? 'border-purple-500 bg-purple-500'
                                            : 'border-gray-400 bg-transparent'
                                    }`}
                                >
                                    {isSelected && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="w-3 h-3 rounded-full bg-white"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Theme Preview Card */}
                            <div
                                className={`p-6 rounded-xl border-2 transition-all ${
                                    isSelected
                                        ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                                        : 'border-white/10 hover:border-white/20'
                                }`}
                            >
                                {/* Theme Name */}
                                <h4 className="font-bold text-lg mb-2">{themeConfig.name}</h4>
                                
                                {/* Theme Description */}
                                <p className="text-sm text-gray-400 mb-4">
                                    {themeKey === 'default'
                                        ? 'Tema gelap dengan aksen ungu yang elegan'
                                        : 'Tema terang dengan nuansa cokelat hangat'}
                                </p>

                                {/* Visual Preview */}
                                <div className="space-y-3">
                                    {/* Main Background Preview */}
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-12 h-12 rounded-lg border border-white/20"
                                            style={{ backgroundColor: themeConfig.bgMain }}
                                        />
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-400">Background Utama</p>
                                            <p className="text-sm font-mono">{themeConfig.bgMain}</p>
                                        </div>
                                    </div>

                                    {/* Sidebar Background Preview */}
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-12 h-12 rounded-lg border border-white/20"
                                            style={{ backgroundColor: themeConfig.bgSidebar }}
                                        />
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-400">Background Sidebar</p>
                                            <p className="text-sm font-mono">{themeConfig.bgSidebar}</p>
                                        </div>
                                    </div>

                                    {/* Accent Color Preview */}
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-12 h-12 rounded-lg border border-white/20"
                                            style={{ backgroundColor: themeConfig.accentColor }}
                                        />
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-400">Warna Aksen</p>
                                            <p className="text-sm font-mono">{themeConfig.accentColor}</p>
                                        </div>
                                    </div>

                                    {/* Text Color Preview */}
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-12 h-12 rounded-lg border border-white/20 flex items-center justify-center"
                                            style={{ 
                                                backgroundColor: themeConfig.bgMain,
                                                color: themeConfig.textPrimary
                                            }}
                                        >
                                            <span className="font-bold">Aa</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-400">Warna Teks</p>
                                            <p className="text-sm font-mono">{themeConfig.textPrimary}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Selected Badge */}
                                {isSelected && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-4 px-3 py-2 rounded-lg bg-purple-500/20 text-purple-300 text-sm font-medium text-center"
                                    >
                                        ✓ Tema Aktif
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Loading State Indicator */}
            {disabled && (
                <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-purple-500"></div>
                    <span>Menyimpan tema...</span>
                </div>
            )}
        </div>
    );
};

export default ThemeSelector;
