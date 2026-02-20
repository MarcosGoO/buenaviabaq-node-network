# Alerts System Documentation

## Overview

The VíaBaq Alerts System provides real-time detection and notification of traffic, weather, and safety-related events affecting Barranquilla's urban mobility.

---

## Alert Types

### 1. Arroyo Flood Risk (`arroyo_flood_risk`)

Detects flooding risks in arroyo zones based on rainfall intensity.

**Logic:**
- Heavy rainfall (>5mm/h) + High-risk arroyo zone = **CRITICAL** alert
- Moderate rainfall (>0mm/h) + High-risk arroyo zone = **HIGH** alert

**Affected Zones:**
- Lists all high-risk arroyo zones affected

**Example Alert:**
```json
{
 "id": "arroyo-flood-1708000000000",
 "type": "arroyo_flood_risk",
 "severity": "critical",
 "title": "CRITICAL: High Flood Risk in Arroyo Zones",
 "description": "Heavy rainfall detected (8.5mm/h). 3 high-risk arroyo zone(s) affected. Avoid travel in these areas.",
 "affectedZones": [1, 3, 5],
 "timestamp": "2026-02-14T12:30:00.000Z",
 "expiresAt": "2026-02-14T14:30:00.000Z",
 "metadata": {
 "weatherCondition": "Rain",
 "rainfall": 8.5,
 "affectedArroyoCount": 3,
 "arroyoNames": "Arroyo Don Juan, Arroyo La Paz, Arroyo Santo Domingo"
 }
}
```

---

### 2. Severe Congestion (`severe_congestion`)

Detects severe traffic congestion on major roads.

**Logic:**
- Road congestion level = 'severe' → **HIGH** alert

**Affected Roads:**
- Lists all roads with severe congestion

**Example Alert:**
```json
{
 "id": "congestion-severe-1708000000000",
 "type": "severe_congestion",
 "severity": "high",
 "title": "Severe Traffic Congestion",
 "description": "3 road(s) experiencing severe congestion. Consider alternate routes.",
 "affectedZones": [],
 "affectedRoads": [101, 105, 108],
 "timestamp": "2026-02-14T17:00:00.000Z",
 "expiresAt": "2026-02-14T17:30:00.000Z",
 "metadata": {
 "congestionLevel": "severe",
 "affectedRoadCount": 3,
 "roadNames": "Vía 40, Autopista al Aeropuerto, Calle 72"
 }
}
```

---

### 3. Weather Traffic Impact (`weather_traffic_impact`)

Detects when weather conditions are affecting traffic flow.

**Logic:**
- Rain (>0mm/h) + High/Severe traffic congestion → **MEDIUM** alert

**Example Alert:**
```json
{
 "id": "weather-traffic-1708000000000",
 "type": "weather_traffic_impact",
 "severity": "medium",
 "title": "Weather Affecting Traffic",
 "description": "Rain is causing increased congestion on 5 major road(s). Drive carefully and expect delays.",
 "affectedZones": [],
 "affectedRoads": [101, 102, 105, 106, 108],
 "timestamp": "2026-02-14T12:00:00.000Z",
 "expiresAt": "2026-02-14T13:00:00.000Z",
 "metadata": {
 "weatherCondition": "Rain",
 "rainfall": 3.2,
 "affectedRoadCount": 5
 }
}
```

---

### 4. Event Traffic Impact (`event_traffic_impact`)

Detects when upcoming events are causing traffic impact.

**Logic:**
- Upcoming event (within 2 hours) + High traffic nearby → **MEDIUM** alert

**Example Alert:**
```json
{
 "id": "event-traffic-5-1708000000000",
 "type": "event_traffic_impact",
 "severity": "medium",
 "title": "Event Causing Traffic: Carnaval de Barranquilla 2026",
 "description": "Upcoming event \"Carnaval de Barranquilla 2026\" is affecting traffic. Plan alternative routes if traveling to this area.",
 "affectedZones": [],
 "timestamp": "2026-02-28T08:00:00.000Z",
 "expiresAt": "2026-03-03T23:00:00.000Z",
 "metadata": {
 "eventId": 5,
 "eventName": "Carnaval de Barranquilla 2026",
 "eventType": "festival",
 "eventStartDate": "2026-02-28T10:00:00.000Z"
 }
}
```

---

## Alert Severities

