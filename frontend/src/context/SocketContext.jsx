import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        /**
         * SOCKET URL STRATEGY
         *
         * The backend runs at `api.superkafe.com`. However, that subdomain's
         * Nginx config does NOT have WebSocket upgrade headers, so connecting
         * directly to `api.superkafe.com/socket.io` fails with `Invalid frame header`.
         *
         * The FRONTEND nginx.conf (superkafe.com) DOES have a proper
         * `/socket.io/` proxy block that forwards to `backend:5001/socket.io/`
         * with the correct `Upgrade` and `Connection` headers.
         *
         * Solution: Always connect through the SAME ORIGIN as the webapp.
         * - In browser (HTTPS prod): `window.location.origin` = `https://superkafe.com`
         *   → Nginx proxies /socket.io/ → backend:5001 ✅
         * - In dev (localhost): `window.location.origin` = `http://localhost:5173`
         *   → Dev server doesn't proxy /socket.io, so fall back to direct localhost:5001
         */
        let socketUrl;

        if (typeof window !== 'undefined') {
            const origin = window.location.origin;
            const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

            if (isLocalhost) {
                // Dev: Connect directly to local backend
                socketUrl = 'http://localhost:5001';
            } else {
                // Prod: Connect through SAME origin (superkafe.com → Nginx → backend:5001)
                socketUrl = origin;
            }
        } else {
            socketUrl = 'http://localhost:5001';
        }

        console.log('🔌 Connecting to Socket.io at:', socketUrl);

        const newSocket = io(socketUrl, {
            withCredentials: true,
            // IMPORTANT: Always try polling first, then upgrade to WS.
            // This avoids WSS failures if the WebSocket upgrade is blocked anywhere.
            transports: ['polling', 'websocket'],
            reconnectionAttempts: Infinity,    // Keep trying indefinitely
            reconnectionDelay: 1000,           // Start with 1s delay
            reconnectionDelayMax: 10000,       // Cap at 10s delay (exponential backoff)
            path: '/socket.io/',
        });

        newSocket.on('connect', () => {
            console.log('⚡ Socket connected:', newSocket.id);

            // Auto-join tenant room for targeted events
            const tenantSlug = localStorage.getItem('tenant_slug');
            if (tenantSlug) {
                newSocket.emit('join:tenant', tenantSlug);
                console.log(`📎 Joining tenant room: ${tenantSlug}`);
            }
        });

        newSocket.on('reconnect', (attemptNumber) => {
            console.log(`🔄 Socket reconnected after ${attemptNumber} attempt(s)`);
            // Re-join tenant room on reconnect
            const tenantSlug = localStorage.getItem('tenant_slug');
            if (tenantSlug) {
                newSocket.emit('join:tenant', tenantSlug);
            }
        });

        newSocket.on('connect_error', (err) => {
            console.warn('⚠️ Socket connection error (will retry):', err.message, '| URL:', socketUrl);
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
