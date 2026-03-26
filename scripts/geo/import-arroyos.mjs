#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const filePath = process.argv[2] || path.join('data', 'geo', 'arroyos.barranquilla.official.geojson');
  const apiBase = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    console.error('ADMIN_API_KEY is required to call /geo/import-arroyos');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`GeoJSON file not found: ${filePath}`);
    process.exit(1);
  }

  const geojson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const datasetVersion = geojson?.metadata?.dataset_version || new Date().toISOString().slice(0, 10);

  const response = await fetch(`${apiBase}/geo/import-arroyos`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-key': adminKey,
    },
    body: JSON.stringify({ source: 'official', dataset_version: datasetVersion, geojson }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Arroyo import failed:', response.status, payload);
    process.exit(1);
  }

  console.log('Arroyo import completed:', payload?.data ?? payload);
}

main().catch((error) => {
  console.error('Arroyo import script failed:', error);
  process.exit(1);
});
