# Guía Completa de Pruebas - VíaBaq

**Para:** Usuarios sin mucha experiencia
**Tiempo estimado:** 20-30 minutos
**Objetivo:** Probar TODO el sistema (frontend + backend)

> **Nota para Usuarios de Windows:**
> Esta guía incluye comandos tanto para **PowerShell** (Windows nativo) como para **Bash** (Git Bash/Linux/Mac).
> - Si estás en Windows, usa los comandos **PowerShell**
> - Si tienes Git Bash instalado, puedes usar los comandos **Bash**
> - Para más detalles sobre Windows, consulta **[WINDOWS_TESTING_GUIDE.md](WINDOWS_TESTING_GUIDE.md)**

---

## Pre-requisitos

Antes de empezar, asegúrate de tener instalado:

- Node.js 22.16.0 o superior
- Docker Desktop (para PostgreSQL y Redis)
- Git (para clonar el proyecto)
- Terminal/PowerShell
- Navegador web (Chrome/Firefox)

### Verificar Instalaciones

Abre una terminal y ejecuta:

```bash
node --version # Debe mostrar v22.x.x
docker --version # Debe mostrar Docker version
npm --version # Debe mostrar 10.x.x o superior
```

---

## PASO 1: Preparar el Proyecto

### 1.1 Navegar al Proyecto

```bash
cd "c:\Users\marco\Documents\PROYECTOS\PORTFOLIO\viabaq-node-network"
```

### 1.2 Instalar Dependencias del Frontend

```bash
npm install
```

**Espera a que termine** (puede tomar 1-2 minutos). Verás mensajes como:
```
added X packages in Ys
```

### 1.3 Instalar Dependencias del Backend

```bash
cd server
npm install
```

**Espera a que termine** (1-2 minutos).

### 1.4 Volver a la Raíz

```bash
cd ..
```

---

## PASO 2: Iniciar Servicios de Docker

### 2.1 Levantar PostgreSQL y Redis

Desde la raíz del proyecto:

```bash
docker-compose up -d postgres redis
```

**Verás algo como:**
```
 Container viabaq-postgres Started
 Container viabaq-redis Started
```

### 2.2 Verificar que Estén Corriendo

```bash
docker-compose ps
```

**Debes ver:**
```
NAME STATUS
viabaq-postgres Up X seconds (healthy)
viabaq-redis Up X seconds
```

 **Checkpoint:** Si ambos dicen "Up", estás listo para continuar.

---

## PASO 3: Configurar la Base de Datos

### 3.1 Navegar al Servidor

```bash
cd server
```

### 3.2 Ejecutar Migraciones

Las migraciones crean las tablas en la base de datos:

```bash
npm run db:migrate
```

**Debes ver:**
```
 Migration 001_create_geo_tables.sql completed
 Migration 003_create_events.sql completed
 Migration 004_create_timescale_traffic_history.sql completed
 Migration 005_create_weather_history.sql completed
All migrations completed successfully
```

### 3.3 Ejecutar Seeds (Datos de Prueba)

Los seeds llenan la base de datos con datos reales de Barranquilla:

```bash
npm run db:seed
```

**Debes ver:**
```
 Seed 001_barranquilla_zones.sql completed
 Seed 003_events.sql completed
 Seed 004_traffic_history.sql completed
All seeds completed successfully
```

 **Checkpoint:** Si todo dice "completed", la base de datos está lista.

---

## PASO 4: Iniciar el Backend

### 4.1 Iniciar el Servidor (desde /server)

```bash
npm run dev
```

**Deberías ver:**
```
 Socket.IO server initialized successfully
 VíaBaq Backend running on port 4000
 Environment: development
 API Version: v1
 Socket.IO ready for real-time connections
Redis client connected successfully
 Background jobs and scheduler started successfully
```

**IMPORTANTE:**
- El servidor está corriendo en http://localhost:4000
- NO cierres esta terminal
- Verás logs cada 5 minutos cuando el sistema recolecte datos

 **Checkpoint:** Si ves estos mensajes, el backend está funcionando.

---

## PASO 5: Probar el Backend (API)

### 5.1 Abrir UNA NUEVA Terminal

