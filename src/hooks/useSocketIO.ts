"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import { io, Socket } from "socket.io-client"

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000"
const SOCKET_AUTH_TOKEN = process.env.NEXT_PUBLIC_SOCKET_AUTH_TOKEN?.trim() || ""
const IS_DEV = process.env.NODE_ENV !== "production"

type SubscriptionChannel =
  | "traffic"
  | "weather"
  | "events"
  | "alerts"
  | "predictions"
  | "ml-reliability"
  | "zone"

const CHANNEL_EVENT_MAP: Record<
  Exclude<SubscriptionChannel, "zone">,
  { subscribe: string; unsubscribe: string }
> = {
  traffic: { subscribe: "subscribe:traffic", unsubscribe: "unsubscribe:traffic" },
  weather: { subscribe: "subscribe:weather", unsubscribe: "unsubscribe:weather" },
  events: { subscribe: "subscribe:events", unsubscribe: "unsubscribe:events" },
  alerts: { subscribe: "subscribe:alerts", unsubscribe: "unsubscribe:alerts" },
  predictions: { subscribe: "subscribe:predictions", unsubscribe: "unsubscribe:predictions" },
  "ml-reliability": {
    subscribe: "subscribe:ml-reliability",
    unsubscribe: "unsubscribe:ml-reliability",
  },
}

interface UseSocketIOReturn {
  socket: Socket | null
  isConnected: boolean
  subscribe: (channel: SubscriptionChannel, data?: unknown) => void
  unsubscribe: (channel: SubscriptionChannel, data?: unknown) => void
}

let socketInstance: Socket | null = null
let subscribers = 0
let isConnectedState = false

const connectionListeners = new Set<() => void>()
const activeSubscriptions = new Map<string, number>()

const getSocket = () => socketInstance
const getConnectionState = () => isConnectedState

const setConnectionState = (connected: boolean) => {
  if (isConnectedState !== connected) {
    isConnectedState = connected
    connectionListeners.forEach((listener) => listener())
  }
}

const debugLog = (...args: unknown[]) => {
  if (IS_DEV) {
    console.log(...args)
  }
}

const warnLog = (...args: unknown[]) => {
  if (IS_DEV) {
    console.warn(...args)
  }
}

const errorLog = (...args: unknown[]) => {
  if (IS_DEV) {
    console.error(...args)
  }
}

const emitManagedSubscription = (
  channel: SubscriptionChannel,
  action: "subscribe" | "unsubscribe",
  data?: unknown
) => {
  if (!socketInstance) return

  if (channel === "zone") {
    if (typeof data !== "number") {
      warnLog(`Zone subscription ignored because no numeric zone id was provided for ${action}.`)
      return
    }

    const key = `zone:${data}`
    const current = activeSubscriptions.get(key) ?? 0

    if (action === "subscribe") {
      activeSubscriptions.set(key, current + 1)
      if (current === 0) {
        socketInstance.emit("subscribe:zone", data)
      }
      return
    }

    if (current <= 1) {
      activeSubscriptions.delete(key)
      socketInstance.emit("unsubscribe:zone", data)
      return
    }

    activeSubscriptions.set(key, current - 1)
    return
  }

  const eventPair = CHANNEL_EVENT_MAP[channel]
  const current = activeSubscriptions.get(channel) ?? 0

  if (action === "subscribe") {
    activeSubscriptions.set(channel, current + 1)
    if (current === 0) {
      socketInstance.emit(eventPair.subscribe)
    }
    return
  }

  if (current <= 1) {
    activeSubscriptions.delete(channel)
    socketInstance.emit(eventPair.unsubscribe)
    return
  }

  activeSubscriptions.set(channel, current - 1)
}

export function useSocketIO(): UseSocketIOReturn {
  const socket = useSyncExternalStore(
    () => {
      subscribers++
      return () => {
        subscribers--
      }
    },
    getSocket,
    getSocket
  )

  const isConnected = useSyncExternalStore(
    (callback) => {
      connectionListeners.add(callback)
      return () => {
        connectionListeners.delete(callback)
      }
    },
    getConnectionState,
    getConnectionState
  )

  useEffect(() => {
    if (socketInstance) {
      setConnectionState(socketInstance.connected)
      return
    }

    const newSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: SOCKET_AUTH_TOKEN ? { token: SOCKET_AUTH_TOKEN } : undefined,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 10000,
    })

    newSocket.on("connect", () => {
      debugLog("Socket.IO connected to", SOCKET_URL)
      setConnectionState(true)
    })

    newSocket.on("disconnect", (reason) => {
      debugLog("Socket.IO disconnected:", reason)
      setConnectionState(false)
    })

    newSocket.on("connect_error", (error) => {
      errorLog("Socket.IO connection error:", error.message)
      setConnectionState(false)
    })

    socketInstance = newSocket

    return () => {
      if (subscribers === 0 && socketInstance) {
        debugLog("Closing socket connection")
        activeSubscriptions.clear()
        socketInstance.disconnect()
        socketInstance = null
        setConnectionState(false)
      }
    }
  }, [])

  const subscribe = useCallback((channel: SubscriptionChannel, data?: unknown) => {
    emitManagedSubscription(channel, "subscribe", data)
  }, [])

  const unsubscribe = useCallback((channel: SubscriptionChannel, data?: unknown) => {
    emitManagedSubscription(channel, "unsubscribe", data)
  }, [])

  return {
    socket,
    isConnected,
    subscribe,
    unsubscribe,
  }
}
