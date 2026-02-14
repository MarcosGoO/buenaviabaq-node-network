#!/bin/bash

# Test ML Feature Store Endpoints
# Run this script after starting the backend server

API_URL="http://localhost:4000/api/v1"

echo "🧪 Testing ML Feature Store Endpoints"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Extract features for a road
echo "${YELLOW}Test 1: Extract features for road_id=1${NC}"
curl -s -X POST "${API_URL}/ml/features/extract" \
  -H "Content-Type: application/json" \
  -d '{"road_id": 1}' | jq '.'
echo ""

# Test 2: Store features for a road with target values
echo "${YELLOW}Test 2: Store features with target values${NC}"
curl -s -X POST "${API_URL}/ml/features/store" \
  -H "Content-Type: application/json" \
  -d '{
    "road_id": 1,
    "target_speed": 45,
    "target_congestion": "moderate"
  }' | jq '.'
echo ""

# Test 3: Get feature statistics
echo "${YELLOW}Test 3: Get feature statistics${NC}"
curl -s "${API_URL}/ml/features/stats" | jq '.'
echo ""

# Test 4: Get stored features (limit 5)
echo "${YELLOW}Test 4: Get stored features (limit 5)${NC}"
curl -s "${API_URL}/ml/features?limit=5" | jq '.'
echo ""

# Test 5: Get features for specific road
echo "${YELLOW}Test 5: Get features for road_id=1${NC}"
curl -s "${API_URL}/ml/features?road_id=1&limit=3" | jq '.'
echo ""

# Test 6: Batch extract features for all roads
echo "${YELLOW}Test 6: Batch extract features (async)${NC}"
curl -s -X POST "${API_URL}/ml/features/batch" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'
echo ""

echo "${GREEN}✅ All tests completed!${NC}"
echo ""
echo "Check feature stats again after batch extraction completes:"
echo "curl ${API_URL}/ml/features/stats | jq '.'"
