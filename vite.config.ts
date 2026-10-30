import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  build: {
    rolldownOptions: {
      input: { workspace: 'workspace/index.html', vite: 'index.html', typescript: 'experiments/e02-typescript/index.html', workload: 'experiments/e03-workload/index.html' },
    },
  },
  server: {
    proxy: { '/api': 'http://127.0.0.1:4171' },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