| Severity | Color | Description | Action Required |
|----------|-------|-------------|-----------------|
| `low` | 🟢 Green | Minor alert, informational | Awareness |
| `medium` | 🟡 Yellow | Moderate alert, plan accordingly | Adjust plans |
| `high` | 🟠 Orange | Important alert, avoid if possible | Seek alternatives |
| `critical` | Red | Critical alert, immediate action | Avoid area |

---

## REST API Endpoints

### Get All Active Alerts

```http
GET /api/v1/alerts/active
```

**Response:**
```json
{
 "success": true,
 "timestamp": "2026-02-14T12:30:00.000Z",
 "count": 2,
 "alerts": [
 {
 "id": "arroyo-flood-1708000000000",
 "type": "arroyo_flood_risk",
 "severity": "critical",
 ...
 },
 {
 "id": "weather-traffic-1708000000000",
 "type": "weather_traffic_impact",
 "severity": "medium",
 ...
 }
 ]
}
```

**Cache:** 2 minutes

---

### Get Alerts by Severity

```http
GET /api/v1/alerts/by-severity/:severity
```

**Parameters:**
- `severity`: `low`, `medium`, `high`, or `critical`

**Example:**
```http
GET /api/v1/alerts/by-severity/critical
```

**Response:**
```json
{
 "success": true,
 "timestamp": "2026-02-14T12:30:00.000Z",
 "severity": "critical",
 "count": 1,
 "alerts": [...]
}
```

---

### Get Alerts by Type

```http
GET /api/v1/alerts/by-type/:type
```

**Parameters:**
- `type`: `arroyo_flood_risk`, `severe_congestion`, `weather_traffic_impact`, `event_traffic_impact`

**Example:**
```http
GET /api/v1/alerts/by-type/arroyo_flood_risk
```

---

### Get Critical Alerts (Shortcut)

```http
GET /api/v1/alerts/critical
```

Equivalent to `/api/v1/alerts/by-severity/critical`

---

### Get Alerts Summary

```http
GET /api/v1/alerts/summary
```

**Response:**
```json
{
 "success": true,
 "timestamp": "2026-02-14T12:30:00.000Z",
 "summary": {
 "total": 5,
 "bySeverity": {
 "critical": 1,
 "high": 2,
 "medium": 2,
 "low": 0
 },
 "byType": {
 "arroyo_flood_risk": 1,
 "severe_congestion": 2,
 "weather_traffic_impact": 1,
 "event_traffic_impact": 1
 }
 }
}
```

---

## WebSocket Events

### Subscribe to Alerts

```javascript
socket.emit('subscribe:alerts');
```

### Receive Alert Notifications

```javascript
socket.on('alert:notification', (data) => {
 const alert = data.alert;

 if (alert.severity === 'critical') {
 // Show critical alert UI
 showCriticalAlert(alert);
 } else {
 // Show normal notification
 showNotification(alert);
 }
});
```

**Event Frequency:** Every 2 minutes (when alerts are detected)

---

## Alert Detection Logic

### Detection Flow

```
Every 2 minutes:
 1. Collect latest weather data
 2. Collect latest traffic data
 3. Collect upcoming events
 4. Run detection algorithms:
 - detectArroyoFloodRisk()
 - detectSevereCongestion()
 - detectWeatherTrafficImpact()
 - detectEventTrafficImpact()
 5. Filter expired alerts
 6. Cache results (2 min TTL)
 7. Emit via WebSocket to subscribers
```

### Arroyo Flood Detection Algorithm

```typescript
async function detectArroyoFloodRisk() {
 const weather = await getCurrentWeather();
 const arroyos = await getHighRiskArroyos();

 const rainIntensity = weather.rain?.['1h'] || 0;

 if (rainIntensity === 0) return [];

 if (rainIntensity > 5) {
 // Heavy rain + arroyos = CRITICAL
 return createAlert({
 severity: 'critical',
 expiresIn: 2 * 60 * 60 * 1000, // 2 hours
 affectedZones: arroyos.map(a => a.id)
 });
 } else {
 // Light/moderate rain + arroyos = HIGH
 return createAlert({
 severity: 'high',
 expiresIn: 1 * 60 * 60 * 1000, // 1 hour
 });
 }
}
```

---

## Frontend Integration

### React Component Example

