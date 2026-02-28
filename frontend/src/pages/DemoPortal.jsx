
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaMobileAlt, FaLaptop, FaChevronRight } from 'react-icons/fa';
import { BiCoffeeTogo } from 'react-icons/bi';
import { RiDashboard3Line } from 'react-icons/ri';

const DemoPortal = () => {
    return (
        <div className="min-h-screen bg-slate-900 bg-gradient-to-br from-slate-900 to-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-poppins">

            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-600/20 rounded-full blur-[100px]" />
                <div className="absolute -bottom-[10%] left-[20%] w-[40%] h-[40%] bg-orange-600/10 rounded-full blur-[120px]" />
            </div>

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-12 z-10"
            >
                <img
                    src="https://res.cloudinary.com/dhjqb65mf/image/upload/v1770018588/Picsart_26-02-02_15-46-53-772_vw9xc3.png"
                    alt="Logo"
                    className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-4 object-contain"
                />
                <h1 className="text-4xl md:text-6xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent tracking-tight">
                    SuperKafe
                </h1>
                <p className="text-gray-400 text-sm md:text-lg tracking-wide">
                    Sistem Manajemen Kafe Terintegrasi
                </p>
            </motion.div>

            {/* Cards Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl z-10">

                {/* Customer Card */}
                <Link to="/customer" className="group">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="relative p-8 h-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl hover:bg-white/10 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(234,88,12,0.3)] cursor-pointer overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110" />

                        <div className="relative z-10 flex flex-col items-center text-center h-full">
                            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-orange-400/20 to-amber-600/20 text-orange-400 shadow-inner ring-1 ring-white/10">
                                <BiCoffeeTogo className="text-4xl md:text-5xl" />
                            </div>

                            <h2 className="text-2xl font-bold mb-3 text-white">Tampilan Pelanggan</h2>
                            <p className="text-gray-400 text-sm mb-8 flex-grow">
                                Simulasi Scan QR. Lihat menu digital yang interaktif & buat pesanan langsung dari meja.
                            </p>

                            <div className="flex items-center gap-2 text-orange-400 font-medium group-hover:gap-4 transition-all">
                                <span>Buka Menu</span>
                                <FaChevronRight />
                            </div>
                        </div>
                    </motion.div>
                </Link>

                {/* Admin Card */}
                <Link to="/auth/login" className="group">
                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="relative p-8 h-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl hover:bg-white/10 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] cursor-pointer overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110" />

                        <div className="relative z-10 flex flex-col items-center text-center h-full">
                            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-blue-400/20 to-purple-600/20 text-blue-400 shadow-inner ring-1 ring-white/10">
                                <RiDashboard3Line className="text-4xl md:text-5xl" />
                            </div>

                            <h2 className="text-2xl font-bold mb-3 text-white">Dashboard Admin</h2>
                            <p className="text-gray-400 text-sm mb-8 flex-grow">
                                Masuk sebagai Owner atau Kasir. Kelola stok bahan, menu, pesanan, dan laporan keuangan.
                            </p>

                            <div className="flex items-center gap-2 text-blue-400 font-medium group-hover:gap-4 transition-all">
                                <span>Login Admin</span>
                                <FaChevronRight />
                            </div>
                        </div>
                    </motion.div>
                </Link>

            </div>

            {/* Footer */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="mt-12 text-center z-10"
            >
                <p className="text-xs text-slate-500 border-t border-white/5 pt-6 px-12">
                    Demo Version v1.0 • Powered by <span className="text-slate-400 font-semibold">LockApp.id</span>
                </p>
            </motion.div>
        </div>
    );
};

export default DemoPortal;
