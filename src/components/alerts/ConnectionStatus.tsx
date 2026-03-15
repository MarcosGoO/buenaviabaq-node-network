"use client";

import { useSocketIO } from '@/hooks/useSocketIO';
import { WifiOff } from 'lucide-react';

interface ConnectionStatusProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function ConnectionStatus({
  position = 'bottom-left'
}: ConnectionStatusProps) {
  const { isConnected } = useSocketIO();

  // Solo mostrar cuando estÃ¡ desconectado
  if (isConnected) {
    return null;
  }

  const getPositionStyles = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      default:
        return 'bottom-4 left-4';
    }
  };

  return (
    <div
      className={`fixed ${getPositionStyles()} z-[9998] transition-all duration-300`}
      role="status"
      aria-live="polite"
      suppressHydrationWarning
    >
      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-destructive/10 px-4 py-2 text-red-700 shadow-sm dark:text-red-300" suppressHydrationWarning>
        <WifiOff className="w-4 h-4 animate-pulse" />
        <div className="flex items-center gap-2" suppressHydrationWarning>
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" suppressHydrationWarning />
          <span className="font-medium text-sm">Reconectando...</span>
        </div>
      </div>
    </div>
  );
}

