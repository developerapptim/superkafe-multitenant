import { useState, useEffect, useRef } from 'react';
import { serviceAPI } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

function NotificationBell() {
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);

    // Audio ref
    const audioRef = useRef(new Audio('/notif.mp3'));
    const previousCount = useRef(0);

    const fetchNotifications = async () => {
        try {
            const res = await serviceAPI.getPending();
            const newData = res.data || [];

            // Logic for sound alert
            if (newData.length > previousCount.current) {
                try {
                    const playPromise = audioRef.current.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            console.warn("Audio autoplay blocked:", error);
                        });
                    }
                } catch (err) {
                    console.warn("Audio play error:", err);
                }
            }

            setNotifications(newData);
            previousCount.current = newData.length;
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        }
    };

    // Polling every 15 seconds
    useEffect(() => {
        // Initial fetch logic to set count without sound
        const initialFetch = async () => {
            try {
                const res = await serviceAPI.getPending();
                const data = res.data || [];
                setNotifications(data);
                previousCount.current = data.length;
            } catch (error) {
                console.error('Failed to fetch initial notifications', error);
            }
        };

        initialFetch();

        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleComplete = async (id) => {
        setLoading(true);
        try {
            await serviceAPI.complete(id);
            toast.success('Permintaan diselesaikan');
            fetchNotifications(); // Refresh immediately
        } catch (error) {
            toast.error('Gagal update status');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative z-50">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowDropdown(!showDropdown);
                }}
                className="relative p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
                <span className="text-xl">🔔</span>
                {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                        {notifications.length}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {showDropdown && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDropdown(false);
                            }}
                        ></div>
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="fixed md:absolute top-16 md:top-auto left-4 right-4 md:left-auto md:right-0 md:mt-2 w-auto md:w-80 bg-[#1e1e2f] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 origin-top-right"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <h3 className="font-bold text-sm">Notifikasi</h3>
                                <button
                                    onClick={fetchNotifications}
                                    className="text-xs text-purple-400 hover:text-purple-300"
                                >
                                    Refresh
                                </button>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        Tidak ada permintaan baru
                                    </div>
                                ) : (
                                    <div className="divide-y divide-white/5">
                                        {notifications.map((notif) => (
                                            <div key={notif._id} className="p-3 hover:bg-white/5 transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-yellow-400 text-sm">
                                                        Meja {notif.table_number}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500">
                                                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium mb-1">{notif.request_type}</p>
                                                {notif.note && (
                                                    <p className="text-xs text-gray-400 italic mb-2 bg-black/20 p-1.5 rounded border border-white/5">
                                                        "{notif.note}"
                                                    </p>
                                                )}

                                                <button
                                                    onClick={() => handleComplete(notif._id)}
                                                    disabled={loading}
                                                    className="w-full py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold hover:bg-green-500/30 transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <span>✅</span> Selesai
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

export default NotificationBell;
