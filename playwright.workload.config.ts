import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: 'tests/measurements',
  outputDir: 'test-results/workload',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
