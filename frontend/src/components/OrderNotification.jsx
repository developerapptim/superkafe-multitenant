import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

const OrderNotification = () => {
    const socket = useSocket();
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('pos_muted') === 'true');
    const [soundUrl, setSoundUrl] = useState(null);
    const lastPlayedRef = useRef(0);

    // ─── Fetch notification sound URL ────────────────────────────────────
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const cached = localStorage.getItem('appSettings');
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        if (parsed.notificationSoundUrl) setSoundUrl(parsed.notificationSoundUrl);
                    } catch (e) {}
                }
                const res = await api.get('/settings');
                if (res.data?.notificationSoundUrl) {
                    setSoundUrl(res.data.notificationSoundUrl);
                    // Update cache for others
                    try {
                        const currentCache = JSON.parse(localStorage.getItem('appSettings') || '{}');
                        currentCache.notificationSoundUrl = res.data.notificationSoundUrl;
                        localStorage.setItem('appSettings', JSON.stringify(currentCache));
                    } catch (e) {}
                }
            } catch (err) {
                console.warn('Failed to fetch sound settings:', err);
            }
        };

        fetchSettings();
        window.addEventListener('focus', fetchSettings);

        // Listen for mute toggles from Kasir.jsx header button
        const handleStorageChange = (e) => {
            if (e.key === 'pos_muted') {
                setIsMuted(e.newValue === 'true');
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('focus', fetchSettings);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    // ─── Play Notification Sound ─────────────────────────────────────────
    const playNotificationSound = useCallback(async () => {
        // Rate-limit: don't overlap sounds within 2 seconds
        const now = Date.now();
        if (now - lastPlayedRef.current < 2000) return;
        lastPlayedRef.current = now;

        // Check mute state directly from storage (most reliable)
        if (localStorage.getItem('pos_muted') === 'true') return;

        if (soundUrl) {
            try {
                let finalUrl = soundUrl;
                // Parse relative URL by prepending backend host (same as Pengaturan.jsx)
                if (finalUrl.startsWith('/')) {
                    const apiUrl = api.defaults?.baseURL || '';
                    const baseUrl = apiUrl.replace(/\/api$/, '');
                    finalUrl = `${baseUrl}${finalUrl}`;
                }

                const audio = new Audio(finalUrl);
                audio.volume = 0.8;
                await audio.play();
            } catch (audioErr) {
                console.warn('Playback failed:', audioErr.message);
            }
        } else {
             console.warn('No notification sound URL configured.');
        }
    }, [soundUrl]);

    // ─── Socket Listener ─────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const handleOrderUpdate = (data) => {
            if (data.action === 'create') {
                console.log('🔔 New Order Received via Socket!');
                playNotificationSound();
                toast('Pesanan Baru Masuk! 🔔', {
                    duration: 6000,
                    position: 'top-right',
                    style: {
                        background: '#1e1b4b',
                        color: '#fff',
                        border: '1px solid #a855f7',
                        fontWeight: 'bold'
                    }
                });
            }
        };

        socket.on('orders:update', handleOrderUpdate);
        return () => socket.off('orders:update', handleOrderUpdate);
    }, [socket, playNotificationSound]);

    // ─── Fallback Polling (ONLY when socket is disconnected) ─────────────
    const lastPendingCountRef = useRef(null);
    const pollIntervalRef = useRef(null);

    useEffect(() => {
        if (!socket) return;

        const pollPendingCount = async () => {
            try {
                const res = await api.get('/orders/pending-count');
                const newCount = res.data?.count ?? 0;

                if (lastPendingCountRef.current !== null && newCount > lastPendingCountRef.current) {
                    console.log(`🔔 Fallback Poll: Pending count increased ${lastPendingCountRef.current} → ${newCount}`);
                    playNotificationSound();
                    toast('Pesanan Baru Masuk! 🔔', {
                        duration: 6000,
                        position: 'top-right',
                        style: {
                            background: '#1e1b4b',
                            color: '#fff',
                            border: '1px solid #a855f7',
                            fontWeight: 'bold'
                        }
                    });
                }
                lastPendingCountRef.current = newCount;
            } catch (err) {
                // Silently fail
            }
        };

        const startPolling = () => {
            if (pollIntervalRef.current) return; // Already polling
            console.log('⚠️ Socket disconnected — starting fallback polling (every 10s)');
            pollPendingCount(); // Baseline
            pollIntervalRef.current = setInterval(pollPendingCount, 10000);
        };

        const stopPolling = () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
                console.log('✅ Socket reconnected — stopped fallback polling');
            }
        };

        const handleConnect = () => stopPolling();
        const handleDisconnect = () => startPolling();

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);

        // If socket is already disconnected at mount time, start polling immediately
        if (!socket.connected) {
            startPolling();
        }

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            stopPolling();
        };
    }, [socket, playNotificationSound]);

    return null;
};

export default OrderNotification;
