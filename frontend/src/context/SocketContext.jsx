import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        // Use Vite Env for URL or fallback to window.location logic
        // In dev: localhost:5001. In prod: relative or specific URL.
        const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

        // Remove /api if present in VITE_API_URL because socket connects to root
        // Example: http://localhost:5001/api -> http://localhost:5001
        const baseUrl = socketUrl.replace('/api', '');

        console.log('🔌 Connecting to Socket.io at:', baseUrl);

        const newSocket = io(baseUrl, {
            withCredentials: true,
            transports: ['websocket', 'polling'], // Drivers
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        newSocket.on('connect', () => {
            console.log('⚡ Socket connected:', newSocket.id);
        });

        newSocket.on('connect_error', (err) => {
            console.error('❌ Socket connection error:', err);
        });

        setSocket(newSocket);

        return () => {
            console.log('🔌 Disconnecting Socket...');
            newSocket.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
