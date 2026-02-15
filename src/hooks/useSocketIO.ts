"use client";

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

interface UseSocketIOReturn {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (channel: string, data?: unknown) => void;
  unsubscribe: (channel: string, data?: unknown) => void;
}

// Store socket instance and connection state outside component
let socketInstance: Socket | null = null;
let subscribers = 0;
let isConnectedState = false;

// Listeners for connection state changes
const connectionListeners = new Set<() => void>();

const getSocket = () => socketInstance;
const getConnectionState = () => isConnectedState;

const setConnectionState = (connected: boolean) => {
  if (isConnectedState !== connected) {
    isConnectedState = connected;
    connectionListeners.forEach(listener => listener());
  }
};

export function useSocketIO(): UseSocketIOReturn {
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

  // Use useSyncExternalStore for connection state
  const isConnected = useSyncExternalStore(
    (callback) => {
      connectionListeners.add(callback);
      return () => {
        connectionListeners.delete(callback);
      };
    },
    getConnectionState,
    getConnectionState
  );

  useEffect(() => {
    // Create socket connection only once
    if (socketInstance) {
      setConnectionState(socketInstance.connected);
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
      setConnectionState(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO disconnected:', reason);
      setConnectionState(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error.message);
      setConnectionState(false);
    });

    socketInstance = newSocket;

    // Cleanup only when no more subscribers
    return () => {
      if (subscribers === 0 && socketInstance) {
        console.log('🔌 Closing socket connection');
        socketInstance.disconnect();
        socketInstance = null;
        setConnectionState(false);
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
