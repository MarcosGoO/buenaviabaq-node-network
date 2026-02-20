# Google Maps API Setup Guide

## Overview
Google Maps Platform provides mapping, routing, and location services. The free tier is generous and suitable for development and small-scale production use.

## Free Tier Limits
- 28,000 map loads per month (FREE)
- $200 monthly credit (covers ~100k map loads)
- No credit card required for basic usage
- Billing can be enabled later for higher limits

## Step-by-Step Setup

### 1. Create Google Cloud Account
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Accept the terms of service

### 2. Create a New Project
1. Click on the project dropdown (top-left, next to "Google Cloud")
2. Click "New Project"
3. Enter project name: `viabaq-traffic-monitor` (or your preference)
4. Click "Create"
5. Wait for project creation (takes ~30 seconds)
6. Select your new project from the dropdown

### 3. Enable Required APIs
1. Go to [APIs & Services > Library](https://console.cloud.google.com/apis/library)
2. Search for and enable these APIs:
 - **Maps JavaScript API** (for map display)
 - **Geocoding API** (for address/coordinate conversion)
 - **Directions API** (for routing - optional)
 - **Places API** (for location search - optional)
3. Click "Enable" for each API

### 4. Create API Key
1. Go to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" > "API key"
3. Copy your API key immediately (you'll need it)
4. Click "Restrict Key" to secure it

### 5. Restrict API Key (Important for Security)
1. Under "Application restrictions":
 - Select "HTTP referrers (web sites)"
 - Add: `http://localhost:*/*` (for development)
 - Add: `https://yourdomain.com/*` (for production, when ready)

2. Under "API restrictions":
 - Select "Restrict key"
 - Check only the APIs you enabled in step 3

3. Click "Save"

### 6. Add API Key to Your Project

Add to `server/.env`:
```env
GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

### 7. Usage in Code

The API key will be used for:
- Displaying Google Maps in the frontend
- Geocoding addresses to coordinates
- Getting traffic data and route information

## Cost Management

### Monitor Usage
1. Go to [Google Cloud Console > Billing](https://console.cloud.google.com/billing)
2. View "Reports" to track API usage
3. Set up budget alerts (recommended):
 - Go to "Budgets & alerts"
 - Create budget: $10/month
 - Set alert at 50%, 90%, 100%

### Stay Within Free Tier
- 28,000 map loads/month = ~933/day
- Each page refresh = 1 map load
- Refresh rate: Every 5 minutes = 288 calls/day
- **You're well within limits**

## Troubleshooting

### "This page can't load Google Maps correctly"
- Check API key is correct in `.env`
- Verify APIs are enabled in console
- Check HTTP referrer restrictions match your domain

### "API key not found"
- Restart your server after adding the key
- Check `.env` file is in the correct location (server/.env)
- Verify no extra spaces in the API key

### Rate limit errors
- Check your quota in Google Cloud Console
- Verify you're not exceeding 28,000/month
- Consider enabling billing for higher limits

## Best Practices

1. Never commit API keys to git (already in .gitignore)
2. Use environment variables for all keys
3. Set up key restrictions immediately
4. Monitor usage regularly
5. Enable billing alerts before going to production
6. Rotate keys periodically for security

## Alternative: MapLibre (Current Setup)

Your project currently uses MapLibre with free Carto basemaps:
```typescript
mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
```

This is 100% free with no limits. Google Maps is optional and only needed if you want:
- Google-specific features (Street View, Places API)
- Google's traffic data layer
- Better geocoding for Colombian addresses

For traffic monitoring in Barranquilla, you can continue using the current MapLibre setup and integrate traffic data from other sources (TomTom, OpenStreetMap).

## Next Steps

1. Get your API key using steps above
2. Add to `server/.env`
3. Restart server
4. Test integration
5. Monitor usage in Google Cloud Console

## Support
- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Pricing Calculator](https://mapsplatform.google.com/pricing/)
- [Support Forum](https://stackoverflow.com/questions/tagged/google-maps)
