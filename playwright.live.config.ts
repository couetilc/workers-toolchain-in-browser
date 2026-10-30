import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: 'tests/live',
  outputDir: 'test-results/live',
  timeout: 240_000,
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    { command: 'npm run preview', url: 'http://127.0.0.1:4170', reuseExistingServer: false },
    { command: 'npm run proxy', url: 'http://127.0.0.1:4171/api/config', reuseExistingServer: false },
  ],
});
