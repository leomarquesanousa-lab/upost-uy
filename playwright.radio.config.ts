import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/radio', outputDir: './test-results/radio', workers: 1, retries: 0,
  reporter: 'list', timeout: 60000,
  use: { baseURL: 'http://localhost:3000', browserName: 'chromium', screenshot: 'only-on-failure', trace: 'off' },
});
