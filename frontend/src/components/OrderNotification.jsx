import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import api from '../services/api';

const fetcher = url => api.get(url).then(res => res.data);

const OrderNotification = () => {
    // Poll for new orders every 10 seconds (less frequent than Kasir to reduce load)
    // Or keep it 5s if realtime matters. Let's do 5s to match Kasir speed.
    const { data: ordersData } = useSWR('/orders?status=new&limit=50', fetcher, {
        refreshInterval: 5000,
        revalidateOnFocus: false // Don't revalidate on focus to avoid double triggers
    });

    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('pos_muted') === 'true');
    const prevNewOrdersCount = useRef(0);
    const audioContextRef = useRef(null);
    const hasInitialized = useRef(false);

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

            // Second note (Lower) - Optional, let's keep it simple 'Ding'
            // osc.frequency.setValueAtTime(587.33, now + 0.5); // D5
            // gain.gain.setValueAtTime(0.1, now + 0.5);
            // gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

            osc.type = 'sine';
            osc.start(now);
            osc.stop(now + 0.6);

        } catch (e) {
            console.error('Audio playback failed:', e);
        }
    };

    // Check for new orders
    useEffect(() => {
        if (!ordersData) return;

        const orders = Array.isArray(ordersData?.data) ? ordersData.data : (Array.isArray(ordersData) ? ordersData : []);
        // Strict filter: only actual 'new' orders
        const currentNewOrdersCount = orders.filter(o => o.status === 'new').length;

        // On first load, just sync count, don't play sound (unless we want to alert on refresh?)
        // Usually better to alert only on INCREASE
        if (!hasInitialized.current) {
            prevNewOrdersCount.current = currentNewOrdersCount;
            hasInitialized.current = true;
            return;
        }

        // Play sound if count INCREASED
        if (currentNewOrdersCount > prevNewOrdersCount.current) {
            console.log('🔔 New Order Detected! Playing sound...');
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

        prevNewOrdersCount.current = currentNewOrdersCount;
    }, [ordersData, isMuted]);

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
