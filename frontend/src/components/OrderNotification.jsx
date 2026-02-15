import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api'; // Import API for settings
import { useSocket } from '../context/SocketContext';

const OrderNotification = () => {
    const socket = useSocket();
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('pos_muted') === 'true');
    const [soundUrl, setSoundUrl] = useState(null); // Store sound URL
    const audioContextRef = useRef(null);

    // 1. Fetch Settings ONCE on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Try getting from localStorage first (fast)
                const cached = localStorage.getItem('appSettings');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed.notificationSoundUrl) setSoundUrl(parsed.notificationSoundUrl);
                }

                // Then fetch fresh data
                const res = await api.get('/settings');
                if (res.data?.notificationSoundUrl) {
                    setSoundUrl(res.data.notificationSoundUrl);
                    // Update local storage if needed, but AdminLayout handles main sync
                }
            } catch (err) {
                console.error('Failed to fetch sound settings:', err);
            }
        };
        fetchSettings();

        // Listen for Mute Toggles from other components
        const handleStorageChange = (e) => {
            if (e.key === 'pos_muted') {
                setIsMuted(e.newValue === 'true');
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // 2. Robust Play Sound Function
    const playNotificationSound = async () => {
        // Re-check mute state directly from storage to be 100% sure
        const currentMuteState = localStorage.getItem('pos_muted') === 'true';
        if (currentMuteState) return;

        try {
            // Initialize Context if missing
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioContextRef.current;

            // CRITICAL: Always resume suspended context
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            // Strategy A: Play Custom Sound URL
            if (soundUrl) {
                try {
                    const audio = new Audio(soundUrl);
                    await audio.play();
                    return; // Success
                } catch (audioErr) {
                    console.warn('Custom sound failed, falling back to beep:', audioErr);
                }
            }

            // Strategy B: Fallback Oscillator (Ding-Dong)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;

            // Ding
            osc.frequency.setValueAtTime(880, now); // A5
            gain.gain.setValueAtTime(0.1, now);

            // Dong
            osc.frequency.setValueAtTime(659.25, now + 0.4); // E5
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

            osc.type = 'sine';
            osc.start(now);
            osc.stop(now + 1.2);

        } catch (e) {
            console.error('Audio playback completely failed:', e);
            // Fallback: Visual Toast is already handled below
        }
    };

    // 3. Socket Listener
    useEffect(() => {
        if (!socket) return;

        const handleOrderUpdate = (data) => {
            if (data.action === 'create') {
                console.log('🔔 New Order Received!');

                // Play Sound
                playNotificationSound();

                // Show Toast
                toast('Pesanan Baru Masuk!', {
                    icon: '🔔',
                    duration: 5000,
                    position: 'top-right',
                    style: {
                        background: '#333',
                        color: '#fff',
                        border: '1px solid #a855f7'
                    }
                });
            }
        };

        socket.on('orders:update', handleOrderUpdate);

        return () => {
            socket.off('orders:update', handleOrderUpdate);
        };
    }, [socket, soundUrl]);

    return null; // Invisible component
};

export default OrderNotification;
