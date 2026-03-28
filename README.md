# VíaBaq

Plataforma de inteligencia vial para Barranquilla con visualización geoespacial, analítica histórica, alertas en tiempo real y un servicio de predicción apoyado por machine learning.

## Qué incluye

- Frontend en Next.js 16 con mapa interactivo, paneles de analítica y vistas de administración.
- Backend en Node.js + Express con API REST, WebSockets, Redis y jobs en segundo plano.
- Servicio ML en Python para predicciones, explicabilidad y monitoreo de confiabilidad.
- Base de datos PostgreSQL/PostGIS para datos geoespaciales y series históricas.
- Pruebas unitarias, de integración y E2E.

## Estado de las fuentes de datos

- Clima: integración real disponible vía backend cuando se configura `OPENWEATHER_API_KEY`.
- Eventos y capas geográficas: salen de base de datos y archivos del proyecto.
- Tráfico en tiempo real: actualmente se simula en backend con contexto horario, clima y eventos.
- Predicciones ML: dependen del servicio Python y de que exista un modelo entrenado.

## Stack

- Frontend: Next.js, React 19, TypeScript, Tailwind CSS, MapLibre GL, Recharts
- Backend: Node.js 22, Express, TypeScript, Socket.IO, BullMQ, Redis
- Datos: PostgreSQL 15, PostGIS, TimescaleDB
- ML: FastAPI, Python, pipelines de entrenamiento y evaluación
- Testing: Vitest, Playwright

## Estructura del proyecto

```text
viabaq-node-network/
|- src/                 Frontend App Router, componentes y hooks
|- public/              Assets estáticos y capas geoespaciales públicas
|- e2e/                 Pruebas end-to-end con Playwright
|- server/              API backend, servicios, jobs, rutas y tests
|- ml-service/          Servicio de machine learning en Python
|- scripts/             Utilidades de smoke, preflight y carga de datos
|- data/                Datos geoespaciales y archivos de soporte
|- docs/                Guías y documentación técnica
`- .github/workflows/   Pipelines de CI
```

## Puesta en marcha

### Requisitos

- Node.js 22+
- npm 10+
- Docker y Docker Compose

### 1. Instalar dependencias

```bash
npm install
cd server && npm install
cd ../ml-service && pip install -r requirements.txt
cd ..
```

### 2. Configurar variables de entorno

Frontend en `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

Backend en `server/.env`:

```bash
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/viabaq_db
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:3000
OPENWEATHER_API_KEY=your_key_here
ADMIN_API_KEY=change_me
```

### 3. Levantar infraestructura

```bash
docker-compose up -d
```

### 4. Inicializar backend

```bash
cd server
npm run db:migrate
npm run db:seed
npm run dev
```

### 5. Iniciar frontend

```bash
npm run dev
```

### 6. Iniciar servicio ML

Revisa [ml-service/README.md](./ml-service/README.md) para el flujo completo del servicio.

## Scripts útiles

Frontend:

```bash
npm run dev
npm run build
npm run lint
npm run preflight
npm run smoke
npm run test:e2e
```

Backend:

```bash
cd server
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run preflight
```

## Áreas principales

- `/`: mapa operativo con capas, simulación horaria, planeación de ruta y alertas.
- `/analytics`: tendencias, hotspots, clima y comparativas históricas.
- `/predictions`: timeline predictivo, factores SHAP y riesgo de arroyos.
- `/admin`: salud del sistema ML, reentrenamiento y rollback de modelos.
- `/settings`: preferencias de experiencia, alertas, mapa y conexión.

## Documentación adicional

- [Guía de testing](./docs/guides/TESTING_GUIDE.md)
- [Seguridad](./docs/guides/SECURITY.md)
- [WebSockets API](./docs/architecture/WEBSOCKETS_API.md)
- [Feature store ML](./docs/architecture/ML_FEATURE_STORE.md)
- [Admin auth y preflight](./docs/ADMIN_AUTH_AND_PREFLIGHT.md)
- [API backend](./server/API_DOCUMENTATION.md)

## Estado del proyecto

Proyecto enfocado en mostrar una arquitectura full-stack aplicada a movilidad urbana:

- ingestión y normalización de datos
- visualización geoespacial en tiempo real
- analítica operacional
- predicción y monitoreo ML
- experiencia de dashboard lista para demo
