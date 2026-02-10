import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FloatingMergeBar = ({ count, total, onMerge, onCancel, disabled }) => {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4"
            >
                <div className="bg-white/90 backdrop-blur-md border border-purple-500/30 rounded-2xl shadow-2xl p-4 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-800">
                            {count} Pesanan Dipilih
                        </span>
                        <span className="text-xs text-purple-600 font-bold">
                            Total: Rp {total.toLocaleString('id-ID')}
                        </span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={onMerge}
                            disabled={disabled}
                            className={`px-4 py-2 text-sm font-bold text-white rounded-xl shadow-lg transition-all ${disabled
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 hover:shadow-purple-500/25'
                                }`}
                        >
                            Gabung Pesanan
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default FloatingMergeBar;
