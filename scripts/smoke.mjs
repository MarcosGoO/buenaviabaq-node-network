#!/usr/bin/env node
import process from 'node:process';

async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const baseUrl = process.env.SMOKE_BASE_URL;
  if (!baseUrl) {
    console.log('[smoke] skipped (set SMOKE_BASE_URL to enable API smoke checks)');
    process.exit(0);
  }

  const normalizedBase = baseUrl.replace(/\/$/, '');
  const checks = [
    `${normalizedBase}/health`,
    `${normalizedBase}/api/v1/predictions/health`,
  ];

  for (const url of checks) {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.error(`[smoke] failed: ${url} -> HTTP ${response.status}`);
      process.exit(1);
    }
    console.log(`[smoke] ok: ${url}`);
  }

  console.log('[smoke] all checks passed');
}

main().catch((error) => {
  console.error('[smoke] unexpected error:', error);
  process.exit(1);
});

