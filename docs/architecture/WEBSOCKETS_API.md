# WebSockets API Documentation

## Overview

VíaBaq uses **Socket.IO** for real-time bidirectional communication between the server and clients. This enables instant updates for traffic, weather, alerts, and predictions without polling.

**Socket.IO Server URL:** `http://localhost:4000` (development) or your deployed URL

---

## Connection

### Basic Connection (JavaScript/TypeScript)

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
 transports: ['websocket', 'polling'], // WebSocket preferred, fallback to polling
 reconnection: true,
 reconnectionDelay: 1000,
 reconnectionAttempts: 5,
});

socket.on('connect', () => {
 console.log('Connected to VíaBaq real-time server');
 console.log('Socket ID:', socket.id);
});

socket.on('disconnect', (reason) => {
 console.log('Disconnected:', reason);
});
```

---

## Client Events (Emit)

Events that clients can **send** to the server to subscribe/unsubscribe.

### `subscribe:traffic`
Subscribe to real-time traffic updates.

```javascript
socket.emit('subscribe:traffic');
```

**Response:** None (subscription confirmed in logs)

---

### `subscribe:weather`
Subscribe to weather updates.

```javascript
socket.emit('subscribe:weather');
```

---

### `subscribe:events`
Subscribe to event notifications (urban events).

```javascript
socket.emit('subscribe:events');
```

---

### `subscribe:alerts`
Subscribe to real-time alert notifications.

```javascript
socket.emit('subscribe:alerts');
```

---

### `subscribe:predictions`
Subscribe to ML prediction updates.

```javascript
socket.emit('subscribe:predictions');
```

---

### `subscribe:zone`
Subscribe to updates for a specific geographic zone.

```javascript
const zoneId = 1; // Replace with actual zone ID
socket.emit('subscribe:zone', zoneId);
```

**Parameters:**
- `zoneId` (number): ID of the zone to subscribe to

---

### `unsubscribe:zone`
Unsubscribe from a specific zone.

```javascript
const zoneId = 1;
socket.emit('unsubscribe:zone', zoneId);
```

---

## Server Events (Listen)

Events that the server **emits** to subscribed clients.

### `traffic:update`
Emitted when traffic data is updated (every 5 minutes).

```javascript
socket.on('traffic:update', (data) => {
 console.log('Traffic update received:', data);

 // data structure:
 // {
 // timestamp: "2026-02-14T12:30:00.000Z",
 // data: {
 // roads: [...], // Array of road traffic data
 // summary: {...} // Traffic summary statistics
 // }
 // }
});
```

**Data Fields:**
- `timestamp` (string): ISO 8601 timestamp
- `data.roads` (array): Array of road objects with traffic information
- `data.summary` (object): Overall traffic summary

---

### `weather:update`
Emitted when weather data is updated (every 5 minutes).

```javascript
socket.on('weather:update', (data) => {
 console.log('Weather update:', data);

 // data structure:
 // {
 // timestamp: "2026-02-14T12:30:00.000Z",
 // data: {
 // temperature: 28.5,
 // feels_like: 32.1,
 // humidity: 75,
 // weather: [{main: "Rain", description: "light rain"}],
 // rain: {"1h": 2.5},
 // wind_speed: 15.2
 // }
 // }
});
```

---

### `alert:notification`
Emitted when a new alert is detected (every 2 minutes).

```javascript
socket.on('alert:notification', (data) => {
 console.log('Alert received:', data);

 // data structure:
 // {
 // timestamp: "2026-02-14T12:30:00.000Z",
 // alert: {
 // id: "arroyo-flood-1234567890",
 // type: "arroyo_flood_risk",
 // severity: "critical",
 // title: "CRITICAL: High Flood Risk in Arroyo Zones",
 // description: "Heavy rainfall detected...",
 // affectedZones: [1, 3, 5],
 // affectedRoads: [101, 102],
 // timestamp: "2026-02-14T12:30:00.000Z",
 // expiresAt: "2026-02-14T14:30:00.000Z",
 // metadata: {...}
 // }
 // }
});
```

**Alert Types:**
- `arroyo_flood_risk`: Flood risk in arroyo zones
- `severe_congestion`: Severe traffic congestion
- `weather_traffic_impact`: Weather affecting traffic
- `event_traffic_impact`: Event causing traffic impact

**Alert Severities:**
- `low`: Minor alert
- `medium`: Moderate alert
- `high`: Important alert
- `critical`: Critical alert (immediate attention required)

---

### `prediction:update`
Emitted when ML predictions are updated.

```javascript
socket.on('prediction:update', (data) => {
 console.log('Prediction update:', data);

 // data structure:
 // {
 // timestamp: "2026-02-14T12:30:00.000Z",
 // predictions: {
 // roads: [...], // Predictions for each road
 // confidence: 0.85
 // }
 // }
});
```

---

### `event:notification`
Emitted when a new urban event is created.

```javascript
socket.on('event:notification', (data) => {
 console.log('Event notification:', data);

 // data structure:
 // {
 // timestamp: "2026-02-14T12:30:00.000Z",
 // event: {
 // id: 1,
 // name: "Carnaval de Barranquilla 2026",
 // type: "festival",
 // start_date: "2026-02-28T10:00:00.000Z",
 // end_date: "2026-03-03T23:00:00.000Z",
 // location: {...}
 // }
 // }
});
```

---

### `zone:alert`
Emitted to clients subscribed to a specific zone when there's an alert for that zone.

```javascript
socket.on('zone:alert', (data) => {
 console.log('Zone-specific alert:', data);

 // data structure:
 // {
 // timestamp: "2026-02-14T12:30:00.000Z",
 // zoneId: 1,
 // alert: {...}
 // }
});
```

---

## Complete Example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

// Connection events
socket.on('connect', () => {
 console.log(' Connected to VíaBaq');

 // Subscribe to updates
 socket.emit('subscribe:traffic');
 socket.emit('subscribe:weather');
 socket.emit('subscribe:alerts');
 socket.emit('subscribe:predictions');
 socket.emit('subscribe:zone', 1); // Zone Norte
});

socket.on('disconnect', (reason) => {
 console.log(' Disconnected:', reason);
});

// Listen for updates
socket.on('traffic:update', (data) => {
 console.log(' Traffic update:', data.data.summary);
});

socket.on('weather:update', (data) => {
 console.log(' Weather:', data.data.temperature + '°C');
});

socket.on('alert:notification', (data) => {
 const alert = data.alert;

 // Show critical alerts prominently
 if (alert.severity === 'critical') {
 console.error(' CRITICAL ALERT:', alert.title);
 console.error(alert.description);
 } else {
 console.warn(' Alert:', alert.title);
 }
});

socket.on('prediction:update', (data) => {
 console.log(' Predictions updated:', data.predictions);
});

socket.on('zone:alert', (data) => {
 console.log(` Alert for Zone ${data.zoneId}:`, data.alert.title);
});
```

