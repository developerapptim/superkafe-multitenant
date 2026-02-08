import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { serviceAPI, feedbackAPI } from '../../services/api';

function Bantuan() {
    const { tableId, settings } = useOutletContext();
    const navigate = useNavigate();

    // State for Call Waiter Modal
    const [showCallModal, setShowCallModal] = useState(false);
    const [callLoading, setCallLoading] = useState(false);

    // State for Feedback Form
    const [feedbackName, setFeedbackName] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [feedbackRating, setFeedbackRating] = useState(5);
    const [feedbackLoading, setFeedbackLoading] = useState(false);

    // Initial FAQs
    const faqs = [
        {
            q: "Bagaimana cara memesan?",
            a: "Pilih menu yang diinginkan, atur jumlah, lalu klik 'Pesan Sekarang' di halaman keranjang."
        },
        {
            q: "Berapa lama pesanan saya diproses?",
            a: "Rata-rata pesanan diproses dalam 5-15 menit tergantung antrian."
        },
        {
            q: "Bagaimana cara membayar?",
            a: "Pembayaran dapat dilakukan secara tunai atau QRIS di kasir setelah pesanan siap."
        },
        {
            q: "Apakah bisa request khusus?",
            a: "Bisa! Tuliskan permintaan khusus di kolom 'Catatan' saat checkout."
        },
        {
            q: "Apa password Wifi di sini?",
            a: "Password Wifi tercetak otomatis di bagian bawah struk pembayaran Anda."
        }
    ];

    // Handle Call Waiter
    const handleCallWaiter = async (type) => {
        if (!tableId) {
            toast.error('Fitur ini hanya tersedia jika Anda scan QR Meja.');
            return;
        }

        setCallLoading(true);
        try {
            await serviceAPI.create({
                table_number: tableId,
                request_type: type
            });
            toast.success(`Permintaan '${type}' berhasil dikirim!`);
            setShowCallModal(false);
        } catch (error) {
            console.error('Call Waiter Error:', error);
            toast.error('Gagal memanggil pelayan. Silakan coba lagi.');
        } finally {
            setCallLoading(false);
        }
    };

    // Handle Feedback Submit
    const handleFeedbackSubmit = async (e) => {
        e.preventDefault();
        if (!feedbackMessage.trim()) return;

        setFeedbackLoading(true);
        try {
            await feedbackAPI.create({
                name: feedbackName,
                message: feedbackMessage,
                rating: feedbackRating
            });
            toast.success('Terima kasih atas masukan Anda!');
            setFeedbackName('');
            setFeedbackMessage('');
            setFeedbackRating(5);
        } catch (error) {
            console.error('Feedback Error:', error);
            toast.error('Gagal mengirim masukan.');
        } finally {
            setFeedbackLoading(false);
        }
    };

    return (
        <div className="px-4 py-4 space-y-6">
            {/* Header Area */}
            <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-2xl p-6 border border-purple-500/30 text-center relative overflow-hidden">
                <div className="relative z-10">
                    <div className="text-4xl mb-2">👋</div>
                    <h2 className="text-xl font-bold mb-1">Butuh Bantuan?</h2>
                    <p className="text-sm text-gray-300">Tim kami siap membantu Anda</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div>
                <h3 className="font-bold mb-3 flex items-center gap-2">
                    <span className="text-xl">⚡</span> Aksi Cepat
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setShowCallModal(true)}
                        className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:scale-[1.02] transition-all flex flex-col items-center gap-2 group"
                    >
                        <span className="text-3xl group-hover:animate-bounce">🔔</span>
                        <span className="font-bold text-sm">Panggil Pelayan</span>
                    </button>
                    <button
                        onClick={() => window.open(`https://wa.me/62${settings?.phone || '81234567890'}`, '_blank')}
                        className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl hover:bg-green-500/20 hover:scale-[1.02] transition-all flex flex-col items-center gap-2"
                    >
                        <span className="text-3xl">💬</span>
                        <span className="font-bold text-sm text-green-400">WhatsApp Admin</span>
                    </button>
                </div>
            </div>

            {/* FAQ Section */}
            <div>
                <h3 className="font-bold mb-3 flex items-center gap-2">
                    <span className="text-xl">📚</span> FAQ (Tanya Jawab)
                </h3>
                <div className="space-y-3">
                    {faqs.map((faq, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4">
                            <h4 className="font-bold text-sm text-purple-300 mb-1">{faq.q}</h4>
                            <p className="text-sm text-gray-400">{faq.a}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Feedback Section */}
            <div>
                <h3 className="font-bold mb-3 flex items-center gap-2">
                    <span className="text-xl">📝</span> Kotak Saran
                </h3>
                <form onSubmit={handleFeedbackSubmit} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Nama (Opsional)</label>
                        <input
                            type="text"
                            value={feedbackName}
                            onChange={(e) => setFeedbackName(e.target.value)}
                            placeholder="Nama Anda"
                            className="w-full px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white text-sm focus:border-purple-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Rating</label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    type="button"
                                    key={star}
                                    onClick={() => setFeedbackRating(star)}
                                    className={`text-2xl transition-transform hover:scale-110 ${star <= feedbackRating ? 'grayscale-0' : 'grayscale opacity-30'}`}
                                >
                                    ⭐
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Pesan / Masukan <span className="text-red-400">*</span></label>
                        <textarea
                            value={feedbackMessage}
                            onChange={(e) => setFeedbackMessage(e.target.value)}
                            placeholder="Tulis kritik & saran Anda di sini..."
                            rows="3"
                            required
                            className="w-full px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white text-sm focus:border-purple-500 outline-none resize-none"
                        ></textarea>
                    </div>
                    <button
                        type="submit"
                        disabled={feedbackLoading}
                        className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg font-bold text-sm hover:scale-[1.02] transition-transform disabled:opacity-50"
                    >
                        {feedbackLoading ? 'Mengirim...' : 'Kirim Masukan'}
                    </button>
                </form>
            </div>

            {/* Call Waiter Modal */}
            <AnimatePresence>
                {showCallModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCallModal(false)}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#1a1a2e] border border-purple-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-bold text-center mb-4">🔔 Panggil Pelayan</h3>
                            <p className="text-gray-400 text-center text-sm mb-6">
                                Apa yang bisa kami bantu untuk Meja {tableId || 'ini'}?
                            </p>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <button
                                    onClick={() => handleCallWaiter('Bill')}
                                    disabled={callLoading}
                                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 flex flex-col items-center gap-2 transition-colors"
                                >
                                    <span className="text-2xl">🧾</span>
                                    <span className="text-sm font-medium">Minta Bill</span>
                                </button>
                                <button
                                    onClick={() => handleCallWaiter('Alat Makan')}
                                    disabled={callLoading}
                                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 flex flex-col items-center gap-2 transition-colors"
                                >
                                    <span className="text-2xl">🍴</span>
                                    <span className="text-sm font-medium">Alat Makan</span>
                                </button>
                                <button
                                    onClick={() => handleCallWaiter('Bersihkan')}
                                    disabled={callLoading}
                                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 flex flex-col items-center gap-2 transition-colors"
                                >
                                    <span className="text-2xl">🧹</span>
                                    <span className="text-sm font-medium">Bersihkan</span>
                                </button>
                                <button
                                    onClick={() => handleCallWaiter('Panggil')}
                                    disabled={callLoading}
                                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 flex flex-col items-center gap-2 transition-colors"
                                >
                                    <span className="text-2xl">🙋‍♂️</span>
                                    <span className="text-sm font-medium">Panggil Manual</span>
                                </button>
                            </div>

                            <button
                                onClick={() => setShowCallModal(false)}
                                className="w-full py-3 bg-gray-700/50 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                            >
                                Batal
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Bantuan;
