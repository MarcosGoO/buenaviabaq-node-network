import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // Isolate server config from parent project
  root: __dirname,

  // Disable CSS processing (backend doesn't need it)
  css: {
    postcss: {
      plugins: [],
    },
  },

  test: {
    // Test environment
    environment: 'node',

    // Global setup/teardown
    globalSetup: './tests/setup.ts',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/infrastructure/database/migrations/**',
        'src/infrastructure/database/seeds/**',
      ],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },

    // Test patterns
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],

    // Timeout
    testTimeout: 10000,

    // Enable globals (describe, it, expect, etc.)
    globals: true,

    // Mock reset between tests
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,

    // Sequential execution for integration tests (database)
    sequence: {
      hooks: 'stack',
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@api': path.resolve(__dirname, './src/api'),
      '@core': path.resolve(__dirname, './src/core'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
