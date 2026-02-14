#!/bin/bash

# VíaBaq - Complete Setup Script
# This script sets up the entire project from scratch

set -e  # Exit on error

echo "🚀 VíaBaq - Project Setup Script"
echo "=================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js 22+ from https://nodejs.org"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node -v) detected"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠ Docker is not installed${NC}"
    echo "Docker is recommended for running PostgreSQL and Redis"
    echo "Continue anyway? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} Docker $(docker --version | awk '{print $3}') detected"
fi

echo ""
echo "📦 Installing dependencies..."
echo ""

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Install backend dependencies
echo "Installing backend dependencies..."
cd server
npm install
cd ..

echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

# Check if Docker services are needed
if command -v docker &> /dev/null; then
    echo "🐳 Starting Docker services..."
    docker-compose up -d postgres redis

    echo "Waiting for services to be ready..."
    sleep 5

    echo -e "${GREEN}✓${NC} Docker services started"
    echo ""
fi

# Setup backend
echo "🗄️ Setting up backend database..."
cd server

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
    echo -e "${YELLOW}⚠${NC} Please update server/.env with your configuration"
fi

# Run migrations
echo "Running database migrations..."
npm run db:migrate

# Seed database
echo "Seeding database with initial data..."
npm run db:seed

cd ..

echo -e "${GREEN}✓${NC} Backend setup complete"
echo ""

# Setup frontend
echo "🎨 Setting up frontend..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "Creating .env.local file..."
    cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
EOF
    echo -e "${GREEN}✓${NC} Created .env.local"
fi

echo -e "${GREEN}✓${NC} Frontend setup complete"
echo ""

# Summary
echo "=================================="
echo "🎉 Setup Complete!"
echo "=================================="
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Update environment files if needed:"
echo "   - server/.env"
echo "   - .env.local"
echo ""
echo "2. Start the backend server:"
echo "   cd server && npm run dev"
echo ""
echo "3. In another terminal, start the frontend:"
echo "   npm run dev"
echo ""
echo "4. Open your browser:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:4000"
echo "   Health:   http://localhost:4000/health"
echo ""
echo "📚 Documentation: ./docs/README.md"
echo "🧪 Testing: cd server && npm test"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
