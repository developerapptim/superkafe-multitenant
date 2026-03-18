import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiLock, FiMail, FiRefreshCcw, FiArrowRight, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { pinAPI } from '../../services/api';

const PinSecurityModal = ({ 
    isOpen, 
    onClose, 
    onSuccess, 
    tempToken, 
    email, 
    tenantSlug 
}) => {
    const [mode, setMode] = useState('VERIFY_PIN'); // VERIFY_PIN, REQUEST_RESET, SET_NEW_PIN
    const [pin, setPin] = useState(['', '', '', '', '', '']);
    const [resetCode, setResetCode] = useState('');
    const [newPin, setNewPin] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    
    const pinRefs = useRef([]);
    const newPinRefs = useRef([]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setMode('VERIFY_PIN');
            setPin(['', '', '', '', '', '']);
            setResetCode('');
            setNewPin(['', '', '', '', '', '']);
            setTimeout(() => pinRefs.current[0]?.focus(), 100);
        }
    }, [isOpen]);

    const handlePinChange = (index, value, type = 'verify') => {
        if (value.length > 1) value = value.slice(-1); // Only allow 1 char
        if (!/^\d*$/.test(value)) return; // Only allow numbers

        const currentPin = type === 'verify' ? [...pin] : [...newPin];
        currentPin[index] = value;
        
        if (type === 'verify') setPin(currentPin);
        else setNewPin(currentPin);

        // Move to next input
        if (value && index < 5) {
            if (type === 'verify') pinRefs.current[index + 1]?.focus();
            else newPinRefs.current[index + 1]?.focus();
        }

        // Trigger submission if all filled
        if (currentPin.every(digit => digit !== '') && currentPin.length === 6) {
            if (type === 'verify') {
                submitVerification(currentPin.join(''));
            }
        }
    };

    const handleKeyDown = (index, e, type = 'verify') => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            if (type === 'verify') {
                const newPinState = [...pin];
                newPinState[index - 1] = '';
                setPin(newPinState);
                pinRefs.current[index - 1]?.focus();
            } else {
                const newPinState = [...newPin];
                newPinState[index - 1] = '';
                setNewPin(newPinState);
                newPinRefs.current[index - 1]?.focus();
            }
        }
    };

    const submitVerification = async (pinValue) => {
        setLoading(true);
        try {
            const res = await pinAPI.verifyGooglePin({
                tempToken,
                pin: pinValue,
                tenantSlug
            });

            if (res.data.success) {
                toast.success('PIN Valid! Mengarahkan ke dashboard...');
                onSuccess(res.data); // Pass full auth response
            }
        } catch (error) {
            setPin(['', '', '', '', '', '']); // Reset PIN input
            pinRefs.current[0]?.focus();
            toast.error(error.response?.data?.message || 'PIN salah atau sesi kedaluwarsa');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestReset = async () => {
        setLoading(true);
        try {
            const res = await pinAPI.requestPinReset({ email, tempToken, tenantSlug });
            if (res.data.success) {
                toast.success(res.data.message);
                setMode('SET_NEW_PIN');
                setTimeout(() => newPinRefs.current[0]?.focus(), 100);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal mengirim kode reset');
        } finally {
            setLoading(false);
        }
    };

    const handleResetSubmit = async (e) => {
        e.preventDefault();
        const pinValue = newPin.join('');
        if (pinValue.length !== 6) {
            return toast.error('PIN baru harus 6 digit');
        }
        if (!resetCode) {
            return toast.error('Masukkan kode reset dari email');
        }

        setLoading(true);
        try {
            const res = await pinAPI.resetGooglePin({
                email,
                tempToken,
                resetCode,
                newPin: pinValue,
                tenantSlug
            });

            if (res.data.success) {
                toast.success('PIN berhasil direset! Silakan login dengan PIN baru.');
                setMode('VERIFY_PIN');
                setPin(['', '', '', '', '', '']);
                setTimeout(() => pinRefs.current[0]?.focus(), 100);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Gagal reset PIN');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={loading}
                    >
                        <FiX size={24} />
                    </button>

                    <div className="p-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/30">
                            {mode === 'REQUEST_RESET' ? (
                                <FiMail className="text-white text-3xl" />
                            ) : (
                                <FiLock className="text-white text-3xl" />
                            )}
                        </div>

                        {mode === 'VERIFY_PIN' && (
                            <>
                                <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Keamanan PIN</h2>
                                <p className="text-gray-500 text-center text-sm mb-8">
                                    Akun Anda dilindungi PIN. Masukkan 6 digit PIN Anda untuk melanjutkan login.
                                </p>

                                <div className="flex justify-center gap-3 mb-8">
                                    {pin.map((digit, index) => (
                                        <input
                                            key={index}
                                            ref={el => pinRefs.current[index] = el}
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={e => handlePinChange(index, e.target.value, 'verify')}
                                            onKeyDown={e => handleKeyDown(index, e, 'verify')}
                                            disabled={loading}
                                            className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-gray-200 focus:border-amber-600 focus:ring-0 bg-gray-50 focus:bg-white transition-all disabled:opacity-50"
                                        />
                                    ))}
                                </div>

                                <button
                                    onClick={() => setMode('REQUEST_RESET')}
                                    className="block w-full text-center text-amber-700 hover:text-amber-800 font-medium text-sm transition-colors py-2"
                                    disabled={loading}
                                >
                                    Lupa PIN Anda?
                                </button>
                            </>
                        )}

                        {mode === 'REQUEST_RESET' && (
                            <>
                                <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Lupa PIN</h2>
                                <p className="text-gray-500 text-center text-sm mb-6">
                                    Kami akan mengirimkan kode pemulihan ke <strong className="text-gray-800">{email}</strong>.
                                </p>

                                <button
                                    onClick={handleRequestReset}
                                    disabled={loading}
                                    className="w-full py-3 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold transition-colors mb-4 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <span className="animate-spin border-2 border-white/20 border-t-white rounded-full w-5 h-5"></span>
                                    ) : (
                                        <>
                                            <FiMail /> Kirim Kode Reset
                                        </>
                                    )}
                                </button>
                                
                                <button
                                    onClick={() => setMode('VERIFY_PIN')}
                                    className="block w-full text-center text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors py-2"
                                    disabled={loading}
                                >
                                    Kembali ke Login
                                </button>
                            </>
                        )}

                        {mode === 'SET_NEW_PIN' && (
                            <form onSubmit={handleResetSubmit}>
                                <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Atur PIN Baru</h2>
                                <p className="text-gray-500 text-center text-sm mb-6">
                                    Cek email Anda untuk kode reset, lalu masukkan PIN baru Anda.
                                </p>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Kode Reset (Email)</label>
                                        <input
                                            type="text"
                                            value={resetCode}
                                            onChange={e => setResetCode(e.target.value)}
                                            placeholder="Masukkan kode 6 digit dari email"
                                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-center tracking-widest text-lg font-bold"
                                            required
                                            disabled={loading}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2 text-center">PIN Baru (6 Angka)</label>
                                        <div className="flex justify-center gap-2">
                                            {newPin.map((digit, index) => (
                                                <input
                                                    key={index}
                                                    ref={el => newPinRefs.current[index] = el}
                                                    type="password"
                                                    inputMode="numeric"
                                                    maxLength={1}
                                                    value={digit}
                                                    onChange={e => handlePinChange(index, e.target.value, 'new')}
                                                    onKeyDown={e => handleKeyDown(index, e, 'new')}
                                                    disabled={loading}
                                                    className="w-10 h-12 text-center text-lg font-bold rounded-lg border-2 border-gray-200 focus:border-amber-600 focus:ring-0 bg-gray-50 transition-all disabled:opacity-50"
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || newPin.join('').length !== 6 || !resetCode}
                                        className="w-full py-3 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <span className="animate-spin border-2 border-white/20 border-t-white rounded-full w-5 h-5"></span>
                                        ) : (
                                            <>
                                                <FiCheck /> Simpan PIN Baru
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PinSecurityModal;
