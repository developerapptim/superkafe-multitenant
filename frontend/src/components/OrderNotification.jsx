import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

const OrderNotification = () => {
    const socket = useSocket();
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('pos_muted') === 'true');
    const [soundUrl, setSoundUrl] = useState(null);
    const audioContextRef = useRef(null);
    const lastPlayedRef = useRef(0);
    const isAudioUnlockedRef = useRef(false); // Track if audio is unlocked via user gesture

    // ─── Unlock AudioContext on first user interaction ───────────────────
    // Browsers require a user gesture before audio can play.
    // We create + resume the AudioContext on any click/tap to pre-unlock it.
    useEffect(() => {
        const unlockAudio = () => {
            if (isAudioUnlockedRef.current) return;
            try {
                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (audioContextRef.current.state === 'suspended') {
                    audioContextRef.current.resume().then(() => {
                        isAudioUnlockedRef.current = true;
                        console.log('🔊 AudioContext unlocked by user gesture');
                    });
                } else {
                    isAudioUnlockedRef.current = true;
                }
            } catch (e) {
                console.warn('Audio unlock failed:', e);
            }
        };

        // Any interactive event will unlock the audio
        document.addEventListener('click', unlockAudio, { once: false });
        document.addEventListener('keydown', unlockAudio, { once: false });
        document.addEventListener('touchstart', unlockAudio, { once: false });

        return () => {
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
            document.removeEventListener('touchstart', unlockAudio);
        };
    }, []);

    // ─── Fetch notification sound URL ────────────────────────────────────
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const cached = localStorage.getItem('appSettings');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed.notificationSoundUrl) setSoundUrl(parsed.notificationSoundUrl);
                }
                const res = await api.get('/settings');
                if (res.data?.notificationSoundUrl) {
                    setSoundUrl(res.data.notificationSoundUrl);
                }
            } catch (err) {
                console.warn('Failed to fetch sound settings:', err);
            }
        };
        fetchSettings();

        // Listen for mute toggles from Kasir.jsx header button
        const handleStorageChange = (e) => {
            if (e.key === 'pos_muted') {
                setIsMuted(e.newValue === 'true');
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // ─── Play Notification Sound ─────────────────────────────────────────
    const playNotificationSound = useCallback(async () => {
        // Rate-limit: don't overlap sounds within 2 seconds
        const now = Date.now();
        if (now - lastPlayedRef.current < 2000) return;
        lastPlayedRef.current = now;

        // Check mute state directly from storage (most reliable)
        if (localStorage.getItem('pos_muted') === 'true') return;

        // Strategy A: Play custom sound file if configured
        if (soundUrl) {
            try {
                const audio = new Audio(soundUrl);
                audio.volume = 0.8;
                await audio.play();
                return; // Success — stop here
            } catch (audioErr) {
                console.warn('Custom sound failed, using oscillator fallback:', audioErr.message);
            }
        }

        // Strategy B: Oscillator "Ding-Dong" fallback
        try {
            // Ensure AudioContext is initialized + resumed
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioContextRef.current;

            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            if (ctx.state !== 'running') {
                console.warn('AudioContext not running, cannot play sound. State:', ctx.state);
                return;
            }

            const now = ctx.currentTime;

            const playNote = (freq, startTime, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.15, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                osc.start(startTime);
                osc.stop(startTime + duration);
            };

            playNote(880, now, 0.4);         // High note (Ding)
            playNote(659.25, now + 0.4, 0.8); // Low note (Dong)

        } catch (e) {
            console.error('Audio playback failed:', e);
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
