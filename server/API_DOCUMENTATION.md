# VíaBaq API Documentation

## Base URL
```
Development: http://localhost:4000/api/v1
Production: TBD
```

---

## Geo Endpoints

### Get All Zones
Returns all geographical zones in Barranquilla.

```http
GET /api/v1/geo/zones
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "Centro",
      "zone_type": "locality",
      "parent_id": null,
      "geometry": { "type": "MultiPolygon", "coordinates": [...] },
      "population": 45000,
      "area_km2": 2.5,
      "metadata": { "description": "Historic downtown area" },
      "created_at": "2026-02-09T...",
      "updated_at": "2026-02-09T..."
    }
  ],
  "timestamp": "2026-02-09T..."
}
```

---

### Get Zone by ID
Returns a specific zone by its ID.

```http
GET /api/v1/geo/zones/:id
```

**Parameters:**
- `id` (path, required) - Zone ID

**Example:**
```bash
curl http://localhost:4000/api/v1/geo/zones/1
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "Centro",
    ...
  },
  "timestamp": "2026-02-09T..."
}
```

**Error Response (404):**
```json
{
  "status": "error",
  "message": "Zone with ID 999 not found"
}
```

---

### Get Zones in Bounding Box
Returns zones within a map viewport.

```http
GET /api/v1/geo/zones/bounds?sw_lng=-75.25&sw_lat=10.15&ne_lng=-74.55&ne_lat=11.15
```

**Query Parameters:**
- `sw_lng` (required) - Southwest longitude
- `sw_lat` (required) - Southwest latitude
- `ne_lng` (required) - Northeast longitude
- `ne_lat` (required) - Northeast latitude

**Example:**
```bash
curl "http://localhost:4000/api/v1/geo/zones/bounds?sw_lng=-75.25&sw_lat=10.15&ne_lng=-74.55&ne_lat=11.15"
```

---

### Get Arroyo Zones (Flood-prone Areas)
Returns flood-prone areas with risk levels.

```http
GET /api/v1/geo/arroyos
GET /api/v1/geo/arroyos?risk_level=critical
```

**Query Parameters:**
- `risk_level` (optional) - Filter by risk: `low`, `medium`, `high`, `critical`

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "Arroyo Don Juan",
      "zone_id": 1,
      "geometry": { "type": "MultiPolygon", "coordinates": [...] },
      "risk_level": "critical",
      "drainage_capacity_m3": 1200.0,
      "last_incident_date": "2023-10-15T...",
      "avg_flood_depth_cm": 45.0,
      "metadata": {
        "historical_incidents": 15,
        "last_major_flood": "2023-10-15"
      },
      "created_at": "2026-02-09T...",
      "updated_at": "2026-02-09T..."
    }
  ],
  "timestamp": "2026-02-09T..."
}
```

---

### Get Roads
Returns road network data.

```http
GET /api/v1/geo/roads
GET /api/v1/geo/roads?type=highway
```

**Query Parameters:**
- `type` (optional) - Filter by road type: `highway`, `avenue`, `street`, `transversal`, `carrera`, `calle`

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "Vía 40 (Circunvalar)",
      "road_type": "highway",
      "geometry": { "type": "LineString", "coordinates": [...] },
      "lanes": 6,
      "max_speed_kmh": 80,
      "length_km": 8.5,
      "one_way": false,
      "metadata": {
        "importance": "high",
        "transmilenio_route": false
      },
      "created_at": "2026-02-09T...",
      "updated_at": "2026-02-09T..."
    }
  ],
  "timestamp": "2026-02-09T..."
}
```

---

### Get Points of Interest (POIs)
Returns POIs like hospitals, malls, stadiums, etc.

```http
GET /api/v1/geo/pois
GET /api/v1/geo/pois?category=hospital
```

**Query Parameters:**
- `category` (optional) - Filter by category: `hospital`, `school`, `mall`, `stadium`, `government`, `transport_hub`

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "Centro Comercial Buenavista",
      "category": "mall",
      "geometry": { "type": "Point", "coordinates": [-74.7950, 11.0050] },
      "zone_id": 2,
      "address": "Calle 98 con Carrera 53",
      "capacity": 5000,
      "metadata": {
        "parking_spots": 1200,
        "floors": 3
      },
      "created_at": "2026-02-09T...",
      "updated_at": "2026-02-09T..."
    }
  ],
  "timestamp": "2026-02-09T..."
}
```

---

## Health Check

### Server Health
Check server and database status.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-09T14:23:45.123Z",
  "uptime": 3625.45,
  "environment": "development",
  "database": "connected"
}
```

---

## ❌ Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Invalid zone ID"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Zone with ID 999 not found"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Internal server error"
}
```

---

## Common Query Examples

### Get all critical arroyo zones
```bash
curl "http://localhost:4000/api/v1/geo/arroyos?risk_level=critical"
```

### Get all highways
```bash
curl "http://localhost:4000/api/v1/geo/roads?type=highway"
```

### Get all hospitals
```bash
curl "http://localhost:4000/api/v1/geo/pois?category=hospital"
```

### Get zones in current map viewport
```bash
curl "http://localhost:4000/api/v1/geo/zones/bounds?sw_lng=-74.85&sw_lat=10.95&ne_lng=-74.75&ne_lat=11.05"
```

---

## Coming Soon (Sprint 2+)

### Traffic Endpoints
- `GET /api/v1/traffic/realtime` - Current traffic conditions
- `GET /api/v1/traffic/predictions` - ML-based predictions
- `GET /api/v1/traffic/segments/:id` - Specific segment data

### Weather Endpoints
- `GET /api/v1/weather/current` - Current weather
- `GET /api/v1/weather/forecast` - Weather forecast
- `GET /api/v1/weather/stations` - Weather stations

### Analytics Endpoints
- `GET /api/v1/analytics/insights` - Traffic insights
- `GET /api/v1/analytics/hotspots` - Congestion hotspots
- `GET /api/v1/analytics/summary` - Executive summary

---

## Rate Limiting

All endpoints are rate-limited:
- **Window:** 15 minutes
- **Max Requests:** 100 per IP

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## Authentication

Currently, all endpoints are public. Authentication will be added in future sprints if needed.

---

**Last Updated:** 2026-02-09
**API Version:** v1
**Status:** ✅ Sprint 1.3 Complete
