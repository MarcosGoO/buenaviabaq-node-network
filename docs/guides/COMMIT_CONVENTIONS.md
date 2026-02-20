CONVENCIONES DE COMMITS (Conventional Commits)
 Formato Estándar

<type>(<scope>): <subject>

<body>

<footer>
Types (Tipos) - Los más importantes:
Type	Cuándo usarlo	Ejemplo
feat	Nueva funcionalidad	feat: add dark mode toggle
fix	Corrección de bugs	fix: resolve login timeout issue
docs	Solo documentación	docs: update API documentation
style	Formato, sin cambio de lógica	style: format code with prettier
refactor	Refactorización de código	refactor: simplify auth logic
perf	Mejoras de performance	perf: optimize database queries
test	Agregar/modificar tests	test: add unit tests for auth
build	Cambios en build/deps	build: upgrade react to v18
ci	Cambios en CI/CD	ci: add GitHub Actions workflow
chore	Tareas de mantenimiento	chore: update dependencies
revert	Revertir commit anterior	revert: "feat: add dark mode"
Scope (Opcional pero recomendado):

feat(auth): add OAuth login
fix(api): resolve CORS error
docs(readme): add installation steps
Breaking Changes:

feat!: remove deprecated API endpoint

BREAKING CHANGE: The /old-endpoint has been removed.
Use /new-endpoint instead.
 Buenos Ejemplos (como los que hicimos):

# Simple y descriptivo
fix: resolve TypeScript compilation errors in CI by isolating frontend and backend configs

# Con scope
fix(hooks): resolve ESLint hook errors and enhance GitGuardian configuration

# Con breaking change
feat(api)!: migrate to REST API v2

BREAKING CHANGE: API v1 endpoints removed. See migration guide.
 Ejemplos Malos:

# Muy vago
fix: stuff

# Sin contexto
updated files

# Demasiado largo como subject
fix: resolve the TypeScript compilation errors that were happening in the CI pipeline because the tsconfig.json was including both frontend and backend

# Mal formato
Fixed bug # No usar pasado, usar imperativo
 REGLAS DE ORO
Subject en imperativo: "add" no "added", "fix" no "fixed"
Max 72 caracteres en el subject
Sin punto final en el subject
Body opcional pero útil para explicar el "por qué"
Footer para referencias: "Closes #123", "Fixes #456"
 CONSEJOS PARA EL PRÓXIMO CLAUDE
 INFORMACIÓN CRÍTICA DEL PROYECTO
Estructura del Proyecto:

viabaq-node-network/
 tsconfig.json ← Frontend (Next.js) SOLAMENTE
 exclude: "server/**/*" IMPORTANTE
 server/
 tsconfig.json ← Backend (Express) SOLAMENTE
 .env ← API Keys (NO commitear)
 .env.docker.example ← Plantilla para Docker
 docker-compose.yml ← PostgreSQL, Redis, TimescaleDB
 PROBLEMAS RESUELTOS (No repetir):
TypeScript Config Isolation:

 Frontend tsconfig excluye server/**/*
 Backend tiene su propio tsconfig
 NO ejecutar tsc --noEmit que incluya ambos
ESLint Configuration:

 Root tiene eslint.config.mjs con globalIgnores
 Server tiene eslint.config.js separado
 NO ignorar archivos con .eslintignore (deprecated)
React Hooks:

 useSocketIO usa useSyncExternalStore (NO refs en render)
 RealTimeUpdates usa useCallback antes del useEffect
 NUNCA acceder a ref.current durante render
GitGuardian/Secrets:

 Historial ya limpiado con BFG
 .gitguardian.yaml configurado
 API keys antiguas REVOCADAS
 NO commitear server/.env
 API Keys Actuales (Válidas):

# En server/.env (NO en git)
OPENWEATHER_API_KEY=1de2732527d2aeecb3d63cb28b3ebb0d
GOOGLE_MAPS_API_KEY=AIzaSyDlvyQXD_w3Hj1C9jl2EI6HRY1PAsn8NxM
TOMTOM_API_KEY=6GxgJBCF4dqohg7QYSCxnZCLOIFW7nPH
 Stack Tecnológico:
Frontend:

Next.js 14 (App Router)
React 18
TypeScript (strict mode)
Tailwind CSS
react-map-gl/maplibre
Socket.IO Client
Backend:

Node.js + Express
TypeScript (strict: false)
PostgreSQL + PostGIS
Redis
TimescaleDB
Socket.IO Server
BullMQ (jobs)
 Comandos Importantes:

# Iniciar todo
docker-compose up -d
cd server && npm run dev # Terminal 1
npm run dev # Terminal 2 (raíz)

# Tests
cd server && npm run test:coverage

# Build
cd server && npm run build # Backend
npm run build # Frontend

# Linting
npm run lint # Root (frontend + server)
cd server && npm run lint # Solo backend
 CONSEJOS ESPECÍFICOS
Para Debugging:
Si ESLint falla: Verificar que no esté linting dist/ o coverage/
Si TypeScript falla: Verificar scope del tsconfig.json
Si Socket.IO no conecta: Verificar Redis esté corriendo
Si Backend no inicia: Verificar PostgreSQL esté listo (pg_isready)
Para Nuevas Features:
Siempre crear branch desde develop:

git checkout develop
git pull
git checkout -b feature/nombre-descriptivo
Commits frecuentes con mensajes descriptivos

Tests antes de push

Lint antes de commit

Para CI/CD:
 Frontend CI: ejecuta desde raíz, solo frontend code
 Backend CI: ejecuta desde server/, solo backend code
 NO mezclar ambos en el mismo workflow
