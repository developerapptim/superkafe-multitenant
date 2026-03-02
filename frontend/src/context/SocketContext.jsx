import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../services/api';

const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        // Get API URL from environment
        const apiUrl = API_BASE_URL || 'http://localhost:5001/api';

        // Remove /api suffix to get base URL for socket connection
        const baseUrl = apiUrl.replace('/api', '');

        // Determine socket URL based on environment
        let socketUrl;

        // Check if baseUrl is using an IP address or localhost
        const isLocalOrIP = baseUrl.includes('localhost') || baseUrl.match(/\d+\.\d+\.\d+\.\d+/);

        if ((import.meta.env.PROD && !isLocalOrIP) || window.location.protocol === 'https:') {
            // Production: Use HTTPS without port
            // Example: https://superkafe.com
            socketUrl = baseUrl.replace('http:', 'https:');

            // Remove port if present (e.g., :5001)
            socketUrl = socketUrl.replace(/:\d+/, '');
        } else {
            // Development or Direct IP: Use HTTP with port
            socketUrl = baseUrl;
        }

        console.log('🔌 Connecting to Socket.io at:', socketUrl);

        const newSocket = io(socketUrl, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            path: '/socket.io/', // Default path
            secure: socketUrl.startsWith('https:') // Use secure connection for HTTPS
        });

        newSocket.on('connect', () => {
            console.log('⚡ Socket connected:', newSocket.id);
        });

        newSocket.on('connect_error', (err) => {
            console.error('❌ Socket connection error:', err.message);
            console.error('   Attempted URL:', socketUrl);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
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