```typescript
import { useEffect, useState } from 'react';
import { useVíaBaqSocket } from '@/hooks/useSocket';

export function AlertNotifications() {
 const { alerts } = useVíaBaqSocket();
 const [activeAlerts, setActiveAlerts] = useState([]);

 useEffect(() => {
 // Fetch initial alerts
 fetch('/api/v1/alerts/active')
 .then(res => res.json())
 .then(data => setActiveAlerts(data.alerts));
 }, []);

 useEffect(() => {
 // Add new alerts from WebSocket
 if (alerts.length > 0) {
 setActiveAlerts(prev => [...alerts, ...prev]);
 }
 }, [alerts]);

 return (
 <div className="alerts-container">
 {activeAlerts.map(alert => (
 <AlertCard
 key={alert.id}
 alert={alert}
 onDismiss={() => dismissAlert(alert.id)}
 />
 ))}
 </div>
 );
}
```

### Alert Card UI

```typescript
function AlertCard({ alert, onDismiss }) {
 const severityColors = {
 low: 'bg-green-100 border-green-500',
 medium: 'bg-yellow-100 border-yellow-500',
 high: 'bg-orange-100 border-orange-500',
 critical: 'bg-red-100 border-red-500',
 };

 return (
 <div className={`border-l-4 p-4 ${severityColors[alert.severity]}`}>
 <div className="flex justify-between">
 <h3 className="font-bold">{alert.title}</h3>
 <button onClick={onDismiss}>×</button>
 </div>
 <p className="text-sm mt-2">{alert.description}</p>
 <p className="text-xs text-gray-500 mt-2">
 Expires: {new Date(alert.expiresAt).toLocaleString()}
 </p>
 </div>
 );
}
```

---

## Background Jobs

### Alert Detection Job

```typescript
// Runs every 2 minutes
JobScheduler.scheduleAlertDetection();
```

**Job Details:**
- **Queue:** `data-collection`
- **Type:** `detect-alerts`
- **Priority:** 2 (High)
- **Frequency:** Every 2 minutes
- **Concurrency:** 1

**Job Flow:**
```
1. Detect all alerts (4 types)
2. Filter expired alerts
3. Invalidate alerts cache
4. Emit each alert via Socket.IO
5. Log results
```

---

## Performance & Caching

### Caching Strategy

- **Namespace:** `alerts`
- **TTL:** 120 seconds (2 minutes)
- **Keys:**
 - `alerts:active`
 - `alerts:critical`
 - `alerts:severity:{severity}`
 - `alerts:type:{type}`
 - `alerts:summary`

### Cache Invalidation

Cache is invalidated:
1. Every 2 minutes by alert detection job
2. When alert detection completes successfully

---

## Monitoring & Logging

### Log Levels

```typescript
logger.info('Alert detection complete: 3 active alerts');
logger.warn('Arroyo flood risk detected: severity critical');
logger.error('Alert detection failed:', error);
logger.debug('Emitted alert notification via Socket.IO');
```

### Metrics to Monitor

1. Number of active alerts
2. Alert detection job success rate
3. WebSocket subscribers count
4. API endpoint response times
5. Cache hit/miss ratio

---

## Testing

### Unit Tests

```typescript
describe('AlertService', () => {
 it('should detect arroyo flood risk with heavy rain', async () => {
 const alerts = await AlertService.detectArroyoFloodRisk();
 expect(alerts[0].severity).toBe('critical');
 });

 it('should filter expired alerts', () => {
 const expired = AlertService.getActiveAlerts(allAlerts);
 expect(expired.length).toBeLessThanOrEqual(allAlerts.length);
 });
});
```

### Integration Tests

```typescript
describe('Alerts API', () => {
 it('GET /api/v1/alerts/active should return active alerts', async () => {
 const response = await request(app).get('/api/v1/alerts/active');
 expect(response.status).toBe(200);
 expect(response.body.alerts).toBeDefined();
 });
});
```

---

## Future Enhancements

1. **SMS/Email Notifications:** Send alerts via SMS or email to subscribed users
2. **Geofencing:** Alert users only when they're near affected areas
3. **Historical Alerts:** Store alerts in database for analytics
4. **Alert Acknowledgment:** Allow users to acknowledge alerts
5. **Custom Alert Rules:** Let users define custom alert thresholds
6. **Push Notifications:** Mobile app push notifications via FCM

---

## Related Services

- **AlertService** (`server/src/services/alertService.ts`)
- **AlertsController** (`server/src/controllers/alertsController.ts`)
- **SocketService** (`server/src/lib/socket.ts`)
- **JobScheduler** (`server/src/jobs/scheduler.ts`)

---

**Last Updated:** 2026-02-14
**Version:** 1.0.0
