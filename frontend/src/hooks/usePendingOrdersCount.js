import { useState, useEffect } from 'react';
import api from '../services/api';
import { useSocket } from '../context/SocketContext'; // New: Import Socket

export const usePendingOrdersCount = () => {
    const [count, setCount] = useState(0);
    const socket = useSocket(); // New: Get Socket

    const fetchCount = async () => {
        try {
            const { data } = await api.get('/orders/pending-count');
            setCount(data.count);
        } catch (error) {
            console.error('Error fetching pending orders:', error);
        }
    };

    // Initial Fetch
    useEffect(() => {
        fetchCount();
    }, []);

    // Socket Listener
    useEffect(() => {
        if (!socket) return;

        const handleOrderUpdate = (data) => {
            console.log('⚡ Socket Event (Badge):', data);
            fetchCount(); // Refresh count on ANY order change
        };

        socket.on('orders:update', handleOrderUpdate);

        return () => {
            socket.off('orders:update', handleOrderUpdate);
        };
    }, [socket]);

    return count;
};
