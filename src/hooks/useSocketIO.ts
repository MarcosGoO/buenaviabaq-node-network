"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

interface UseSocketIOReturn {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (channel: string, data?: unknown) => void;
  unsubscribe: (channel: string, data?: unknown) => void;
}

// Store socket instance outside component
let socketInstance: Socket | null = null;
let subscribers = 0;

const getSocket = () => socketInstance;

export function useSocketIO(): UseSocketIOReturn {
  const [isConnected, setIsConnected] = useState(false);

  // Use useSyncExternalStore to safely access socket
  const socket = useSyncExternalStore(
    () => {
      // Subscribe to socket changes
      subscribers++;
      return () => {
        subscribers--;
      };
    },
    getSocket,
    getSocket
  );

  useEffect(() => {
    // Create socket connection only once
    if (socketInstance) {
      setIsConnected(socketInstance.connected);
      return;
    }

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 10000,
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('✅ Socket.IO connected to', SOCKET_URL);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error.message);
      setIsConnected(false);
    });

    socketInstance = newSocket;

    // Cleanup only when no more subscribers
    return () => {
      if (subscribers === 0 && socketInstance) {
        console.log('🔌 Closing socket connection');
        socketInstance.disconnect();
        socketInstance = null;
      }
    };
  }, []);

  const subscribe = useCallback((channel: string, data?: unknown) => {
    if (!socketInstance) return;

    switch (channel) {
      case 'traffic':
        socketInstance.emit('subscribe:traffic');
        break;
      case 'weather':
        socketInstance.emit('subscribe:weather');
        break;
      case 'events':
        socketInstance.emit('subscribe:events');
        break;
      case 'alerts':
        socketInstance.emit('subscribe:alerts');
        break;
      case 'predictions':
        socketInstance.emit('subscribe:predictions');
        break;
      case 'zone':
        if (typeof data === 'number') {
          socketInstance.emit('subscribe:zone', data);
        }
        break;
      default:
        console.warn(`Unknown channel: ${channel}`);
    }
  }, []);

  const unsubscribe = useCallback((channel: string, data?: unknown) => {
    if (!socketInstance) return;

    switch (channel) {
      case 'traffic':
        socketInstance.emit('unsubscribe:traffic');
        break;
      case 'weather':
        socketInstance.emit('unsubscribe:weather');
        break;
      case 'events':
        socketInstance.emit('unsubscribe:events');
        break;
      case 'alerts':
        socketInstance.emit('unsubscribe:alerts');
        break;
      case 'predictions':
        socketInstance.emit('unsubscribe:predictions');
        break;
      case 'zone':
        if (typeof data === 'number') {
          socketInstance.emit('unsubscribe:zone', data);
        }
        break;
      default:
        console.warn(`Unknown channel: ${channel}`);
    }
  }, []);

  return {
    socket,
    isConnected,
    subscribe,
    unsubscribe,
  };
}
