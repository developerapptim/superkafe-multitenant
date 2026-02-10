import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MergeConfirmationModal = ({ orders, onClose, onConfirm }) => {
    const [customerName, setCustomerName] = useState(orders[0]?.customerName || '');
    const [tableNumber, setTableNumber] = useState(orders[0]?.tableNumber || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const totalAmount = useMemo(() => {
        return orders.reduce((sum, order) => sum + (order.total || 0), 0);
    }, [orders]);

    const allItems = useMemo(() => {
        return orders.flatMap(order => order.items || []);
    }, [orders]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        await onConfirm({
            mergedCustomerName: customerName,
            mergedTableNumber: tableNumber
        });
        setIsSubmitting(false);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-[#1e1b4b] border border-purple-500/30 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
                >
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xl font-bold text-white">Konfirmasi Gabung Pesanan</h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Menggabungkan <span className="text-purple-400 font-bold">{orders.length} pesanan</span> menjadi satu.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Display Orders to be Merged */}
                        <div className="bg-white/5 rounded-xl p-4 space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                            {orders.map((order) => (
                                <div key={order.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                    <div>
                                        <span className="text-gray-300 font-medium block">{order.customerName}</span>
                                        <span className="text-xs text-gray-500">{order.id}</span>
                                    </div>
                                    <span className="text-purple-400 font-bold">
                                        Rp {order.total?.toLocaleString('id-ID')}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Inputs for New Merged Order */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Nama Pelanggan (Gabungan)</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                                    placeholder="Nama Pelanggan"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Nomor Meja</label>
                                <input
                                    type="text"
                                    value={tableNumber}
                                    onChange={(e) => setTableNumber(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                                    placeholder="No. Meja"
                                />
                            </div>
                        </div>

                        {/* Grand Total */}
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex justify-between items-center">
                            <span className="text-gray-300 font-medium">Grand Total</span>
                            <span className="text-2xl font-bold text-white">
                                Rp {totalAmount.toLocaleString('id-ID')}
                            </span>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-3 text-sm font-bold text-gray-300 bg-white/5 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-purple-900/20 transition-all disabled:opacity-70 flex justify-center items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Memproses...
                                    </>
                                ) : (
                                    'Konfirmasi Gabung'
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default MergeConfirmationModal;
