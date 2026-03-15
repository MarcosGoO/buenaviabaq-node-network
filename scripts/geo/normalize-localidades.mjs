#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function toFeatureCollection(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Input must be a GeoJSON object');
  }

  if (raw.type === 'FeatureCollection' && Array.isArray(raw.features)) {
    return raw;
  }

  if (raw.type === 'Feature') {
    return { type: 'FeatureCollection', features: [raw] };
  }

  if (Array.isArray(raw)) {
    return { type: 'FeatureCollection', features: raw };
  }

  throw new Error('Unsupported GeoJSON format. Expected FeatureCollection/Feature/array of features');
}

function normalizeGeometry(geometry) {
  if (!geometry || typeof geometry !== 'object') return null;
  if (geometry.type === 'MultiPolygon' || geometry.type === 'Polygon') return geometry;
  return null;
}

function getName(properties = {}) {
  const candidates = [
    properties.name,
    properties.name_es,
    properties.locality,
    properties.NOMBRE,
    properties.NAME,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeFeature(feature, datasetVersion) {
  if (!feature || feature.type !== 'Feature') return null;

  const geometry = normalizeGeometry(feature.geometry);
  const name = getName(feature.properties || {});
  if (!geometry || !name) return null;

  return {
    type: 'Feature',
    properties: {
      name,
      source: 'osm',
      dataset_version: datasetVersion,
      source_id: feature.id ?? feature.properties?.id ?? null,
    },
    geometry,
  };
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] || path.join('data', 'geo', 'localidades.barranquilla.osm.geojson');
  const datasetVersion = process.argv[4] || new Date().toISOString().slice(0, 10);

  if (!inputPath) {
    console.error('Usage: node scripts/geo/normalize-localidades.mjs <input.geojson> [output.geojson] [datasetVersion]');
    process.exit(1);
  }

  const inputRaw = fs.readFileSync(inputPath, 'utf-8');
  const parsed = JSON.parse(inputRaw);
  const fc = toFeatureCollection(parsed);

  const features = fc.features
    .map((feature) => normalizeFeature(feature, datasetVersion))
    .filter(Boolean);

  const normalized = {
    type: 'FeatureCollection',
    metadata: {
      source: 'osm',
      dataset_version: datasetVersion,
      normalized_at: new Date().toISOString(),
      feature_count: features.length,
    },
    features,
  };

  fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2));
  console.log(`Normalized ${features.length} features -> ${outputPath}`);
}

main();