Presiona:
- Windows: `Ctrl + Shift + T` (nueva pestaña en Windows Terminal)
- O abre una terminal completamente nueva

### 5.2 Navegar al Proyecto

```bash
cd "c:\Users\marco\Documents\PROYECTOS\PORTFOLIO\viabaq-node-network\server"
```

### 5.3 Ejecutar Suite de Pruebas Automática

**Opción A - PowerShell (Windows):**
```powershell
.\test-api.ps1
```

**Opción B - Bash (Git Bash/Linux/Mac):**
```bash
bash test-api.sh
```

**Deberías ver algo como:**
```
Testing VíaBaq API Endpoints
================================

Health Check
Testing Server Health... PASS (HTTP 200)

Geo Endpoints
Testing Get All Zones... PASS (HTTP 200)
Testing Get Zone by ID... PASS (HTTP 200)
...

Weather Endpoints
Testing Current Weather... PASS (HTTP 200)
Testing Weather Forecast... PASS (HTTP 200)

Traffic Endpoints
Testing Real-time Traffic... PASS (HTTP 200)
Testing Traffic Summary... PASS (HTTP 200)
...

Events Endpoints
Testing Get All Events... PASS (HTTP 200)
Testing Get Upcoming Events... PASS (HTTP 200)
...

Analytics Endpoints
Testing Traffic Patterns... PASS (HTTP 200)
Testing Traffic Hotspots... PASS (HTTP 200)
...

Testing complete!
```

 **Checkpoint:** Si todos los tests dicen " PASS", el backend está perfecto.

### 5.4 Pruebas Manuales Opcionales

**Probar Health Check:**

PowerShell:
```powershell
Invoke-RestMethod -Uri http://localhost:4000/health | ConvertTo-Json
```

Bash:
```bash
curl http://localhost:4000/health
```

**Deberías ver:**
```json
{
 "status": "ok",
 "services": {
 "database": "connected",
 "redis": "connected",
 "socket": {
 "status": "active",
 "connections": 0
 }
 }
}
```

**Probar Tráfico en Tiempo Real:**

PowerShell:
```powershell
Invoke-RestMethod -Uri http://localhost:4000/api/v1/traffic/current | ConvertTo-Json -Depth 3
```

Bash:
```bash
curl http://localhost:4000/api/v1/traffic/current
```

**Probar Hotspots:**

PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/analytics/traffic/hotspots?limit=5" | ConvertTo-Json -Depth 3
```

Bash:
```bash
curl "http://localhost:4000/api/v1/analytics/traffic/hotspots?limit=5"
```

**Probar Eventos Próximos:**

PowerShell:
```powershell
Invoke-RestMethod -Uri http://localhost:4000/api/v1/events/upcoming | ConvertTo-Json -Depth 3
```

Bash:
```bash
curl http://localhost:4000/api/v1/events/upcoming
```

---

## PASO 6: Iniciar el Frontend

### 6.1 Abrir OTRA Terminal Nueva

(Ahora tendrás 3 terminales abiertas: backend, pruebas, frontend)

### 6.2 Navegar a la Raíz del Proyecto

```bash
cd "c:\Users\marco\Documents\PROYECTOS\PORTFOLIO\viabaq-node-network"
```

### 6.3 Iniciar Next.js

```bash
npm run dev
```

**Deberías ver:**
```
 Next.js 15.x.x
- Local: http://localhost:3000
- Network: http://192.168.x.x:3000

 Ready in Xs
