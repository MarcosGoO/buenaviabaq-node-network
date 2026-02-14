# 🖥️ VíaBaq Backend API

> Production-ready RESTful API for Barranquilla's urban mobility platform

[![Node.js](https://img.shields.io/badge/Node.js-22.16-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.2-red)](https://redis.io/)

---

## 📖 Overview

Enterprise-grade backend API providing:
- 🗺️ **36+ RESTful endpoints** for traffic, weather, and geospatial data
- ⚡ **Redis caching** with intelligent TTL management
- 🔄 **Background jobs** with BullMQ
- 📡 **Real-time updates** via Socket.IO
- 🧪 **80%+ test coverage** target
- 🔒 **Production-ready** error handling and security

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22+ (LTS recommended)
- Docker & Docker Compose
- npm

### Installation

```bash
# 1. Install dependencies
cd server
npm install

# 2. Create environment file
cp .env.example .env

# 3. Start services (from project root)
docker-compose up -d postgres redis

# 4. Run migrations
npm run db:migrate

# 5. Seed database
npm run db:seed

# 6. Start development server
npm run dev
```

**API available at:** `http://localhost:4000`

---

## 🗂️ Project Structure (Refactored)

```
server/
├── src/
│   ├── api/                    # API layer
│   │   ├── controllers/        # Request handlers
│   │   ├── routes/            # Route definitions
│   │   └── middleware/        # Express middleware
│   │       ├── errorHandler.ts    # Global error handler
│   │       ├── validateRequest.ts # Zod validation
│   │       └── requestId.ts       # Request tracing
│   │
│   ├── core/                   # Business logic
│   │   ├── services/          # Business services
│   │   └── repositories/      # Data access layer (planned)
│   │
│   ├── infrastructure/        # External dependencies
│   │   ├── database/         # DB migrations, seeds, connection
│   │   ├── cache/            # Redis client
│   │   ├── jobs/             # BullMQ workers
│   │   └── socket/           # Socket.IO server
│   │
│   └── shared/               # Shared utilities
│       ├── config/           # Environment configuration
│       ├── errors/           # Custom error classes
│       ├── types/            # TypeScript types
│       ├── utils/            # Utility functions
│       └── validators/       # Zod schemas (planned)
│
├── tests/                     # Testing
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   ├── e2e/                  # End-to-end tests
│   └── fixtures/             # Test data
│
└── db/                       # Database
    ├── migrations/           # SQL migrations
    └── seeds/                # Seed data
```

---

## 🔌 API Endpoints

### **Health & System**
- `GET /health` - System health check

### **Geospatial (7 endpoints)**
- `GET /api/v1/geo/zones` - City zones
- `GET /api/v1/geo/zones/:id` - Specific zone
- `GET /api/v1/geo/zones/bounds` - Zones in viewport
- `GET /api/v1/geo/arroyos` - Flood-prone areas
- `GET /api/v1/geo/roads` - Road network
- `GET /api/v1/geo/pois` - Points of interest

### **Traffic (3 endpoints)**
- `GET /api/v1/traffic/realtime` - Real-time traffic
- `GET /api/v1/traffic/summary` - Traffic summary
- `GET /api/v1/traffic/road/:id` - Road-specific traffic

### **Weather (2 endpoints)**
- `GET /api/v1/weather/current` - Current weather
- `GET /api/v1/weather/forecast` - Weather forecast

### **Events (7 endpoints)**
- `GET /api/v1/events` - All events (with filters)
- `GET /api/v1/events/upcoming` - Upcoming events
- `GET /api/v1/events/near` - Events near location
- `GET /api/v1/events/:id` - Specific event
- `POST /api/v1/events` - Create event
- `PUT /api/v1/events/:id` - Update event
- `DELETE /api/v1/events/:id` - Delete event

### **Analytics (8 endpoints)**
- `GET /api/v1/analytics/traffic-patterns` - Traffic patterns
- `GET /api/v1/analytics/hotspots` - Congestion hotspots
- `GET /api/v1/analytics/hourly-pattern` - Hourly pattern
- `GET /api/v1/analytics/compare/:road_id` - Current vs historical
- `GET /api/v1/analytics/weather-impact` - Weather impact
- `GET /api/v1/analytics/rush-hour` - Rush hour stats
- `GET /api/v1/analytics/road-history/:road_id` - Road history
- `GET /api/v1/analytics/road-stats/:road_id` - Road statistics

**[Full API Documentation →](./API_DOCUMENTATION.md)**

---

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start with hot-reload (tsx watch)
npm run build           # Build for production
npm start               # Start production server

# Code Quality
npm run typecheck       # TypeScript type checking
npm run lint            # ESLint
npm run lint:fix        # ESLint with auto-fix

# Database
npm run db:migrate      # Run migrations
npm run db:seed         # Seed database

# Testing
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
npm run test:ui         # Visual UI mode
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e        # E2E tests only
```

---

## 🧪 Testing

**Framework:** Vitest v2.1.0

```bash
# Run tests
npm test

# Watch mode (recommended for TDD)
npm run test:watch

# Coverage report
npm run test:coverage

# Visual UI
npm run test:ui
```

**Coverage Target:** >80% for all metrics

**Current Status:**
- ✅ Testing framework configured
- ✅ Example tests created
- 🔄 Expanding test suite (Sprint 4)

---

## 🔐 Security Features

### **Implemented:**
- ✅ **Helmet.js** - Security headers
- ✅ **CORS** - Configured for frontend origin
- ✅ **Rate Limiting** - 100 req/15min (configurable)
- ✅ **Input Validation** - Zod schemas
- ✅ **SQL Injection Prevention** - Parameterized queries
- ✅ **Custom Error Classes** - Secure error messages

### **Environment-based:**
- Production: Minimal error details
- Development: Full stack traces

---

## 📝 Environment Variables

**Key Variables:**

```bash
# Application
NODE_ENV=development
PORT=4000
HOST=localhost
API_VERSION=v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=viabaq_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_POOL_MAX=20

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Cache TTL (seconds)
CACHE_TTL_TRAFFIC=300       # 5 min
CACHE_TTL_WEATHER=300       # 5 min
CACHE_TTL_ANALYTICS=900     # 15 min
CACHE_TTL_GEO=3600          # 1 hour

# External APIs
OPENWEATHER_API_KEY=your_key_here

# Security
RATE_LIMIT_WINDOW_MS=900000  # 15 min
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

**[See complete list →](./src/shared/config/env.ts)**

---

## 🗄️ Database

### **Technology:**
- PostgreSQL 15 + PostGIS 3.4
- TimescaleDB (optional, for time-series)

### **Tables:**
```
zones              # 7 zones
roads              # 6 major roads
arroyos            # 4 flood-prone areas
pois               # 8 points of interest
events             # Urban events
traffic_history    # 4,038+ records (7 days)
weather_history    # Weather snapshots
```

### **Database Management:**

```bash
# Connect to database
docker exec -it viabaq-postgres psql -U postgres -d viabaq_db

# Useful commands
\dt                 # List tables
\d+ zones          # Describe zones table
\df                # List functions

# Manual queries
SELECT COUNT(*) FROM traffic_history;
SELECT * FROM zones LIMIT 5;
```

---

## 📊 Performance

**Current Metrics:**
- API Response Time: <200ms (p95)
- Cache Hit Ratio: >80% expected
- Background Jobs: 5-minute intervals
- Database Connections: Pool of 20

**Optimizations:**
- Redis caching with namespace-based TTLs
- Database connection pooling
- Compression middleware (gzip)
- Efficient PostGIS queries with indexes

---

## 🏗️ Architecture Highlights

### **Separation of Concerns:**
```
api/          → HTTP layer (controllers, routes, middleware)
core/         → Business logic (services, repositories)
infrastructure/ → External systems (DB, cache, jobs, socket)
shared/       → Common utilities (config, errors, validators)
```

### **Error Handling:**
```typescript
// 11 custom error classes
throw new NotFoundError('Road');
throw new ValidationError('Invalid data', errors);
throw new ServiceUnavailableError('Weather API');
```

### **Validation:**
```typescript
// Zod-based request validation
router.get('/users/:id',
  validateParams(userIdSchema),
  getUser
);
```

### **Async Error Handling:**
```typescript
// Automatic error catching
export const getUser = asyncHandler(async (req, res) => {
  // Errors automatically caught and passed to error handler
});
```

---

## 🚧 Current Status

### **Sprints 1-3: ✅ Complete**
- [x] Infrastructure & foundation
- [x] External API integrations
- [x] Historical data & analytics
- [x] Redis caching
- [x] BullMQ jobs
- [x] Socket.IO real-time
- [x] Frontend integration

### **Sprint 4: 🔄 In Progress**
- [ ] Repository Pattern
- [ ] Comprehensive tests (>80%)
- [ ] ML feature engineering
- [ ] Python microservice integration

---

## 📚 Documentation

- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference
- **[Project Docs](../docs/README.md)** - Full documentation index
- **[Architecture](../docs/architecture/REFACTORING_SUMMARY.md)** - System design
- **[Testing Guide](../docs/guides/TESTING_GUIDE.md)** - How to test

---

## 🤝 Contributing

1. Follow Conventional Commits
2. Write tests for new features
3. Maintain >80% coverage
4. Update documentation

**Commit format:**
```
feat: add new endpoint
fix: resolve cache issue
docs: update API docs
test: add unit tests for service
```

---

## 📄 License

MIT License - See [LICENSE](../LICENSE) for details

---

## 👨‍💻 Developer

**Marcos GoO** - [GitHub](https://github.com/MarcosGoO)

---

<div align="center">

**[← Back to Main README](../README.md)** | **[API Docs →](./API_DOCUMENTATION.md)** | **[Testing →](../docs/guides/TESTING_GUIDE.md)**

</div>
