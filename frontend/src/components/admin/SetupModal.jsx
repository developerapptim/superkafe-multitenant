import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const SetupModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user?.role === 'admin';
    const tenantId = user?.tenantId;

    useEffect(() => {
        // Cek apakah admin pertama kali login dan belum memencet skip
        if (isAdmin && tenantId) {
            const hasSkipped = localStorage.getItem(`setup_modal_skipped_${tenantId}`);
            const hasCompletedSetup = localStorage.getItem('has_completed_setup') === 'true'; // asumsi dari checkActiveSession setup
            if (!hasSkipped && !hasCompletedSetup) {
                // Beri delay sedikit agar UI tidak menumpuk langsung
                const timer = setTimeout(() => setIsOpen(true), 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [isAdmin, tenantId]);

    const handleSkip = () => {
        localStorage.setItem(`setup_modal_skipped_${tenantId}`, 'true');
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="bg-gradient-to-br from-[#1E1B4B] to-[#0F0A1F] rounded-2xl w-full max-w-2xl border border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.2)] overflow-hidden flex flex-col h-auto max-h-[90vh]"
                >
                    {/* Hero Header */}
                    <div className="bg-gradient-to-r from-purple-600/30 to-blue-600/30 p-8 text-center relative overflow-hidden shrink-0">
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500 rounded-full blur-[80px] opacity-30"></div>
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500 rounded-full blur-[80px] opacity-30"></div>
                        
                        <div className="relative z-10">
                            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200 mb-2 font-display tracking-tight">
                                Selamat Datang di SuperKafe! 🚀
                            </h2>
                            <p className="text-purple-200/80 text-sm">
                                Sistem manajemen cerdas untuk optimasi operasional Cafe & Resto Anda.
                            </p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-8 pb-6 flex-1 overflow-y-auto custom-scrollbar">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-white mb-2">Panduan Awal Setup Sistem</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Agar Anda bisa langsung menggunakan fitur Kasir (POS), Inventaris, dan QR Menu, kami telah menyiapkan daftar <strong>Setup Checklist</strong> di Dashboard Admin Anda secara otomatis.
                            </p>
                        </div>
                        
                        <div className="bg-white/5 border border-purple-500/20 rounded-xl p-4 mb-2">
                            <div className="flex items-center gap-3">
                                <div className="text-2xl animate-bounce">📋</div>
                                <div>
                                    <h4 className="font-bold text-white text-sm">Cek Setup Progress Card di Dashboard</h4>
                                    <p className="text-xs text-gray-400 mt-1">Anda bisa mengikuti langkah-rencana setup 7 tahap, seperti menambah Menu pertama, mengatur No. WA, dan menyusun Resep HPP dengan panduan tersebut.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Actions */}
                    <div className="p-6 pt-3 bg-black/20 border-t border-white/5 flex gap-3 shrink-0">
                        <button 
                            onClick={handleSkip}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-base shadow-lg shadow-purple-500/25 transition-all outline-none"
                        >
                            Menuju Dashboard & Mulai Setup
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};

export default SetupModal;
