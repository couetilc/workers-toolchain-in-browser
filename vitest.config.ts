import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'], include: ['@earendil-works/pi-agent-core', '@earendil-works/pi-ai', '@earendil-works/pi-ai/utils/event-stream', 'typebox', '@codemirror/state', '@codemirror/view', '@codemirror/autocomplete', '@codemirror/lang-javascript', '@codemirror/lint', '@codemirror/commands'] },
  resolve: { dedupe: ['@codemirror/state', '@codemirror/view'] },
  test: {
    projects: [
      { extends: true, test: { name: 'browser', include: ['tests/unit/**/*.test.ts'], browser: { enabled: true, provider: playwright(), instances: [{ browser: 'chromium' }], headless: true } } },
      { extends: true, test: { name: 'server', include: ['tests/server/**/*.test.ts'], environment: 'node' } },
    ],
    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.{ts,tsx,js,jsx}', 'experiments/*/src/**/*.{ts,tsx,js,jsx}', 'scripts/proxy.mjs'],
      reporter: ['text', 'json', 'html'],
      thresholds: { perFile: true, lines: 100, statements: 100, functions: 100, branches: 100 },
    },
  },
});
