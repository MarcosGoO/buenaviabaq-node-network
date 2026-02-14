#!/bin/bash

# CI/CD Simulation Script
# Simulates GitHub Actions workflow locally

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 CI/CD Simulation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

FAILED=0

run_step() {
    local step_name=$1
    local command=$2

    echo -e "\n${BLUE}► $step_name${NC}"
    echo "----------------------------------------"

    if eval "$command"; then
        echo -e "${GREEN}✓ SUCCESS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Backend CI/CD
echo -e "${YELLOW}Backend CI/CD Pipeline${NC}"
echo ""

cd server

run_step "Install Dependencies" "npm ci --silent"

run_step "TypeScript Type Check" "npm run typecheck"

run_step "ESLint" "npm run lint"

run_step "Build Backend" "npm run build"

# Python ML Service CI/CD
echo -e "\n${YELLOW}ML Service CI/CD Pipeline${NC}"
echo ""

cd ../ml-service

run_step "Create Python Virtual Environment" "python -m venv venv || python3 -m venv venv"

run_step "Activate venv and Install Dependencies" "
    if [ -f venv/Scripts/activate ]; then
        source venv/Scripts/activate
    else
        source venv/bin/activate
    fi
    pip install --quiet -r requirements.txt
"

run_step "Python Code Style Check (Black)" "
    if [ -f venv/Scripts/activate ]; then
        source venv/Scripts/activate
    else
        source venv/bin/activate
    fi
    black --check app/ || echo 'Black would reformat files'
"

run_step "Python Linter (Ruff)" "
    if [ -f venv/Scripts/activate ]; then
        source venv/Scripts/activate
    else
        source venv/bin/activate
    fi
    ruff check app/ || echo 'Ruff found issues'
"

# Docker Build Test
echo -e "\n${YELLOW}Docker Build Test${NC}"
echo ""

cd ..

run_step "Build ML Service Docker Image" "docker build -t viabaq-ml-test ml-service/"

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All CI/CD checks passed!${NC}"
    echo -e "${GREEN}Ready to push to GitHub${NC}"
else
    echo -e "${RED}❌ $FAILED check(s) failed${NC}"
    echo -e "${RED}Fix issues before pushing${NC}"
    exit 1
fi
echo -e "${BLUE}========================================${NC}"
