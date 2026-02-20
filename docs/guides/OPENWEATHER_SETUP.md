# Configurar OpenWeather API - 100% GRATIS

## Paso 1: Obtener API Key (GRATIS)

1. Ve a: https://openweathermap.org/api
2. Click en "Sign Up" (arriba derecha)
3. Crea cuenta GRATIS con tu email
4. Confirma tu email
5. Ve a: https://home.openweathermap.org/api_keys
6. Copia tu API key (se genera automáticamente)

**IMPORTANTE:** 
- Plan GRATIS: 1,000 llamadas/día (más que suficiente)
- Tu app llama cada 5 minutos = ~288 llamadas/día
- NO necesitas tarjeta de crédito
- NO tiene paywall para uso básico

## Paso 2: Configurar en el Backend

```bash
# En el archivo server/.env
OPENWEATHER_API_KEY=tu_api_key_aqui
```

## Paso 3: Reiniciar Backend

```bash
cd server
npm run dev
```

## Verificar que Funciona

```bash
# Probar endpoint
curl http://localhost:4000/api/v1/weather/current
```

Deberías ver la temperatura real de Barranquilla (~27°C).

---

**Límites del Plan GRATIS:**
- 1,000 llamadas/día
- 60 llamadas/minuto
- Datos actuales + pronóstico 5 días
- NO requiere tarjeta

**Tu uso actual:**
- 1 llamada cada 5 minutos
- ~288 llamadas/día
- Caché de 5 minutos en Redis
- MUY por debajo del límite

**Si no configuras la API key:**
- El backend usará datos mock (32°C)
- Todo seguirá funcionando
- Solo no tendrás datos reales
