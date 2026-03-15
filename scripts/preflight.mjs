#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const serverDir = path.join(rootDir, 'server');

const steps = [
  { name: 'frontend:lint', cmd: 'npm', args: ['run', 'lint'], cwd: rootDir },
  { name: 'backend:typecheck', cmd: 'npm', args: ['run', 'typecheck'], cwd: serverDir },
  { name: 'backend:lint', cmd: 'npm', args: ['run', 'lint'], cwd: serverDir },
  { name: 'backend:build', cmd: 'npm', args: ['run', 'build'], cwd: serverDir },
  ...(process.env.PREFLIGHT_SKIP_FRONTEND_BUILD === '1'
    ? []
    : [{ name: 'frontend:build', cmd: 'npm', args: ['run', 'build'], cwd: rootDir }]),
  { name: 'smoke', cmd: 'npm', args: ['run', 'smoke'], cwd: rootDir },
];

for (const step of steps) {
  console.log(`\n[preflight] running ${step.name}`);
  const result = spawnSync(step.cmd, step.args, {
    cwd: step.cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`\n[preflight] failed at ${step.name}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n[preflight] all checks passed');
if (process.env.PREFLIGHT_SKIP_FRONTEND_BUILD === '1') {
  console.log('[preflight] note: frontend build was skipped by PREFLIGHT_SKIP_FRONTEND_BUILD=1');
}
