# VíaBaq Backend - Barranquilla Mobility Dashboard API

Backend API for real-time traffic prediction and mobility insights for Barranquilla, Colombia.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm or pnpm

### Installation

1. **Install dependencies:**
```bash
cd server
npm install
```

2. **Create environment file:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start database services:**
```bash
# From project root
docker-compose up -d postgres redis
```

4. **Run migrations:**
```bash
npm run db:migrate
```

5. **Seed database with Barranquilla data:**
```bash
npm run db:seed
```

6. **Start development server:**
```bash
npm run dev
```

The API will be available at `http://localhost:4000`

## 📊 Database Management

### Using pgAdmin (Optional)
```bash
# Start pgAdmin UI
docker-compose --profile tools up -d pgadmin

# Access at http://localhost:5050
# Email: admin@viabaq.com
# Password: admin
```

### Manual Database Access
```bash
# Connect to PostgreSQL
docker exec -it viabaq-postgres psql -U postgres -d viabaq_db

# Useful commands:
\dt geo.*           # List geo schema tables
\dt traffic.*       # List traffic schema tables
\d+ geo.zones       # Describe zones table
```

## 🗂️ Project Structure

```
server/
├── src/
│   ├── config/         # Configuration and environment variables
│   ├── controllers/    # Request handlers
│   ├── routes/         # API route definitions
│   ├── services/       # Business logic
│   ├── models/         # Data models and types
│   ├── middleware/     # Express middlewares
│   ├── utils/          # Utility functions
│   ├── db/             # Database connection and scripts
│   └── index.ts        # Application entry point
├── db/
│   ├── init/           # Database initialization scripts
│   ├── migrations/     # Schema migrations
│   └── seeds/          # Seed data
└── logs/               # Application logs
```

## 🔌 API Endpoints (Planned)

### Health & System
- `GET /health` - System health check

### Geographical Data
- `GET /api/v1/geo/zones` - Get city zones
- `GET /api/v1/geo/arroyos` - Get flood-prone areas
- `GET /api/v1/geo/roads` - Get road network

### Traffic
- `GET /api/v1/traffic/realtime` - Current traffic conditions
- `GET /api/v1/traffic/predictions` - ML-based predictions
- `GET /api/v1/traffic/segments/:id` - Specific segment data

### Weather
- `GET /api/v1/weather/current` - Current weather
- `GET /api/v1/weather/forecast` - Weather forecast

### Analytics
- `GET /api/v1/analytics/insights` - Traffic insights
- `GET /api/v1/analytics/hotspots` - Congestion hotspots

## 🛠️ Development

```bash
# Development with auto-reload
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## 🐳 Docker Services

- **PostgreSQL + PostGIS** - Main database (port 5432)
- **Redis** - Caching layer (port 6379)
- **TimescaleDB** - Time-series data (port 5433)
- **pgAdmin** - Database UI (port 5050, optional)

## 📝 Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `PORT` - API server port
- `DB_HOST`, `DB_PORT`, `DB_NAME` - Database connection
- `REDIS_HOST`, `REDIS_PORT` - Redis connection
- `OPENWEATHER_API_KEY` - Weather data API key
- `LOG_LEVEL` - Logging verbosity

## 🗄️ Database Schema

### Schemas:
- `geo` - Geographical data (zones, roads, arroyos, POIs)
- `traffic` - Traffic segments and flow data
- `weather` - Weather stations and conditions

### Key Tables:
- `geo.zones` - City zones and neighborhoods
- `geo.roads` - Road network with geometry
- `geo.arroyo_zones` - Flood-prone areas with risk levels
- `geo.pois` - Points of interest
- `traffic.segments` - Traffic analysis segments
- `weather.stations` - Weather monitoring stations

## 🧪 Testing

```bash
# Unit tests (to be implemented)
npm test

# Integration tests
npm run test:integration

# Load testing
npm run test:load
```

## 📚 Tech Stack

- **Runtime:** Node.js 20+ with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL 15 + PostGIS 3.4
- **Cache:** Redis 7
- **Time-Series:** TimescaleDB
- **Validation:** Zod
- **Logging:** Winston
- **Security:** Helmet, CORS, Rate Limiting

## 📖 API Documentation

API documentation will be available at `/api/docs` (Swagger UI - to be implemented)

## 🔐 Security

- Rate limiting on all API endpoints
- CORS configured for frontend origin
- Helmet.js security headers
- Input validation with Zod
- SQL injection prevention via parameterized queries

## 🚧 Current Sprint: Sprint 1

✅ Project structure created
✅ TypeScript configured
✅ Express server setup
✅ Database schema designed
✅ Docker Compose configured
✅ Seed data for Barranquilla

**Next:** API endpoints implementation (Sprint 1.3)

## 📄 License

MIT
