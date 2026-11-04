import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3100', browserName: 'chromium', channel: 'msedge', trace: 'off', screenshot: 'off', actionTimeout: 10000 },
  webServer: { command: 'node node_modules/next/dist/bin/next start -p 3100', url: 'http://localhost:3100', reuseExistingServer: false, timeout: 60000 },
});
