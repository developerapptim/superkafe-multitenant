import { useState, useEffect, useRef } from 'react';
// import useSWR from 'swr'; // Removed Polling
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext'; // New: Import Socket

const OrderNotification = () => {
    const socket = useSocket(); // New: Get Socket
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('pos_muted') === 'true');
    const audioContextRef = useRef(null);

    // Initialize Audio Context on user interaction
    useEffect(() => {
        const unlockAudio = () => {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }
        };

        // Add listeners to unlock audio
        window.addEventListener('click', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);
        window.addEventListener('keydown', unlockAudio);

        return () => {
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
    }, []);

    // Play Sound Function
    const playSound = async () => {
        if (isMuted) return;

        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioContextRef.current;

            // Resume if needed
            if (ctx.state === 'suspended') await ctx.resume();

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            // Notification Sound (Ding-Dong style)
            const now = ctx.currentTime;

            // First note (High)
            osc.frequency.setValueAtTime(880, now); // A5
            gain.gain.setValueAtTime(0.1, now);

            // Drop volume
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

            osc.type = 'sine';
            osc.start(now);
            osc.stop(now + 0.6);

        } catch (e) {
            console.error('Audio playback failed:', e);
        }
    };

    // Socket Listener for New Orders
    useEffect(() => {
        if (!socket) return;

        const handleOrderUpdate = (data) => {
            // Only play sound for NEW orders
            if (data.action === 'create') {
                console.log('🔔 New Order Socket Event! Playing sound...');
                playSound();
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
    }, [socket, isMuted]);

    // Handle mute toggle via custom event or check localStorage periodically
    // For now, simpler: Just check localStorage every poll or expose a toggle in UI?
    // Since mute toggle is in Kasir, we should probably listen to storage event
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'pos_muted') {
                setIsMuted(e.newValue === 'true');
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    return null; // Invisible component
};

export default OrderNotification;
