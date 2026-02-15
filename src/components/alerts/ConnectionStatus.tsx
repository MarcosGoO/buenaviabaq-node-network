"use client";

import { useSocketIO } from '@/hooks/useSocketIO';
import { Wifi, WifiOff } from 'lucide-react';

interface ConnectionStatusProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
}

export function ConnectionStatus({
  position = 'bottom-left',
  compact = false
}: ConnectionStatusProps) {
  const { isConnected } = useSocketIO();

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
      className={`fixed ${getPositionStyles()} z-40 transition-all duration-300`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg shadow-md
          ${isConnected
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
          }
          ${compact ? 'text-xs' : 'text-sm'}
        `}
      >
        <div className="flex-shrink-0">
          {isConnected ? (
            <Wifi className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          ) : (
            <WifiOff className={compact ? 'w-3 h-3 animate-pulse' : 'w-4 h-4 animate-pulse'} />
          )}
        </div>

        {!compact && (
          <div className="flex items-center gap-2">
            <div
              className={`
                w-2 h-2 rounded-full
                ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}
              `}
            />
            <span className="font-medium">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
