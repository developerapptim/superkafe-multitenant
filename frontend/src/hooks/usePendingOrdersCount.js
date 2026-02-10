import { useState, useEffect } from 'react';
import api from '../services/api';

export const usePendingOrdersCount = (interval = 10000) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const fetchCount = async () => {
            try {
                const { data } = await api.get('/orders/pending-count');
                setCount(data.count);
            } catch (error) {
                console.error('Error fetching pending orders:', error);
            }
        };

        fetchCount(); // Initial fetch
        const timer = setInterval(fetchCount, interval);

        return () => clearInterval(timer);
    }, [interval]);

    return count;
};
