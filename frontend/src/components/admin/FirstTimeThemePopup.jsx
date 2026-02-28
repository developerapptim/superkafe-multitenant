import { motion, AnimatePresence } from 'framer-motion';
import { themePresets } from '../../config/themeStyles';

/**
 * FirstTimeThemePopup Component
 * 
 * Modal dialog for first-time theme selection shown to new tenant owners.
 * Displays visual previews of available themes with selection and skip options.
 * 
 * Feature: Seamless Branding Integration
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the popup is visible
 * @param {Function} props.onThemeSelect - Callback when theme is selected (receives themeName)
 * @param {Function} props.onSkip - Callback when skip button is clicked (defaults to 'default' theme)
 */
const FirstTimeThemePopup = ({ isOpen, onThemeSelect, onSkip }) => {
    const handleThemeSelect = (themeName) => {
        if (onThemeSelect) {
            onThemeSelect(themeName);
        }
    };

    const handleSkip = () => {
        if (onSkip) {
            onSkip();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={handleSkip}
                    />

                    {/* Modal Content */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-[#1E1B4B] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-white/10">
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    <h2 className="text-2xl font-bold text-white mb-2">
                                        🎨 Pilih Tema Tampilan Anda
                                    </h2>
                                    <p className="text-gray-300 text-sm">
                                        Selamat datang! Pilih tema yang sesuai dengan preferensi Anda.
                                        Anda dapat mengubahnya kapan saja di halaman Pengaturan.
                                    </p>
                                </motion.div>
                            </div>

                            {/* Theme Options */}
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {Object.entries(themePresets)
                                        .filter(([_, config]) => !config.isCustomerOnly)
                                        .map(([themeKey, themeConfig], index) => (
                                            <motion.div
                                                key={themeKey}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.2 + index * 0.1 }}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                className="relative"
                                            >
                                                {/* Theme Preview Card */}
                                                <div className="bg-white/5 rounded-xl p-6 border-2 border-white/10 hover:border-purple-500/50 transition-all cursor-pointer">
                                                    {/* Theme Name */}
                                                    <h3 className="text-xl font-bold text-white mb-2">
                                                        {themeConfig.name}
                                                    </h3>

                                                    {/* Theme Description */}
                                                    <p className="text-sm text-gray-400 mb-4">
                                                        {themeKey === 'default'
                                                            ? 'Tema gelap dengan aksen ungu yang elegan dan modern'
                                                            : 'Tema terang dengan nuansa cokelat hangat yang nyaman'}
                                                    </p>

                                                    {/* Visual Preview */}
                                                    <div className="space-y-3 mb-4">
                                                        {/* Main Background */}
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-16 h-16 rounded-lg border-2 border-white/20 shadow-lg"
                                                                style={{ backgroundColor: themeConfig.bgMain }}
                                                            />
                                                            <div className="flex-1">
                                                                <p className="text-xs text-gray-400">Background</p>
                                                                <p className="text-sm font-mono text-white">
                                                                    {themeConfig.bgMain}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Sidebar & Accent Colors */}
                                                        <div className="flex gap-3">
                                                            <div className="flex-1 flex items-center gap-2">
                                                                <div
                                                                    className="w-12 h-12 rounded-lg border-2 border-white/20"
                                                                    style={{ backgroundColor: themeConfig.bgSidebar }}
                                                                />
                                                                <div>
                                                                    <p className="text-xs text-gray-400">Sidebar</p>
                                                                    <p className="text-xs font-mono text-white">
                                                                        {themeConfig.bgSidebar}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 flex items-center gap-2">
                                                                <div
                                                                    className="w-12 h-12 rounded-lg border-2 border-white/20"
                                                                    style={{ backgroundColor: themeConfig.accentColor }}
                                                                />
                                                                <div>
                                                                    <p className="text-xs text-gray-400">Aksen</p>
                                                                    <p className="text-xs font-mono text-white">
                                                                        {themeConfig.accentColor}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Text Preview */}
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-16 h-16 rounded-lg border-2 border-white/20 flex items-center justify-center text-2xl font-bold"
                                                                style={{
                                                                    backgroundColor: themeConfig.bgMain,
                                                                    color: themeConfig.textPrimary
                                                                }}
                                                            >
                                                                Aa
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-xs text-gray-400">Teks</p>
                                                                <p className="text-sm font-mono text-white">
                                                                    {themeConfig.textPrimary}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Select Button */}
                                                    <button
                                                        onClick={() => handleThemeSelect(themeKey)}
                                                        className="w-full py-3 px-4 rounded-lg font-semibold transition-all bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-purple-500/50"
                                                    >
                                                        Pilih Tema Ini
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}
                                </div>
                            </div>

                            {/* Footer with Skip Button */}
                            <div className="p-6 border-t border-white/10">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="flex flex-col items-center gap-3"
                                >
                                    <button
                                        onClick={handleSkip}
                                        className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
                                    >
                                        Lewati untuk sekarang (gunakan tema default)
                                    </button>
                                    <p className="text-xs text-gray-500 text-center">
                                        Anda dapat mengubah tema kapan saja di menu Pengaturan
                                    </p>
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};

export default FirstTimeThemePopup;
