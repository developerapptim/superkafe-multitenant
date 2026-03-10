import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';

export const usePendingOrdersCount = () => {
    const [count, setCount] = useState(0);
    const socket = useSocket();
    const intervalRef = useRef(null);

    const fetchCount = useCallback(async () => {
        try {
            const { data } = await api.get('/orders/pending-count');
            setCount(data.count ?? 0);
        } catch (error) {
            // Silently fail — count stays at last known value
            console.warn('[PendingCount] Failed to fetch:', error.message);
        }
    }, []);

    // Initial fetch on mount
    useEffect(() => {
        fetchCount();
    }, [fetchCount]);

    // Polling fallback — runs every 10s regardless of socket status.
    // This acts as a "catch-all" in case socket events are missed.
    useEffect(() => {
        intervalRef.current = setInterval(fetchCount, 10_000);
        return () => clearInterval(intervalRef.current);
    }, [fetchCount]);

    // Socket event listener
    useEffect(() => {
        if (!socket) return;

        const handleOrderUpdate = (data) => {
            console.log('⚡ Socket Event (Badge):', data);
            // Fetch fresh count on ANY order change to stay accurate
            fetchCount();
        };

        socket.on('orders:update', handleOrderUpdate);

        // Re-fetch on reconnect to sync any missed events
        socket.on('connect', fetchCount);

        return () => {
            socket.off('orders:update', handleOrderUpdate);
            socket.off('connect', fetchCount);
        };
    }, [socket, fetchCount]);

    return count;
};