```

 **Checkpoint:** Si ves "Ready", el frontend está listo.

---

## PASO 7: Probar el Frontend (Navegador)

### 7.1 Abrir el Navegador

1. Abre tu navegador favorito (Chrome/Firefox)
2. Ve a: **http://localhost:3000**

### 7.2 Verificar que Cargó

Deberías ver:
- Sidebar a la izquierda con "BUENAVÍA"
- Mapa de Barranquilla en el centro
- Indicador "En vivo" (verde) arriba a la derecha
- Panel de "Live Intelligence" (puede estar cerrado)
- Widget del clima abajo a la derecha

### 7.3 Interacciones Básicas

**1. Probar el Sidebar:**
- Click en el botón de colapsar (←)
- El sidebar se debe contraer
- Click de nuevo para expandirlo

**2. Probar el Mapa:**
- Click y arrastra para mover el mapa
- Scroll para hacer zoom
- Click en el botón de recenter (abajo derecha)

**3. Probar el Panel de Alertas:**
- Click en "Live Intelligence"
- Debe abrirse mostrando alertas activas

**4. Probar el Widget de Clima:**
- Click en la flecha del widget de clima
- Debe expandirse mostrando más detalles

---

## PASO 8: Probar Analytics Dashboard

### 8.1 Navegar a Analytics

En el navegador, ve a: **http://localhost:3000/analytics**

O click en el botón "Analytics" del sidebar.

### 8.2 Verificar Componentes

Deberías ver:

**1. Pestañas (Tabs):**
- Patrones
- Hotspots
- Impacto Clima

**2. Pestaña "Patrones":**
- Gráfico de línea: Velocidad por hora
- Gráfico de barras: Volumen de tráfico

**3. Pestaña "Hotspots":**
- Lista numerada de las 5 zonas más congestionadas
- Gráfico de barras horizontal con frecuencia

**4. Pestaña "Impacto Clima":**
- 2 tarjetas: "Con Lluvia" y "Sin Lluvia"
- Gráfico comparativo de velocidades

### 8.3 Probar Interactividad

1. **Hover sobre los gráficos**
 - Deberías ver tooltips con valores exactos

2. **Click en "Actualizar"**
 - Los datos se deben refrescar

3. **Cambiar entre tabs**
 - Navegación debe ser suave

---

## PASO 9: Probar Real-Time Updates

### 9.1 Verificar Conexión Socket.IO

En la esquina superior derecha deberías ver:
- 🟢 **"En vivo"** (verde) = Conectado
- **"Desconectado"** (rojo) = Problema

### 9.2 Esperar Actualización Automática

El sistema recolecta datos cada 5 minutos.

**Para ver una actualización inmediata:**

1. Ve a la terminal del **backend** (la primera que abriste)
2. Verás logs cada 5 minutos como:
 ```
 Starting full data collection cycle...
 Traffic data collection completed successfully
 Weather data collection completed successfully
 ```

3. **En el navegador**, cuando esto ocurra:
 - Aparecerá una notificación toast abajo a la derecha
 - El indicador verde parpadeará
 - Se añadirá un item a la lista de actualizaciones

### 9.3 Ver Historial de Actualizaciones

Si hay actualizaciones recientes:
- Click en el panel de actualizaciones (arriba derecha)
- Deberías ver lista de updates con timestamps
- Cada update tiene un color según el tipo:
 - Azul = Tráfico
 - 🟢 Verde = Clima
 - 🟠 Naranja = Eventos

---

## PASO 10: Pruebas Avanzadas (Opcional)

### 10.1 Probar Cache de Redis

**Primera request (sin caché):**

PowerShell:
```powershell
Measure-Command { Invoke-RestMethod -Uri http://localhost:4000/api/v1/traffic/current }
```

Bash:
```bash
curl -w "@tiempo: %{time_total}s\n" http://localhost:4000/api/v1/traffic/current
```

**Segunda request (con caché - debería ser más rápida):**

PowerShell:
```powershell
Measure-Command { Invoke-RestMethod -Uri http://localhost:4000/api/v1/traffic/current }
```

Bash:
```bash
curl -w "@tiempo: %{time_total}s\n" http://localhost:4000/api/v1/traffic/current
```

La segunda debería ser significativamente más rápida (<0.01s).

### 10.2 Verificar Background Jobs

En la terminal del backend, busca logs como:
```
Processing job collect-all-XXXXXXXXX
Starting full data collection cycle...
 Stored traffic snapshot for 6 roads
 Stored weather snapshot
Job collect-all-XXXXXXXXX completed successfully
```

Estos aparecen cada 5 minutos.

### 10.3 Verificar Datos en DB

**Contar registros de tráfico:**

PowerShell:
```powershell
docker exec viabaq-postgres psql -U postgres -d viabaq_db -c "SELECT COUNT(*) FROM traffic_history;"
```

Bash:
```bash
docker exec viabaq-postgres psql -U postgres -d viabaq_db -c "SELECT COUNT(*) FROM traffic_history;"
```

Deberías ver un número >4000 que va aumentando cada 5 min.

**Ver eventos próximos:**

PowerShell:
```powershell
docker exec viabaq-postgres psql -U postgres -d viabaq_db -c "SELECT title, start_time FROM events WHERE status='scheduled' LIMIT 5;"
```

Bash:
```bash
docker exec viabaq-postgres psql -U postgres -d viabaq_db -c "SELECT title, start_time FROM events WHERE status='scheduled' LIMIT 5;"
```

### 10.4 Probar TODOS los Endpoints

 **Tip:** Usa el script PowerShell para probar todos automáticamente: `.\test-api.ps1`

**Geo:**

PowerShell:
```powershell
Invoke-RestMethod http://localhost:4000/api/v1/geo/zones | ConvertTo-Json -Depth 2
Invoke-RestMethod http://localhost:4000/api/v1/geo/roads | ConvertTo-Json -Depth 2
Invoke-RestMethod http://localhost:4000/api/v1/geo/arroyo-zones | ConvertTo-Json -Depth 2
Invoke-RestMethod http://localhost:4000/api/v1/geo/pois | ConvertTo-Json -Depth 2
```

Bash:
```bash
curl http://localhost:4000/api/v1/geo/zones
curl http://localhost:4000/api/v1/geo/roads
curl http://localhost:4000/api/v1/geo/arroyo-zones
curl http://localhost:4000/api/v1/geo/pois
```

**Weather:**

PowerShell:
```powershell
Invoke-RestMethod http://localhost:4000/api/v1/weather/current | ConvertTo-Json
```

Bash:
```bash
curl http://localhost:4000/api/v1/weather/current
```

**Traffic:**

PowerShell:
```powershell
Invoke-RestMethod http://localhost:4000/api/v1/traffic/current | ConvertTo-Json -Depth 3
```

Bash:
```bash
curl http://localhost:4000/api/v1/traffic/current
```

**Events:**

PowerShell:
```powershell
Invoke-RestMethod http://localhost:4000/api/v1/events | ConvertTo-Json -Depth 2
Invoke-RestMethod http://localhost:4000/api/v1/events/upcoming | ConvertTo-Json -Depth 2
```

Bash:
```bash
curl http://localhost:4000/api/v1/events
curl http://localhost:4000/api/v1/events/upcoming
```

**Analytics:**

PowerShell:
```powershell
Invoke-RestMethod "http://localhost:4000/api/v1/analytics/traffic/hotspots?limit=5" | ConvertTo-Json -Depth 3
Invoke-RestMethod "http://localhost:4000/api/v1/analytics/traffic/patterns?period=day" | ConvertTo-Json -Depth 3
Invoke-RestMethod http://localhost:4000/api/v1/analytics/weather/impact | ConvertTo-Json -Depth 3
```

Bash:
```bash
curl "http://localhost:4000/api/v1/analytics/traffic/hotspots?limit=5"
curl "http://localhost:4000/api/v1/analytics/traffic/patterns?period=day"
curl http://localhost:4000/api/v1/analytics/weather/impact
```

---

## Checklist de Verificación Final

### Backend 
- [ ] Servidor corriendo en puerto 4000
- [ ] PostgreSQL conectado
- [ ] Redis conectado
- [ ] Socket.IO activo
- [ ] Background jobs ejecutándose cada 5 min
- [ ] Todos los endpoints respondiendo (36+)
- [ ] Health check retorna "ok"

### Frontend 
- [ ] Página principal carga sin errores
- [ ] Mapa de Barranquilla visible
- [ ] Sidebar funciona (colapsar/expandir)
- [ ] Panel de alertas se abre/cierra
- [ ] Widget de clima expandible
- [ ] Socket.IO conectado (indicador verde)
- [ ] Página /analytics carga
- [ ] Gráficos se visualizan correctamente
- [ ] Tabs de analytics funcionan

### Real-Time 
- [ ] Indicador "En vivo" verde
- [ ] Notificaciones toast aparecen
- [ ] Lista de updates se llena
- [ ] Timestamps correctos

### Database 
- [ ] 7 zonas insertadas
- [ ] 6 vías insertadas
- [ ] 8 eventos insertados
- [ ] 4000+ registros de tráfico
- [ ] Weather history funcionando

---

## Troubleshooting (Si algo falla)

### El backend no inicia

**Problema:** Error "EADDRINUSE"
**Solución:** El puerto 4000 ya está en uso.
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <numero_pid> /F

# Luego reinicia
npm run dev
```

**Problema:** "Cannot connect to database"
**Solución:** PostgreSQL no está corriendo.
```bash
docker-compose up -d postgres
# Espera 5 segundos
npm run dev
```

**Problema:** "Redis connection failed"
**Solución:** Redis no está corriendo.
```bash
docker-compose up -d redis
# Espera 3 segundos
npm run dev
```

### El frontend no carga

**Problema:** Página en blanco
**Solución:** Abre las DevTools (F12) y mira la consola.
- Si dice "Failed to fetch": El backend no está corriendo
- Si dice error de compilación: `Ctrl+C` y `npm run dev` de nuevo

**Problema:** "Socket.IO desconectado"
**Solución:** Verifica que el backend esté corriendo y que la URL en `.env.local` sea correcta:
```
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### Los gráficos no muestran datos

**Problema:** Gráficos vacíos
**Solución:**
1. Verifica que el backend esté corriendo
2. Abre DevTools → Network
3. Recarga la página /analytics
4. Busca requests a `/api/v1/analytics/...`
5. Si fallan (404/500): El backend tiene problemas
6. Si retornan `data: []`: La DB no tiene datos → corre `npm run db:seed`

### Docker no inicia

**Problema:** "Cannot connect to Docker daemon"
**Solución:** Asegúrate de que Docker Desktop esté corriendo.
- Abre Docker Desktop
- Espera a que diga "Docker Desktop is running"
- Intenta de nuevo

---

## ¡Pruebas Completadas!

Si llegaste hasta aquí y todos los checkboxes están marcados, ¡FELICITACIONES! 

Has probado exitosamente:
- Backend completo (36+ endpoints)
- Base de datos con datos reales
- Sistema de caché con Redis
- Background jobs automáticos
- WebSocket real-time
- Frontend con dashboard interactivo
- Analytics con gráficos
- Notificaciones en tiempo real

---

## Capturas de Pantalla Esperadas

### 1. Terminal Backend
Debe mostrar:
```
 VíaBaq Backend running on port 4000
 Background jobs and scheduler started successfully
```

### 2. Navegador - Página Principal
- Mapa centrado en Barranquilla
- Sidebar con "BUENAVÍA"
- Indicador verde "En vivo"

### 3. Navegador - Analytics
- 3 tabs visibles
- Gráficos con datos
- Sin errores en consola

### 4. Terminal - Test Script
```
Testing complete!
[Todos los tests en verde PASS]
```

---

## Cómo Detener Todo

Cuando termines de probar:

### 1. Detener Frontend
En la terminal del frontend: `Ctrl + C`

### 2. Detener Backend
En la terminal del backend: `Ctrl + C`

### 3. Detener Docker (opcional)
Si quieres liberar recursos:
```bash
docker-compose down
```

Para detener pero mantener los datos:
```bash
docker-compose stop
```

---

## Cómo Volver a Iniciar

La próxima vez que quieras probar:

1. Iniciar Docker:
 ```bash
 docker-compose up -d postgres redis
 ```

2. Iniciar Backend:
 ```bash
 cd server
 npm run dev
 ```

3. Iniciar Frontend (en otra terminal):
 ```bash
 npm run dev
 ```

4. Abrir navegador: http://localhost:3000

---

## Ayuda Adicional

Si encuentras algún problema no listado aquí:

1. **Revisa los logs** en las terminales
2. **Abre DevTools** (F12) en el navegador
3. **Verifica el estado** de Docker:
 ```bash
 docker-compose ps
 ```

4. **Reinicia todo** desde cero:
 ```bash
 # Detener
 docker-compose down

 # Limpiar
 docker volume prune -f

 # Reiniciar
 docker-compose up -d postgres redis
 cd server && npm run db:migrate && npm run db:seed
 npm run dev
 ```

---

**¡Feliz Testing!** 

Si todo funcionó correctamente, el sistema está listo para demos y desarrollo posterior.
