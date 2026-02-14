# BUENAVIABAQ - Barranquilla Mobility Intelligence Platform

> **Advanced traffic prediction and urban mobility analytics for Barranquilla, Colombia**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.16-green)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.2-red)](https://redis.io/)

---

## Overview

VíaBaq is a **production-ready** urban mobility platform that combines real-time geospatial data, historical analytics, and machine learning to optimize traffic flow in Barranquilla. The system provides:

- **Real-time traffic monitoring** with WebSocket updates
- **Weather-aware predictions** considering Barranquilla's flood-prone zones (arroyos)
- **Advanced analytics** with 4,000+ historical data points
- **ML-ready architecture** for predictive modeling
- **High-performance API** with Redis caching and background jobs

---

## Key Features

### For End Users
- Interactive map with real-time traffic visualization
- Weather-based traffic predictions
- **Smart Alert System** with 4 alert types (arroyo floods, congestion, weather impact, events)
- Arroyo flood warnings integration
- Event-based congestion alerts
- **Real-time WebSocket notifications** 

### For Developers
- **46+ RESTful API endpoints** (including 5 alert endpoints) 
- TypeScript strict mode (100% type-safe)
- Repository pattern architecture
- Comprehensive error handling
- Production-grade logging (Winston)
- **Real-time updates (Socket.IO with Redis adapter)** 
- **Background job processing (BullMQ) - alerts every 2 min** 

### For Data Scientists
- 4,038 historical traffic records
- Feature-rich dataset (weather, events, rush hour)
- PostGIS geospatial queries
- Ready for ML model integration

---

## Architecture

```
┌─────────────────┐
│   Next.js       │ ← Frontend (MapLibre GL + Recharts)
│   Frontend      │
└────────┬────────┘
         │ HTTP/WebSocket
         ↓
┌─────────────────┐
│   Express API   │ ← Backend (TypeScript + Express)
│   + Socket.IO   │
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌─────────┐
│ Postgres│ │  Redis  │ ← Cache + Jobs
│ PostGIS │ │ BullMQ  │
└─────────┘ └─────────┘
```

**Tech Stack:**
- **Frontend:** Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, MapLibre GL
- **Backend:** Node.js 22, Express, TypeScript (strict), Zod validation
- **Database:** PostgreSQL 15 + PostGIS 3.4
- **Cache/Jobs:** Redis 7.2, ioredis, BullMQ
- **Real-time:** Socket.IO with Redis adapter
- **Logging:** Winston
- **Security:** Helmet, CORS, Rate Limiting

---

## Quick Start

### Prerequisites
- Node.js 22+ (LTS recommended)
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/viabaq-node-network.git
cd viabaq-node-network

# Install dependencies
npm install

# Start infrastructure (PostgreSQL + Redis)
docker-compose up -d

# Setup backend
cd server
npm install
npm run db:migrate  # Run migrations
npm run db:seed     # Seed database
npm run dev         # Start backend (port 4000)

# In another terminal - Setup frontend
cd ..
npm run dev         # Start frontend (port 3000)
```

### Verify Installation

**Backend Health Check:**
```bash
curl http://localhost:4000/health
```

**Frontend:**
Open browser → `http://localhost:3000`

---

## Project Structure

```
viabaq-node-network/
├── .github/              # CI/CD workflows
├── docs/                 # 📚 All documentation
│   ├── architecture/     # System design
│   ├── guides/          # Setup & testing guides
│   ├── sprints/         # Sprint summaries
│   ├── planning/        # Roadmap & plans
│   └── changelogs/      # Change history
├── data/                # 📊 External data files
│   └── raw/            # Raw data (not in git)
├── scripts/            # 🔧 Utility scripts
│   ├── test-api.sh
│   └── setup.sh
├── server/             # 🖥️ Backend API
│   ├── src/
│   │   ├── api/           # Controllers, routes, middleware
│   │   ├── core/          # Services, repositories
│   │   ├── infrastructure/ # DB, cache, jobs
│   │   └── shared/        # Config, types, utils
│   ├── tests/          # Unit, integration, e2e tests
│   └── db/            # Migrations & seeds
├── src/               # 🎨 Frontend (Next.js)
│   ├── app/          # Pages & layouts
│   ├── components/   # React components
│   └── hooks/        # Custom hooks
├── docker-compose.yml
└── README.md          # This file
```

---

## API Endpoints

### Geospatial
- `GET /api/v1/geo/zones` - City zones
- `GET /api/v1/geo/arroyos` - Flood-prone areas
- `GET /api/v1/geo/roads` - Road network
- `GET /api/v1/geo/pois` - Points of interest

### Traffic
- `GET /api/v1/traffic/realtime` - Real-time traffic
- `GET /api/v1/traffic/summary` - Traffic summary
- `GET /api/v1/traffic/road/:id` - Road-specific traffic

### Weather
- `GET /api/v1/weather/current` - Current weather
- `GET /api/v1/weather/forecast` - Weather forecast

### Analytics
- `GET /api/v1/analytics/traffic-patterns` - Traffic patterns
- `GET /api/v1/analytics/hotspots` - Congestion hotspots
- `GET /api/v1/analytics/weather-impact` - Weather impact

### Events
- `GET /api/v1/events` - Urban events
- `GET /api/v1/events/upcoming` - Upcoming events
- `POST /api/v1/events` - Create event (admin)

### Alerts NEW
- `GET /api/v1/alerts/active` - All active alerts
- `GET /api/v1/alerts/critical` - Critical alerts only
- `GET /api/v1/alerts/summary` - Alert statistics
- `GET /api/v1/alerts/by-severity/:severity` - Filter by severity
- `GET /api/v1/alerts/by-type/:type` - Filter by type

**[See full API docs →](./server/API_DOCUMENTATION.md)**
**[WebSocket API →](./docs/WEBSOCKETS_API.md)**
**[Alerts System →](./docs/ALERTS_SYSTEM.md)** 

---

## Testing

```bash
# Backend tests
cd server
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report

# Frontend tests
npm test

# E2E tests
npm run test:e2e

# API integration test
bash scripts/test-api.sh
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Commit Convention:** We use [Conventional Commits](https://www.conventionalcommits.org/)
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation
- `chore:` Maintenance
- `test:` Tests

---

## Environment Variables

### Backend (`server/.env`)
```bash
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/viabaq_db
REDIS_URL=redis://localhost:6379
OPENWEATHER_API_KEY=your_api_key_here  # Optional
```

### Frontend (`.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```
---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details

---

## 👨‍💻 Author

**Marcos GoO** - [GitHub](https://github.com/MarcosGoO)

---

<div align="center">

**Built for Barranquilla's urban mobility**

[Documentation](./docs/README.md) • [API Reference](./server/API_DOCUMENTATION.md) • [Contributing](#-contributing) • [License](#-license)

</div>