import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/public-news',
  outputDir: './test-results/initial-news',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3000', browserName: 'chromium', trace: 'off', screenshot: 'only-on-failure' },
});
