#!/bin/bash

# VíaBaq API Test Script
# Run this after starting the server with: npm run dev

BASE_URL="http://localhost:4000"
API_URL="$BASE_URL/api/v1"

echo "Testing VíaBaq API Endpoints"
echo "================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
  local name=$1
  local url=$2

  echo -n "Testing $name... "

  response=$(curl -s -o /dev/null -w "%{http_code}" "$url")

  if [ "$response" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $response)"
  fi
}

# Health Check
echo "Health Check"
test_endpoint "Server Health" "$BASE_URL/health"
echo ""

# Geo Endpoints
echo "Geo Endpoints"
test_endpoint "Get All Zones" "$API_URL/geo/zones"
test_endpoint "Get Zone by ID" "$API_URL/geo/zones/1"
test_endpoint "Get Arroyo Zones" "$API_URL/geo/arroyos"
test_endpoint "Get Critical Arroyos" "$API_URL/geo/arroyos?risk_level=critical"
test_endpoint "Get Roads" "$API_URL/geo/roads"
test_endpoint "Get Highways" "$API_URL/geo/roads?type=highway"
test_endpoint "Get POIs" "$API_URL/geo/pois"
test_endpoint "Get Hospitals" "$API_URL/geo/pois?category=hospital"
test_endpoint "Get Zones in Bounds" "$API_URL/geo/zones/bounds?sw_lng=-75.25&sw_lat=10.15&ne_lng=-74.55&ne_lat=11.15"
echo ""

# Weather Endpoints
echo "Weather Endpoints"
test_endpoint "Current Weather" "$API_URL/weather/current"
test_endpoint "Weather Forecast" "$API_URL/weather/forecast"
echo ""

# Traffic Endpoints
echo "Traffic Endpoints"
test_endpoint "Real-time Traffic" "$API_URL/traffic/realtime"
test_endpoint "Traffic Summary" "$API_URL/traffic/summary"
test_endpoint "Traffic by Road ID" "$API_URL/traffic/road/1"
echo ""

# Events Endpoints
echo "Events Endpoints"
test_endpoint "Get All Events" "$API_URL/events"
test_endpoint "Get Upcoming Events" "$API_URL/events/upcoming"
test_endpoint "Get Events Near Location" "$API_URL/events/near?lat=10.9639&lng=-74.7964&radius=5000"
test_endpoint "Get Event by ID" "$API_URL/events/1"
echo ""

# Test 404
echo "Error Handling"
test_endpoint "Non-existent Zone (404)" "$API_URL/geo/zones/9999"
test_endpoint "Invalid Route (404)" "$API_URL/invalid"
echo ""

echo "================================"
echo -e "${YELLOW}Testing complete!${NC}"
echo ""
echo "To see detailed responses, run:"
echo "   curl http://localhost:4000/api/v1/geo/zones | jq"
echo "   curl http://localhost:4000/api/v1/weather/current | jq"
echo "   curl http://localhost:4000/api/v1/traffic/realtime | jq"
echo "   curl http://localhost:4000/api/v1/events/upcoming | jq"
echo ""
