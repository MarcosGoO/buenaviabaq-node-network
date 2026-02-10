# VíaBaq - Barranquilla Mobility Intelligence

Advanced traffic prediction system for Barranquilla's urban infrastructure, combining real-time geospatial data with machine learning to optimize city transit patterns.

## Overview

This platform predicts traffic behavior by analyzing weather conditions, urban events, and historical patterns specific to Barranquilla's flood-prone zones (arroyos). The system provides actionable insights for urban planning and real-time navigation.

## Tech Stack

**Frontend:**
- Next.js 16 + TypeScript
- MapLibre GL for geospatial visualization
- Tailwind CSS + shadcn/ui

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL + PostGIS for spatial queries
- Redis for caching
- TimescaleDB for time-series data

**ML Pipeline (In Development):**
- Python + FastAPI
- Scikit-learn / XGBoost
- Feature engineering for traffic prediction

## Setup

### Frontend
```bash
npm install
npm run dev
```

Access at `http://localhost:3000`

### Backend
```bash
cd server
npm install

# Start services
docker-compose up -d postgres redis

# Initialize database
npm run db:migrate
npm run db:seed

# Start API
npm run dev
```

API available at `http://localhost:4000`

## Project Structure

```
/
├── src/              # Next.js frontend
├── server/           # Express backend API
│   ├── src/          # TypeScript source
│   ├── db/           # Migrations & seeds
│   └── API_DOCUMENTATION.md
├── docker-compose.yml
└── README.md
```

## API Endpoints

See [API_DOCUMENTATION.md](server/API_DOCUMENTATION.md) for complete reference.

Key endpoints:
- `GET /api/v1/geo/zones` - City zones
- `GET /api/v1/geo/arroyos` - Flood-prone areas
- `GET /api/v1/geo/roads` - Road network

## Development Status

🟢 **Sprint 1:** Complete (Infrastructure + Core API)
🟡 **Sprint 2:** In Progress (External APIs + Real-time data)

## License

MIT