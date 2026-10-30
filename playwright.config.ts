import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/integration',
  timeout: 180_000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4170',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: [{
    command: process.env.PLAYWRIGHT_PRODUCTION === '1' ? 'npm run preview' : 'npm run dev',
    url: 'http://127.0.0.1:4170',
    reuseExistingServer: false,
  },
  { command: 'npm run model:fixture', url: 'http://127.0.0.1:4172/health', reuseExistingServer: false },
  { command: 'npm run proxy:fixture', url: 'http://127.0.0.1:4171/api/config', reuseExistingServer: false },
  ],
});
