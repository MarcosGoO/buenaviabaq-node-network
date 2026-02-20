# TomTom Traffic API Setup Guide

## Overview
TomTom provides real-time traffic data, routing, and mapping services. The free tier is excellent for development and includes actual traffic flow data.

## Free Tier Limits
- 2,500 transactions/day (FREE forever)
- No credit card required
- Access to Traffic Flow API
- Access to Traffic Incidents API
- Maps SDK for Web
- Routing API

## What You Get
- **Traffic Flow**: Real-time speed data, congestion levels
- **Traffic Incidents**: Accidents, road closures, construction
- **Routing**: Calculate routes with traffic consideration
- **Maps**: Display maps with traffic overlay

## Step-by-Step Setup

### 1. Create TomTom Developer Account
1. Go to [TomTom Developer Portal](https://developer.tomtom.com/)
2. Click "Sign Up" (top-right corner)
3. Fill in registration form:
 - Email address
 - Password
 - First/Last name
 - Country (Colombia)
4. Accept terms and conditions
5. Click "Create Account"
6. Check your email and verify your account

### 2. Get Your API Key
1. Log in to [TomTom Developer Portal](https://developer.tomtom.com/)
2. Go to "Dashboard" or "My Apps"
3. Your default API key is already created
4. Or click "Add a new app" to create a new one:
 - App name: `viabaq-traffic-monitor`
 - Description: `Real-time traffic monitoring for Barranquilla`
 - Click "Create"
5. Copy your **Consumer Key** (this is your API key)

### 3. Add API Key to Your Project

Add to `server/.env`:
```env
TOMTOM_API_KEY=your_actual_api_key_here
```

### 4. Test Your API Key

You can test it directly in the browser:
```
https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=10.9639,-74.7964&key=YOUR_API_KEY
```

Replace `YOUR_API_KEY` with your actual key. You should get JSON traffic data for Barranquilla.

## Available APIs

### 1. Traffic Flow API
Get real-time traffic speed and congestion:
```
GET https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json
 ?point={lat},{lon}
 &key={api_key}
```

Response includes:
- Current speed (km/h)
- Free flow speed (normal speed)
- Confidence level
- Road type

### 2. Traffic Incidents API
Get traffic incidents (accidents, closures):
```
GET https://api.tomtom.com/traffic/services/5/incidentDetails
 ?bbox={minLon},{minLat},{maxLon},{maxLat}
 &key={api_key}
```

Response includes:
- Incident type (accident, construction, etc.)
- Severity
- Location
- Description
- Delay time

### 3. Routing API
Calculate routes considering traffic:
```
GET https://api.tomtom.com/routing/1/calculateRoute/{locations}/json
 ?key={api_key}
 &traffic=true
```

## Integration Examples

### Fetch Traffic for Barranquilla
```typescript
const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY;
const BARRANQUILLA_COORDS = { lat: 10.9639, lon: -74.7964 };

async function getTrafficFlow(lat: number, lon: number) {
 const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&key=${TOMTOM_API_KEY}`;

 const response = await fetch(url);
 const data = await response.json();

 return {
 currentSpeed: data.flowSegmentData.currentSpeed,
 freeFlowSpeed: data.flowSegmentData.freeFlowSpeed,
 confidence: data.flowSegmentData.confidence,
 roadType: data.flowSegmentData.roadType
 };
}
```

### Fetch Traffic Incidents
```typescript
// Bounds for Barranquilla/Atlántico area
const bounds = {
 minLon: -75.25,
 minLat: 10.15,
 maxLon: -74.55,
 maxLat: 11.15
};

async function getTrafficIncidents() {
 const bbox = `${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}`;
 const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&key=${TOMTOM_API_KEY}&language=es-ES`;

 const response = await fetch(url);
 const data = await response.json();

 return data.incidents.map(incident => ({
 type: incident.type,
 severity: incident.magnitudeOfDelay,
 description: incident.description,
 location: incident.geometry.coordinates
 }));
}
```

## Recommended Call Frequency

With 2,500 calls/day limit:
- **Traffic Flow**: Every 2-3 minutes for key intersections = ~600-700 calls/day
- **Traffic Incidents**: Every 10 minutes for area = ~144 calls/day
- **Total**: ~800 calls/day (well within limit)

## Cost Management

### Monitor Usage
1. Log in to [TomTom Developer Portal](https://developer.tomtom.com/)
2. Go to "Dashboard" > "Usage"
3. View daily/monthly transaction counts
4. Track which APIs are used most

### Stay Within Free Tier
- 2,500 transactions/day limit
- Each API call = 1 transaction
- Refresh every 2 minutes = ~720 calls/day per endpoint
- Monitor multiple key locations without exceeding limit

## Rate Limiting

If you exceed 2,500/day:
- API returns HTTP 403 (Forbidden)
- Error message: "Rate limit exceeded"
- Resets at midnight UTC
- Consider caching responses to reduce calls

## Best Practices

1. **Cache responses** for 1-2 minutes to reduce API calls
2. **Monitor specific roads/intersections** instead of entire city
3. **Use batch requests** when available
4. **Implement exponential backoff** for failed requests
5. **Store API key securely** (already in .gitignore)

## Key Intersections in Barranquilla

Focus traffic monitoring on these busy areas:
```typescript
const KEY_LOCATIONS = [
 { name: 'Calle 72 con Circunvalar', lat: 11.0042, lon: -74.8108 },
 { name: 'Vía 40', lat: 10.9880, lon: -74.7826 },
 { name: 'Calle 30', lat: 10.9970, lon: -74.7880 },
 { name: 'Autopista al Aeropuerto', lat: 10.8944, lon: -74.7831 },
 { name: 'Puente Pumarejo', lat: 10.9955, lon: -74.7965 }
];

// Poll each location every 5 minutes = 5 locations × 288 calls = 1,440 calls/day
```

## Troubleshooting

### "Invalid API key"
- Check key is correct in `.env`
- Verify key is active in TomTom dashboard
- Restart server after adding key

### "Rate limit exceeded"
- Check daily usage in TomTom dashboard
- Reduce call frequency
- Implement caching
- Wait until midnight UTC for reset

### "No data returned"
- Verify coordinates are correct (lat, lon order)
- Check bounding box is valid
- Ensure location has traffic coverage

## Next Steps

1. Create TomTom account (no credit card needed)
2. Get your API key from dashboard
3. Add to `server/.env`
4. Implement traffic service in your backend
5. Create traffic overlay for map
6. Set up monitoring for key intersections
7. Implement caching to optimize API usage

## Support
- [TomTom Developer Documentation](https://developer.tomtom.com/traffic-api/documentation)
- [API Reference](https://developer.tomtom.com/traffic-api/api-explorer)
- [Support Forum](https://developer.tomtom.com/forum)
- [Sample Code](https://github.com/tomtom-international)
