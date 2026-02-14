# ML Feature Store - Documentation

## Overview

The ML Feature Store is a comprehensive system for extracting, storing, and serving features for machine learning models focused on traffic prediction in Barranquilla.

---

## Feature Categories

### 1. Temporal Features
Time-based features that capture patterns in traffic behavior:

| Feature | Type | Range | Description |
|---------|------|-------|-------------|
| `hour_of_day` | Integer | 0-23 | Hour of the day (24-hour format) |
| `day_of_week` | Integer | 0-6 | Day of week (0=Sunday, 6=Saturday) |
| `day_of_month` | Integer | 1-31 | Day of the month |
| `month` | Integer | 1-12 | Month of the year |
| `is_rush_hour` | Boolean | 0/1 | True if weekday 6-9am or 5-8pm |
| `is_weekend` | Boolean | 0/1 | True if Saturday or Sunday |

### 2. Historical Traffic Features
Aggregated statistics from past traffic data:

| Feature | Type | Description |
|---------|------|-------------|
| `avg_speed_historical` | Float | Average speed for this road at similar time (last 30 days) |
| `avg_congestion_level_encoded` | Float | Average congestion level (0=low, 0.33=moderate, 0.66=high, 1=severe) |
| `traffic_std_deviation` | Float | Standard deviation of speed (volatility indicator) |

### 3. Weather Features
Current weather conditions affecting traffic:

| Feature | Type | Range | Description |
|---------|------|-------|-------------|
| `temperature` | Float | 20-40°C | Current temperature in Barranquilla |
| `humidity` | Float | 0-100% | Humidity percentage |
| `wind_speed` | Float | 0-60 km/h | Wind speed |
| `rain_probability` | Float | 0-100% | Probability of rain |
| `weather_condition_encoded` | Integer | 0-5 | Encoded weather condition (see encoding table) |
| `is_raining` | Boolean | 0/1 | True if rain_probability > 50% |

**Weather Condition Encoding:**
- 0: Clear
- 1: Clouds
- 2: Rain
- 3: Drizzle
- 4: Thunderstorm
- 5: Mist/Fog/Haze

### 4. Event Features
Proximity to events affecting traffic:

| Feature | Type | Description |
|---------|------|-------------|
| `event_nearby` | Boolean | True if event within 5km |
| `event_type_encoded` | Integer | Type of event (see encoding table) |
| `event_distance_km` | Float | Distance to nearest event |

**Event Type Encoding:**
- 0: None
- 1: Concert
- 2: Festival
- 3: Sports
- 4: Maintenance
- 5: Parade
- 6: Protest
- 7: Accident

### 5. Geographic Features
Road characteristics:

| Feature | Type | Description |
|---------|------|-------------|
| `zone_id` | Integer | Geographic zone ID |
| `road_type_encoded` | Integer | Type of road (see encoding table) |
| `lanes` | Integer | Number of lanes |
| `max_speed_kmh` | Integer | Speed limit |

**Road Type Encoding:**
- 0: Highway/Autopista
- 1: Avenue/Avenida/Carrera
- 2: Street/Calle
- 3: Transversal
- 4: Diagonal

### 6. Arroyo Risk Features
Proximity to flood-prone areas:

| Feature | Type | Description |
|---------|------|-------------|
| `arroyo_nearby` | Boolean | True if arroyo within 2km |
| `arroyo_risk_level_encoded` | Float | Risk level (0=none, 0.25=low, 0.5=medium, 0.75=high, 1=critical) |
| `arroyo_distance_km` | Float | Distance to nearest arroyo |

### 7. Target Variables (for Training)

| Feature | Type | Description |
|---------|------|-------------|
| `target_speed_kmh` | Integer | Actual speed (ground truth) |
| `target_congestion_level` | String | Actual congestion level |

---

## 🔌 API Endpoints

Base URL: `http://localhost:4000/api/v1/ml`

### 1. Extract Features for a Road

**Endpoint:** `POST /ml/features/extract`

Extract features for a specific road at a given timestamp without storing them.

**Request Body:**
```json
{
  "road_id": 1,
  "timestamp": "2026-02-14T10:00:00Z"  // optional, defaults to now
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "road_id": 1,
    "timestamp": "2026-02-14T10:00:00Z",
    "features": {
      "temporal": {
        "hour_of_day": 10,
        "day_of_week": 6,
        "day_of_month": 14,
        "month": 2,
        "is_rush_hour": false,
        "is_weekend": true
      },
      "traffic": {
        "avg_speed_historical": 55.5,
        "avg_congestion_encoded": 0.14,
        "std_deviation": 10.5
      },
      "weather": { /* ... */ },
      "events": { /* ... */ },
      "geography": { /* ... */ },
      "arroyo": { /* ... */ }
    }
  },
  "timestamp": "2026-02-14T10:00:05Z"
}
```

### 2. Store Features with Target Values

**Endpoint:** `POST /ml/features/store`

Extract and store features for training purposes.

**Request Body:**
```json
{
  "road_id": 1,
  "timestamp": "2026-02-14T10:00:00Z",  // optional
  "target_speed": 45,                    // optional - actual speed
  "target_congestion": "moderate"        // optional - actual congestion
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Features stored successfully",
  "data": {
    "road_id": 1,
    "timestamp": "2026-02-14T10:00:00Z"
  },
  "timestamp": "2026-02-14T10:00:05Z"
}
```

