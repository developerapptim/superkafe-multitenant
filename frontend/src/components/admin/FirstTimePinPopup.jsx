import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiX, FiShield } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Numpad from '../Numpad';

const FirstTimePinPopup = ({ isOpen, onSuccess, onSkip }) => {
    const [pin, setPin] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (enteredPin) => {
        if (enteredPin.length !== 6) {
            toast.error('PIN harus 6 digit angka');
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.post('/auth/set-pin', { pin: enteredPin });
            if (response.data.success) {
                toast.success('PIN berhasil disimpan!');
                onSuccess();
            } else {
                throw new Error(response.data.message || 'Gagal menyimpan PIN');
            }
        } catch (error) {
            console.error('Failed to set PIN:', error);
            toast.error(error.response?.data?.message || error.message || 'Gagal mengatur PIN');
        } finally {
            setIsLoading(false);
        }
    };

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'default';

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" data-theme={currentTheme}>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md admin-bg-sidebar border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header / Banner */}
                        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
                                    <FiShield className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white tracking-wide">Buat PIN Anda</h2>
                                    <p className="text-white/80 text-sm mt-1 leading-snug">
                                        PIN 6 digit ini diperlukan untuk login cepat ke kasir via tablet.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="p-6">
                            <div className="flex justify-center mb-6">
                                <div className="flex gap-3">
                                    {[0, 1, 2, 3, 4, 5].map((index) => (
                                        <motion.div
                                            key={index}
                                            initial={false}
                                            animate={{
                                                scale: pin.length > index ? [1, 1.1, 1] : 1,
                                                borderColor: pin.length > index ? 'var(--admin-accent-primary)' : 'rgba(255,255,255,0.2)',
                                                backgroundColor: pin.length > index ? 'var(--admin-accent-primary)' : 'transparent'
                                            }}
                                            className="w-4 h-4 rounded-full border-2 transition-colors duration-200 shadow-inner"
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="max-w-[300px] mx-auto border-t border-white/10 pt-6">
                                <Numpad
                                    value={pin}
                                    onChange={setPin}
                                    maxLength={6}
                                    onSubmit={handleSubmit}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 mt-8 pt-6 border-t border-white/10">
                                <button
                                    onClick={onSkip}
                                    disabled={isLoading}
                                    className="flex-1 py-3 px-4 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                                >
                                    Lewati
                                </button>
                                <button
                                    onClick={() => handleSubmit(pin)}
                                    disabled={isLoading || pin.length !== 6}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <FiCheck />
                                            Simpan PIN
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default FirstTimePinPopup;
