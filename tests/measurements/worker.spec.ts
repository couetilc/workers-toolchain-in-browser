import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { workloadFiles } from '../../experiments/e03-workload/src/workload';

test('250-module changed-file round trips through the actual TypeScript worker', async ({ page }, testInfo) => {
  const files = workloadFiles(250);
  for (const path of ['src/App.tsx', 'src/main.tsx', 'src/message.ts', 'src/lazy.ts', 'src/assets.d.ts']) {
    files[path] = await readFile('experiments/e01-vite-runtime/fixture/' + path, 'utf8');
  }
  await page.goto('/');
  const measurements = await page.evaluate(async files => {
    const workerModule = '/src/typescript.worker.ts?worker&url';
    const { default: url } = await import(workerModule);
    const start = performance.now();
    const worker = new Worker(url, { type: 'module' });
    let id = 0;
    const call = (method: string, payload: unknown) => new Promise<any>((resolve, reject) => {
      worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data.value);
      worker.onerror = event => reject(new Error(event.message));
      worker.postMessage({ id: ++id, method, payload });
    });
    try {
      await call('sync', { revision: 0, files });
      await call('diagnostics', { revision: 0, path: 'src/workload.ts' });
      const initializeAndFirstQueryMs = performance.now() - start;
      const changedFileRoundTripsMs: number[] = [];
      for (let revision = 1; revision <= 3; revision++) {
        files['src/workload.ts'] += `\nconst wrong${revision}: string = ${revision};`;
        const before = performance.now();
        await call('sync', { revision, files });
        const diagnostics = await call('diagnostics', { revision, path: 'src/workload.ts' });
        changedFileRoundTripsMs.push(performance.now() - before);
        if (diagnostics.length !== revision || diagnostics.some((item: any) => item.code !== 2322)) throw new Error('Expected real changed-file diagnostics');
      }
      return { initializeAndFirstQueryMs, changedFileRoundTripsMs, files: Object.keys(files).length };
    } finally { worker.terminate(); }
  }, files);
  await writeFile(testInfo.outputPath('worker-measurements.json'), JSON.stringify(measurements, null, 2));
  expect(measurements.changedFileRoundTripsMs.every(ms => ms < 200)).toBe(true);
});
