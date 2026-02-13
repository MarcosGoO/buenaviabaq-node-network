"use client";

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

interface UseSocketIOReturn {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
}

export function useSocketIO(): UseSocketIOReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Create socket connection
    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Connection events
    socketInstance.on('connect', () => {
      console.log('✅ Socket.IO connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const subscribe = useCallback((channel: string) => {
    if (!socket) return;

    switch (channel) {
      case 'traffic':
        socket.emit('subscribe:traffic');
        break;
      case 'weather':
        socket.emit('subscribe:weather');
        break;
      case 'events':
        socket.emit('subscribe:events');
        break;
      default:
        console.warn(`Unknown channel: ${channel}`);
    }
  }, [socket]);

  const unsubscribe = useCallback((channel: string) => {
    if (!socket) return;

    switch (channel) {
      case 'traffic':
        socket.emit('unsubscribe:traffic');
        break;
      case 'weather':
        socket.emit('unsubscribe:weather');
        break;
      case 'events':
        socket.emit('unsubscribe:events');
        break;
      default:
        console.warn(`Unknown channel: ${channel}`);
    }
  }, [socket]);

  return {
    socket,
    isConnected,
    subscribe,
    unsubscribe,
  };
}