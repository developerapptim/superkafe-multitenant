import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaBackspace, FaLock, FaKey, FaCheckCircle } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { pinAPI } from '../../services/api';

/**
 * PinModal Component
 * 
 * @param {boolean} isOpen - Modal visibility
 * @param {function} onClose - Function to close modal
 * @param {string} mode - 'set' (new pin) or 'change' (old + new pin)
 * @param {function} onSuccess - Callback after successful PIN update
 */
const PinModal = ({ isOpen, onClose, mode = 'set', onSuccess }) => {
    const [step, setStep] = useState(mode === 'change' ? 'old' : 'new');
    const [oldPin, setOldPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [loading, setLoading] = useState(false);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setStep(mode === 'change' ? 'old' : 'new');
            setOldPin('');
            setNewPin('');
            setConfirmPin('');
        }
    }, [isOpen, mode]);

    const handleNumberClick = (num) => {
        if (step === 'old') {
            if (oldPin.length < 6) setOldPin(prev => prev + num);
        } else if (step === 'new') {
            if (newPin.length < 6) setNewPin(prev => prev + num);
        } else if (step === 'confirm') {
            if (confirmPin.length < 6) setConfirmPin(prev => prev + num);
        }
    };

    const handleBackspace = () => {
        if (step === 'old') {
            setOldPin(prev => prev.slice(0, -1));
        } else if (step === 'new') {
            setNewPin(prev => prev.slice(0, -1));
        } else if (step === 'confirm') {
            setConfirmPin(prev => prev.slice(0, -1));
        }
    };

    const handleClear = () => {
        if (step === 'old') setOldPin('');
        else if (step === 'new') setNewPin('');
        else if (step === 'confirm') setConfirmPin('');
    };

    const handleContinue = async () => {
        if (step === 'old') {
            if (oldPin.length !== 6) return toast.error('PIN lama harus 6 digit');
            setStep('new');
        } else if (step === 'new') {
            if (newPin.length !== 6) return toast.error('PIN baru harus 6 digit');
            setStep('confirm');
        } else if (step === 'confirm') {
            if (confirmPin.length !== 6) return toast.error('Konfirmasi PIN harus 6 digit');
            if (newPin !== confirmPin) return toast.error('PIN tidak cocok');
            
            handleSubmit();
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            let res;
            if (mode === 'set') {
                res = await pinAPI.setPin({ newPin });
            } else {
                res = await pinAPI.changePin({ currentPin: oldPin, newPin });
            }

            if (res.data.success) {
                toast.success(res.data.message || 'PIN berhasil diperbarui');
                if (onSuccess) onSuccess();
                onClose();
            }
        } catch (err) {
            console.error('PIN Submit Error:', err);
            toast.error(err.response?.data?.message || 'Gagal memperbarui PIN');
            // Jika PIN lama salah, balik ke step 'old'
            if (mode === 'change' && err.response?.data?.message?.toLowerCase().includes('lama')) {
                setStep('old');
                setOldPin('');
            }
        } finally {
            setLoading(false);
        }
    };

    const currentPinValue = step === 'old' ? oldPin : (step === 'new' ? newPin : confirmPin);
    
    const getStepTitle = () => {
        if (step === 'old') return 'Masukkan PIN Lama';
        if (step === 'new') return mode === 'set' ? 'Buat PIN Baru' : 'Masukkan PIN Baru';
        return 'Konfirmasi PIN Baru';
    };

    const getStepIcon = () => {
        if (step === 'old') return <FaLock className="text-amber-500" />;
        if (step === 'new') return <FaKey className="text-blue-500" />;
        return <FaCheckCircle className="text-green-500" />;
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-gray-900 border border-white/10 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 text-center relative border-b border-white/5">
                        <button 
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/60"
                        >
                            <FaTimes />
                        </button>
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3 text-xl">
                            {getStepIcon()}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">{getStepTitle()}</h3>
                        <p className="text-sm text-white/50">Masukkan 6 digit angka untuk keamanan</p>
                    </div>

                    {/* PIN Display */}
                    <div className="p-8 flex justify-center gap-3">
                        {[...Array(6)].map((_, i) => (
                            <div 
                                key={i}
                                className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${
                                    currentPinValue.length > i 
                                    ? 'border-purple-500 bg-purple-500/20' 
                                    : 'border-white/10 bg-white/5'
                                }`}
                            >
                                {currentPinValue.length > i && (
                                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Numpad */}
                    <div className="p-6 grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button
                                key={num}
                                onClick={() => handleNumberClick(num.toString())}
                                className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-2xl font-bold text-white flex items-center justify-center"
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            onClick={handleClear}
                            className="h-16 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold transition-all flex items-center justify-center"
                        >
                            C
                        </button>
                        <button
                            onClick={() => handleNumberClick('0')}
                            className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-2xl font-bold text-white flex items-center justify-center"
                        >
                            0
                        </button>
                        <button
                            onClick={handleBackspace}
                            className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 transition-all flex items-center justify-center"
                        >
                            <FaBackspace size={24} />
                        </button>

                        <div className="col-span-3 mt-4 flex gap-3">
                            {step !== 'old' && (
                                <button
                                    onClick={() => setStep(step === 'confirm' ? 'new' : 'old')}
                                    className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 font-bold text-white/70 transition-all"
                                >
                                    Kembali
                                </button>
                            )}
                            <button
                                onClick={handleContinue}
                                disabled={currentPinValue.length !== 6 || loading}
                                className={`flex-[2] py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 ${
                                    currentPinValue.length === 6 ? 'shadow-purple-500/20' : ''
                                }`}
                            >
                                {loading ? 'Memproses...' : (step === 'confirm' ? 'Simpan PIN' : 'Lanjutkan')}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PinModal;