---

## React Hook Example

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useVíaBaqSocket() {
 const [socket, setSocket] = useState<Socket | null>(null);
 const [connected, setConnected] = useState(false);
 const [trafficData, setTrafficData] = useState(null);
 const [weatherData, setWeatherData] = useState(null);
 const [alerts, setAlerts] = useState<any[]>([]);

 useEffect(() => {
 const socketInstance = io('http://localhost:4000');

 socketInstance.on('connect', () => {
 setConnected(true);

 // Auto-subscribe
 socketInstance.emit('subscribe:traffic');
 socketInstance.emit('subscribe:weather');
 socketInstance.emit('subscribe:alerts');
 });

 socketInstance.on('disconnect', () => {
 setConnected(false);
 });

 socketInstance.on('traffic:update', (data) => {
 setTrafficData(data.data);
 });

 socketInstance.on('weather:update', (data) => {
 setWeatherData(data.data);
 });

 socketInstance.on('alert:notification', (data) => {
 setAlerts((prev) => [data.alert, ...prev]);
 });

 setSocket(socketInstance);

 return () => {
 socketInstance.disconnect();
 };
 }, []);

 return {
 socket,
 connected,
 trafficData,
 weatherData,
 alerts,
 };
}
```

---

## Connection Management

### Reconnection Strategy

Socket.IO automatically handles reconnection with exponential backoff:

```javascript
const socket = io('http://localhost:4000', {
 reconnection: true,
 reconnectionDelay: 1000, // Start with 1 second
 reconnectionDelayMax: 5000, // Max 5 seconds
 reconnectionAttempts: Infinity, // Keep trying
});
```

### Heartbeat / Ping-Pong

Socket.IO automatically sends ping/pong frames to keep connection alive. No manual action needed.

---

## Error Handling

```javascript
socket.on('connect_error', (error) => {
 console.error('Connection error:', error.message);
});

socket.on('error', (error) => {
 console.error('Socket error:', error);
});
```

---

## Performance Considerations

1. **Selective Subscription**: Only subscribe to channels you need
2. **Unsubscribe on Unmount**: Clean up subscriptions when component unmounts
3. **Throttle UI Updates**: Don't re-render on every update if not needed
4. **Use Redis Adapter**: Server uses Redis adapter for horizontal scaling

---

## Testing WebSockets

### Using Socket.IO Client (CLI)

```bash
npm install -g socket.io-client-cli

# Connect to server
socket-io-client-cli http://localhost:4000

# In the CLI:
> emit subscribe:traffic
> on traffic:update
```

### Using Postman

1. Create new WebSocket request
2. Connect to `ws://localhost:4000`
3. Send messages in Socket.IO format

---

## Security

- **CORS**: Configured to accept connections from frontend URL
- **Rate Limiting**: Built-in Socket.IO connection limits
- **Authentication**: Can be added via middleware if needed

Example with authentication:

```javascript
// Server-side middleware (future enhancement)
io.use((socket, next) => {
 const token = socket.handshake.auth.token;
 // Validate token
 next();
});

// Client-side
const socket = io('http://localhost:4000', {
 auth: {
 token: 'your-jwt-token'
 }
});
```

---

## Production Considerations

1. **Use WSS (WebSocket Secure)** for HTTPS sites
2. **Enable Redis Adapter** for multi-instance deployments
3. **Monitor Connection Count** to prevent resource exhaustion
4. **Set Max Connections** per user/IP
5. **Use Sticky Sessions** if load balancing

---

## Troubleshooting

### Client Can't Connect

1. Check if backend is running: `curl http://localhost:4000/health`
2. Verify CORS settings in `server/src/index.ts`
3. Check firewall/network restrictions

### Updates Not Received

1. Verify subscription: Check server logs for `Client subscribed to...`
2. Ensure background jobs are running (data collection every 5 min)
3. Check Redis connection

### High Latency

1. Check network conditions
2. Verify Redis performance
3. Monitor server CPU/memory
4. Consider using CDN for Socket.IO client

---

## Related Documentation

- [REST API Documentation](./API_DOCUMENTATION.md)
- [Alerts System](./ALERTS_SYSTEM.md)
- [ML Predictions](./ML_FEATURE_STORE.md)

---

**Last Updated:** 2026-02-14
**Version:** 1.0.0
