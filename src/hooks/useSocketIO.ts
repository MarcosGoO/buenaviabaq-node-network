"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

interface UseSocketIOReturn {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
}

export function useSocketIO(): UseSocketIOReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Create socket connection only if it doesn't exist
    if (socketRef.current) return;

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

    socketRef.current = socketInstance;

    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribe = useCallback((channel: string) => {
    if (!socketRef.current) return;

    switch (channel) {
      case 'traffic':
        socketRef.current.emit('subscribe:traffic');
        break;
      case 'weather':
        socketRef.current.emit('subscribe:weather');
        break;
      case 'events':
        socketRef.current.emit('subscribe:events');
        break;
      default:
        console.warn(`Unknown channel: ${channel}`);
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    if (!socketRef.current) return;

    switch (channel) {
      case 'traffic':
        socketRef.current.emit('unsubscribe:traffic');
        break;
      case 'weather':
        socketRef.current.emit('unsubscribe:weather');
        break;
      case 'events':
        socketRef.current.emit('unsubscribe:events');
        break;
      default:
        console.warn(`Unknown channel: ${channel}`);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    subscribe,
    unsubscribe,
  };
}
