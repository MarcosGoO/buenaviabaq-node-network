#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT_DIR = path.join('public', 'geo');
const REPORT_PATH = path.join('data', 'geo', 'soda2-validation-report.json');

const SOURCES = {
  accidentalidad: 'https://www.datos.gov.co/resource/yb9r-2dsi.json?%24limit=5000',
  eventos: 'https://www.datos.gov.co/resource/brb8-xkdk.json?%24limit=5000',
  fotodeteccion: 'https://www.datos.gov.co/resource/cpp6-je64.json?%24limit=50000',
  semaforizacion: 'https://www.datos.gov.co/resource/xknx-agu2.geojson?%24limit=50000',
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function toNumber(value) {
  if (value == null) return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function inBaqBounds(lng, lat) {
  return lng >= -74.92 && lng <= -74.67 && lat >= 10.84 && lat <= 11.10;
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

function buildPhotodetectionGeoJSON(rows) {
  const features = [];
  for (const row of rows) {
    let lng = null;
    let lat = null;

    if (row?.point?.coordinates?.length === 2) {
      lng = Number(row.point.coordinates[0]);
      lat = Number(row.point.coordinates[1]);
    }

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      lng = toNumber(row.longitud);
      lat = toNumber(row.latitud);
    }

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (!inBaqBounds(lng, lat)) continue;

    features.push({
      type: 'Feature',
      properties: {
        name: row.name || `Fotodeteccion ${row.no || ''}`.trim(),
        tipo: row.tipo_de_infracci_n || null,
        source: 'soda2:cpp6-je64',
      },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    });
  }

  return {
    type: 'FeatureCollection',
    metadata: {
      source: 'soda2',
      dataset: 'cpp6-je64',
      generated_at: new Date().toISOString(),
      feature_count: features.length,
    },
    features,
  };
}

function normalizeSemaforizacionGeoJSON(geojson) {
  const features = [];
  const rawFeatures = Array.isArray(geojson?.features) ? geojson.features : [];

  for (const feature of rawFeatures) {
    const coords = feature?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) continue;

    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (!inBaqBounds(lng, lat)) continue;

    features.push({
      type: 'Feature',
      properties: {
        name: feature?.properties?.name || feature?.properties?.codigo || 'Semaforo',
        estado: feature?.properties?.estado || null,
        source: 'soda2:xknx-agu2',
      },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    });
  }

  return {
    type: 'FeatureCollection',
    metadata: {
      source: 'soda2',
      dataset: 'xknx-agu2',
      generated_at: new Date().toISOString(),
      feature_count: features.length,
    },
    features,
  };
}

async function main() {
  ensureDir(OUTPUT_DIR);
  ensureDir(path.dirname(REPORT_PATH));

  const report = {
    generated_at: new Date().toISOString(),
    recommendations: {
      soda_version: 'SODA2 viable actualmente; migrar a SODA3 mas adelante solo si cambian endpoints/politicas',
      map_ready_sources: ['cpp6-je64', 'xknx-agu2'],
      non_map_ready_sources: ['yb9r-2dsi', 'brb8-xkdk'],
    },
    datasets: {},
  };

  const [accidentalidad, eventos, fotodeteccion, semaforizacion] = await Promise.all([
    getJson(SOURCES.accidentalidad),
    getJson(SOURCES.eventos),
    getJson(SOURCES.fotodeteccion),
    getJson(SOURCES.semaforizacion),
  ]);

  report.datasets.accidentalidad = {
    dataset: 'yb9r-2dsi',
    records: Array.isArray(accidentalidad) ? accidentalidad.length : 0,
    map_ready: false,
    reason: 'No trae lat/lon ni geocoded point en la muestra',
  };

  report.datasets.eventos = {
    dataset: 'brb8-xkdk',
    records: Array.isArray(eventos) ? eventos.length : 0,
    map_ready: false,
    reason: 'No trae lat/lon/geometria en la muestra y parece fuera del contexto BAQ',
  };

  const photoGeoJSON = buildPhotodetectionGeoJSON(Array.isArray(fotodeteccion) ? fotodeteccion : []);
  const semaforoGeoJSON = normalizeSemaforizacionGeoJSON(semaforizacion);

  fs.writeFileSync(path.join(OUTPUT_DIR, 'hotspots.fotodeteccion.geojson'), JSON.stringify(photoGeoJSON, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'semaforizacion.geojson'), JSON.stringify(semaforoGeoJSON, null, 2));

  report.datasets.fotodeteccion = {
    dataset: 'cpp6-je64',
    records: Array.isArray(fotodeteccion) ? fotodeteccion.length : 0,
    map_ready: true,
    exported_features: photoGeoJSON.features.length,
    output: 'public/geo/hotspots.fotodeteccion.geojson',
  };

  report.datasets.semaforizacion = {
    dataset: 'xknx-agu2',
    records: Array.isArray(semaforizacion?.features) ? semaforizacion.features.length : 0,
    map_ready: true,
    exported_features: semaforoGeoJSON.features.length,
    output: 'public/geo/semaforizacion.geojson',
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('Failed to fetch/normalize SODA2 datasets:', error);
  process.exit(1);
});
