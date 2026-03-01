import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL ||
    (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');

/**
 * Custom hook for Socket.IO connection management
 * @returns {Object} Socket state and handlers
 */
export const useSocket = () => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
    const tenant = localStorage.getItem('current_tenant');
    const tenantSlug = tenant ? JSON.parse(tenant).slug : null;

    useEffect(() => {
        if (!token || !tenantSlug) return;

        const socketInstance = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            auth: {
                token: token,
                tenantSlug: tenantSlug
            },
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            pingInterval: 25000,
            pingTimeout: 10000,
        });

        socketInstance.on('connect', () => {
            console.log('🟢 Connected to Socket.IO');
            setIsConnected(true);
        });

        socketInstance.on('disconnect', (reason) => {
            console.log('🔴 Disconnected from Socket.IO. Reason:', reason);
            setIsConnected(false);
            if (reason === 'io server disconnect') {
                socketInstance.connect();
            }
        });

        socketInstance.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error.message);
            setIsConnected(false);
        });

        socketInstance.on('reconnect', () => {
            console.log('🔄 Socket reconnected');
            setIsConnected(true);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, [token, tenantSlug]);

    const emit = useCallback((event, data) => {
        if (socket && isConnected) {
            socket.emit(event, data);
        }
    }, [socket, isConnected]);

    const on = useCallback((event, callback) => {
        if (socket) {
            socket.on(event, callback);
            return () => socket.off(event, callback);
        }
        return () => { };
    }, [socket]);

    return {
        socket,
        isConnected,
        emit,
        on
    };
};

export default useSocket;
