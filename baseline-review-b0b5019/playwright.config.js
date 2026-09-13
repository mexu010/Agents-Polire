import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 30000, workers: 1,
  use: { baseURL: process.env.POLIRE_TEST_URL || 'http://127.0.0.1:3000', channel: process.env.POLIRE_BROWSER || 'chrome', headless: true },
  webServer: process.env.POLIRE_TEST_URL ? undefined : { command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1', url: 'http://127.0.0.1:3000', reuseExistingServer: true },
  reporter: 'list'
});
