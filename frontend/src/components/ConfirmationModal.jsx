import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaExclamationTriangle } from 'react-icons/fa';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Konfirmasi',
    message = 'Apakah Anda yakin?',
    confirmText = 'Ya, Lanjutkan',
    cancelText = 'Batal',
    isDanger = false,
    isLoading = false
}) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={!isLoading ? onClose : undefined}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-[#1E1B4B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                {isDanger && <FaExclamationTriangle className="text-yellow-500" />}
                                {title}
                            </h3>
                            <button
                                onClick={!isLoading ? onClose : undefined}
                                className="p-1 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                                disabled={isLoading}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            <p className="text-gray-300 leading-relaxed">
                                {message}
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-4 bg-black/20 border-t border-white/5">
                            <button
                                onClick={onClose}
                                disabled={isLoading}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={isLoading}
                                className={`px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isDanger
                                        ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-red-500/20'
                                        : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-blue-500/20'
                                    }`}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Memproses...
                                    </span>
                                ) : confirmText}
                            </button>
                        </div>

                        {/* Decorative Gradient Line */}
                        <div className={`h-1 w-full bg-gradient-to-r ${isDanger ? 'from-red-500 to-orange-500' : 'from-blue-500 to-purple-500'}`} />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmationModal;
