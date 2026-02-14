#!/bin/bash

# ML Integration Testing Script
# Tests the complete flow: Feature Store → ML Service → Predictions

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NODE_API="http://localhost:4000/api/v1"
ML_API="http://localhost:8000"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}🧪 ML Integration Testing Suite${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Function to check service health
check_service() {
    local name=$1
    local url=$2
    echo -e "${YELLOW}Checking $name...${NC}"

    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name is running${NC}"
        return 0
    else
        echo -e "${RED}✗ $name is not responding${NC}"
        return 1
    fi
}

# Function to run test
run_test() {
    local name=$1
    local command=$2
    echo -e "\n${YELLOW}Test: $name${NC}"

    if eval "$command"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        return 1
    fi
}

# Check if services are running
echo -e "${BLUE}Step 1: Service Health Checks${NC}"
echo "----------------------------------------"
check_service "Node.js Backend" "$NODE_API/../health" || exit 1
check_service "ML Service" "$ML_API/health" || exit 1
echo ""

# Test ML Service
echo -e "${BLUE}Step 2: ML Service Tests${NC}"
echo "----------------------------------------"

run_test "ML Service health endpoint" \
    "curl -s $ML_API/health | grep -q 'healthy'"

run_test "ML Service model info" \
    "curl -s $ML_API/model/info | grep -q 'model_type'"

run_test "ML Service feature stats" \
    "curl -s $ML_API/features/stats | grep -q 'total_records'"

echo ""

# Test Feature Store
echo -e "${BLUE}Step 3: Feature Store Tests${NC}"
echo "----------------------------------------"

run_test "Extract features for road" \
    "curl -s -X POST $NODE_API/ml/features/extract -H 'Content-Type: application/json' -d '{\"road_id\": 1}' | grep -q 'temporal'"

run_test "Get feature stats" \
    "curl -s $NODE_API/ml/features/stats | grep -q 'total_records'"

run_test "Store features with target" \
    "curl -s -X POST $NODE_API/ml/features/store -H 'Content-Type: application/json' -d '{\"road_id\": 1, \"target_speed\": 50}' | grep -q 'success'"

echo ""

# Test ML Predictions
echo -e "${BLUE}Step 4: ML Prediction Tests${NC}"
echo "----------------------------------------"

run_test "Prediction service health check" \
    "curl -s $NODE_API/predictions/health | grep -q 'ml_service_available'"

run_test "Single road prediction" \
    "curl -s $NODE_API/predictions/road/1 | grep -q 'predicted_speed_kmh'"

run_test "Batch predictions" \
    "curl -s -X POST $NODE_API/predictions/batch -H 'Content-Type: application/json' -d '{\"road_ids\": [1, 2, 3]}' | grep -q 'predictions'"

echo ""

# Test Training (if model doesn't exist)
echo -e "${BLUE}Step 5: Training Tests (Optional)${NC}"
echo "----------------------------------------"

if curl -s "$ML_API/model/info" | grep -q 'model_type'; then
    echo -e "${YELLOW}Model already exists, skipping training test${NC}"
else
    run_test "Train new model" \
        "curl -s -X POST $ML_API/train -H 'Content-Type: application/json' -d '{\"model_type\": \"lightgbm\", \"force_retrain\": true}' | grep -q 'success'"
fi

echo ""

# Performance Test
echo -e "${BLUE}Step 6: Performance Test${NC}"
echo "----------------------------------------"

echo -e "${YELLOW}Testing prediction response time...${NC}"
start_time=$(date +%s%N)
curl -s "$NODE_API/predictions/road/1" > /dev/null
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 ))

if [ $duration -lt 500 ]; then
    echo -e "${GREEN}✓ Response time: ${duration}ms (< 500ms target)${NC}"
else
    echo -e "${YELLOW}⚠ Response time: ${duration}ms (slower than 500ms target)${NC}"
fi

echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}✅ All tests completed!${NC}"
echo -e "${BLUE}======================================${NC}"
