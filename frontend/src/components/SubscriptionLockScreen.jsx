import { motion } from 'framer-motion';
import { FiLock, FiExternalLink, FiCopy, FiSmartphone } from 'react-icons/fi';
import usePlatform from '../hooks/usePlatform';
import toast from 'react-hot-toast';

/**
 * SubscriptionLockScreen
 * Fullscreen overlay when subscription is expired (after grace period).
 * Platform-aware: Web shows payment button, Mobile shows browser instruction.
 */
const SubscriptionLockScreen = ({ tenantSlug, onDismiss }) => {
    const { isNative, isWeb } = usePlatform();

    const billingUrl = `https://superkafe.com/${tenantSlug}/admin/subscription/upgrade`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(billingUrl).then(() => {
            toast.success('Link berhasil disalin!');
        }).catch(() => {
            toast.error('Gagal menyalin link');
        });
    };

    const handleGoToBilling = () => {
        window.location.href = `/${tenantSlug}/admin/subscription/upgrade`;
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0f0524 0%, #1a0a3e 50%, #0d0420 100%)' }}
        >
            {/* Animated background particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute rounded-full"
                        style={{
                            width: 150 + i * 40,
                            height: 150 + i * 40,
                            background: `radial-gradient(circle, rgba(139,92,246,${0.08 - i * 0.01}) 0%, transparent 70%)`,
                            left: `${10 + i * 15}%`,
                            top: `${20 + (i % 3) * 25}%`,
                        }}
                        animate={{
                            y: [0, -20, 0],
                            scale: [1, 1.05, 1],
                        }}
                        transition={{
                            duration: 4 + i,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: i * 0.5,
                        }}
                    />
                ))}
            </div>

            <div className="relative z-10 max-w-lg w-full mx-4 text-center">
                {/* Lock Icon */}
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', duration: 0.8, delay: 0.2 }}
                    className="mx-auto mb-8 w-28 h-28 rounded-full flex items-center justify-center"
                    style={{
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.05) 100%)',
                        border: '2px solid rgba(239,68,68,0.3)',
                        boxShadow: '0 0 40px rgba(239,68,68,0.15)',
                    }}
                >
                    <FiLock className="text-red-400" size={48} />
                </motion.div>

                {/* Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-3xl md:text-4xl font-bold text-white mb-4"
                >
                    Langganan Telah Berakhir
                </motion.h1>

                {/* Description */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-white/60 text-lg mb-10 max-w-md mx-auto leading-relaxed"
                >
                    Akses ke fitur kasir dan administrasi telah dibekukan.
                    {isNative
                        ? ' Perpanjang langganan melalui browser untuk memulihkan akses.'
                        : ' Perpanjang langganan Anda sekarang untuk memulihkan akses.'}
                </motion.p>

                {/* Action Area */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-4"
                >
                    {isWeb ? (
                        /* WEB: Show payment button */
                        <button
                            onClick={handleGoToBilling}
                            className="w-full max-w-sm mx-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-lg font-bold text-white transition-all hover:scale-[1.02] active:scale-95 shadow-2xl"
                            style={{
                                background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 50%, #4F46E5 100%)',
                                boxShadow: '0 10px 40px rgba(139, 92, 246, 0.4)',
                            }}
                        >
                            <FiExternalLink size={22} />
                            Perpanjang Langganan Sekarang
                        </button>
                    ) : (
                        /* MOBILE APP: Show instruction + copy link */
                        <>
                            <div
                                className="w-full max-w-sm mx-auto p-5 rounded-2xl text-left"
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    backdropFilter: 'blur(20px)',
                                }}
                            >
                                <div className="flex items-start gap-3 mb-4">
                                    <FiSmartphone className="text-purple-400 mt-0.5 flex-shrink-0" size={20} />
                                    <div>
                                        <p className="text-white font-semibold text-sm mb-1">Perpanjang via Browser</p>
                                        <p className="text-white/50 text-xs leading-relaxed">
                                            Buka browser (Chrome/Safari) di perangkat Anda dan kunjungi:
                                        </p>
                                    </div>
                                </div>
                                <div
                                    className="flex items-center gap-2 p-3 rounded-xl"
                                    style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
                                >
                                    <code className="text-purple-300 text-xs flex-1 break-all font-mono">
                                        superkafe.com/{tenantSlug}/admin/subscription/upgrade
                                    </code>
                                </div>
                            </div>

                            <button
                                onClick={handleCopyLink}
                                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white/90 mx-auto transition-all hover:scale-[1.02] active:scale-95"
                                style={{
                                    background: 'rgba(139,92,246,0.2)',
                                    border: '1px solid rgba(139,92,246,0.3)',
                                }}
                            >
                                <FiCopy size={16} />
                                Salin Link Pembayaran
                            </button>
                        </>
                    )}
                </motion.div>

                {/* Subtle help text */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="text-white/30 text-xs mt-10"
                >
                    Butuh bantuan? Hubungi tim support SuperKafe
                </motion.p>
            </div>
        </motion.div>
    );
};

export default SubscriptionLockScreen;
