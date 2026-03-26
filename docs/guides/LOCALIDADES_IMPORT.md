# Importacion de Localidades (OSM)

Este flujo reemplaza zonas legacy por localidades reales (GeoJSON) y deja trazabilidad de fuente/version.

## 1) Normalizar archivo OSM

```bash
npm run geo:normalize-localidades -- data/raw/localidades_osm.geojson data/geo/localidades.barranquilla.osm.geojson 2026-03-15
```

Salida esperada:
- `data/geo/localidades.barranquilla.osm.geojson`
- `properties.name`
- `properties.source=osm`
- `properties.dataset_version=<version>`

## 2) Importar al backend (admin)

```bash
set ADMIN_API_KEY=tu_admin_key
npm run geo:import-localidades -- data/geo/localidades.barranquilla.osm.geojson
```

El script hace `POST /api/v1/geo/import-zones` con autenticacion admin.

## Validaciones aplicadas en import

- `ST_IsValid(geometry) = true`
- tipo geometria poligonal (`Polygon`/`MultiPolygon`)
- interseccion con bounding box de Barranquilla

## Notas

- Las zonas seed se marcan como `source=seed-legacy`.
- Al importar, se invalida cache geoespacial y el cache de mapeo `road_id -> zone_id`.

## Importar corredores reales (OSM)

Archivo esperado: `data/geo/roads.barranquilla.osm.geojson`

```bash
set ADMIN_API_KEY=tu_admin_key
npm run geo:import-roads -- data/geo/roads.barranquilla.osm.geojson
```

La capa de corredores en mapa consume `GET /api/v1/geo/roads/flow?verified=true`, por lo que solo dibuja datos con `metadata.source=osm|official`.

## Importar arroyos reales (fuente oficial)

Archivo esperado: `data/geo/arroyos.barranquilla.official.geojson`

```bash
set ADMIN_API_KEY=tu_admin_key
npm run geo:import-arroyos -- data/geo/arroyos.barranquilla.official.geojson
```

La capa de arroyos consume `GET /api/v1/geo/arroyos?verified=true`.
