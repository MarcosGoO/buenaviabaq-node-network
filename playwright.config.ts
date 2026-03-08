import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration — VíaBaq Node Network
 *
 * Runs against the Next.js dev server on port 3000.
 * Tests live in e2e/ at the project root.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',

  // Maximum time per test (map loads can be slow)
  timeout: 30_000,

  // Retry once on CI to reduce flakiness from map tile loading
  retries: process.env.CI ? 1 : 0,

  // Parallel workers — sequential on CI to be safe
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    // Capture trace on first retry for debugging
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Viewport matching typical desktop dashboard usage
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  // Start Next.js dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