### 3. Get Stored Features

**Endpoint:** `GET /ml/features`

Retrieve stored features for training or evaluation.

**Query Parameters:**
- `road_id` (optional): Filter by road ID
- `start_time` (optional): Start timestamp (ISO 8601)
- `end_time` (optional): End timestamp (ISO 8601)
- `limit` (optional): Max records to return (default: 1000, max: 10000)

**Example:**
```bash
GET /ml/features?road_id=1&limit=100
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "count": 100,
    "features": [
      {
        "id": 1,
        "road_id": 1,
        "timestamp": "2026-02-14T10:00:00Z",
        "hour_of_day": 10,
        "day_of_week": 6,
        /* all features */,
        "target_speed_kmh": 45,
        "target_congestion_level": "moderate",
        "created_at": "2026-02-14T10:00:05Z"
      }
    ]
  },
  "timestamp": "2026-02-14T10:00:10Z"
}
```

### 4. Get Feature Statistics

**Endpoint:** `GET /ml/features/stats`

Get aggregated statistics about the feature store.

**Response:**
```json
{
  "status": "success",
  "data": {
    "total_records": 1500,
    "unique_roads": 6,
    "earliest_record": "2026-02-01T00:00:00Z",
    "latest_record": "2026-02-14T10:00:00Z",
    "labeled_records": 1200,
    "labeling_percentage": "80.00",
    "avg_speed": "52.34",
    "rainy_records": 150,
    "event_records": 80,
    "arroyo_records": 450
  },
  "timestamp": "2026-02-14T10:00:10Z"
}
```

### 5. Batch Extract Features

**Endpoint:** `POST /ml/features/batch`

Extract and store features for ALL roads at once (async operation).

**Request Body:**
```json
{
  "timestamp": "2026-02-14T10:00:00Z"  // optional, defaults to now
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Batch feature extraction started",
  "data": {
    "timestamp": "2026-02-14T10:00:00Z"
  },
  "timestamp": "2026-02-14T10:00:05Z"
}
```

---

## Usage Examples

### Example 1: Training Data Collection

Collect labeled training data every 5 minutes:

```bash
# Automated job (runs every 5 minutes)
curl -X POST http://localhost:4000/api/v1/ml/features/batch
```

### Example 2: Real-time Prediction Input

Extract features for prediction without storing:

```bash
curl -X POST http://localhost:4000/api/v1/ml/features/extract \
  -H "Content-Type: application/json" \
  -d '{"road_id": 1}'
```

### Example 3: Export Training Dataset

Export all labeled data for model training:

```bash
curl "http://localhost:4000/api/v1/ml/features?limit=10000" > training_data.json
```

### Example 4: Monitor Data Collection

Check feature store health:

```bash
curl http://localhost:4000/api/v1/ml/features/stats
```

---

## Feature Normalization

The `/utils/featureNormalization.ts` module provides utilities for normalizing features:

### Min-Max Normalization

```typescript
import { normalize, DEFAULT_NORMALIZATION_CONFIG } from '@/utils/featureNormalization';

// Normalize hour (0-23) to [0, 1]
const normalized = normalize(14, 0, 23); // 0.608

// Normalize temperature (20-40°C) to [0, 1]
const normalizedTemp = normalize(32, 20, 40); // 0.6
```

### Batch Normalization

```typescript
import { normalizeFeatures } from '@/utils/featureNormalization';

const features = {
  hour_of_day: 14,
  temperature: 32,
  humidity: 75,
  is_rush_hour: false
};

const normalized = normalizeFeatures(features);
// { hour_of_day: 0.608, temperature: 0.6, humidity: 0.75, is_rush_hour: 0 }
```

### Feature Array Conversion

```typescript
import { featuresToArray } from '@/utils/featureNormalization';

const featureOrder = ['hour_of_day', 'temperature', 'humidity'];
const array = featuresToArray(normalized, featureOrder);
// [0.608, 0.6, 0.75]
```

---

## Database Schema

**Table:** `ml_features`

```sql
CREATE TABLE ml_features (
  id SERIAL PRIMARY KEY,
  road_id INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,

  -- Temporal features
  hour_of_day INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  -- ... (see migration file)

  -- Target variables
  target_speed_kmh INTEGER,
  target_congestion_level VARCHAR(20),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(road_id, timestamp)
);
```

**Indexes:**
- `idx_ml_features_road_id` - Fast lookup by road
- `idx_ml_features_timestamp` - Time-series queries
- `idx_ml_features_road_time` - Composite index for common queries
- `idx_ml_features_temporal` - Pattern queries by hour/day

---

## Notes

- Features are extracted in real-time from multiple sources (DB, APIs)
- Historical traffic features use 30-day rolling window
- Weather features cached for 5 minutes
- Batch extraction runs asynchronously to avoid blocking
- All features are designed to be ML-ready (numeric or boolean)

---

**Last Updated:** 2026-02-14
**Related Files:**
- `server/src/services/featureStoreService.ts`
- `server/src/controllers/mlController.ts`
- `server/src/routes/mlRoutes.ts`
- `server/src/utils/featureNormalization.ts`
- `server/db/migrations/006_create_ml_feature_store.sql`