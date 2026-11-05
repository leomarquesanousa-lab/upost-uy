import { defineConfig } from '@playwright/test';

// Presentation-only checks: no database fixtures, login or editorial mutations.
export default defineConfig({
  testDir: './tests/header',
  outputDir: './test-results/header',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.UPOST_HEADER_TEST_URL || 'http://localhost:3000',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'off',
    actionTimeout: 10000,
  },
});
