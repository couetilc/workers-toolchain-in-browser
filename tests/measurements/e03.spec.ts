import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

for (const size of [0, 250]) {
  test(`${size} additional modules: fresh context and repeated warm work`, async ({ page }, testInfo) => {
    const measurements: Record<string, unknown> = { size, cache: 'Fresh browser context; upstream and host caches uncontrolled' };
    const measure = async (action: () => Promise<void>) => {
      const start = performance.now();
      await action();
      return Math.round(performance.now() - start);
    };
    await page.goto(`/experiments/e03-workload/?size=${size}`);
    const preview = page.frameLocator('iframe[title="Project preview"]');
    try {
      measurements.startToInteractiveMs = await measure(async () => {
        await page.getByRole('button', { name: 'Start runtime', exact: true }).click();
        await expect(preview.getByText(`Generated total: ${size * (size - 1) / 2 + size * 100}`)).toBeVisible();
      });
      await preview.getByRole('button', { name: 'Count: 0' }).click();
      const hmr: number[] = [];
      for (let sample = 0; sample < 3; sample++) {
        hmr.push(await measure(async () => {
          await page.getByRole('button', { name: 'Change component', exact: true }).click();
          await expect(preview.getByRole('heading')).toHaveText('Edited inside browser');
          await expect(preview.getByRole('button', { name: 'Count: 1' })).toBeVisible();
        }));
        await page.getByRole('button', { name: 'Fix syntax', exact: true }).click();
        await expect(preview.getByRole('heading')).toHaveText('Browser-built React');
      }
      measurements.hmrObservedMs = hmr;
      const builds: number[] = [];
      for (let sample = 0; sample < 3; sample++) {
        builds.push(await measure(async () => {
          await page.getByRole('button', { name: 'Build defaults', exact: true }).click();
          await expect(page.getByRole('status')).toHaveText('Ready on port 4173', { timeout: 30_000 });
          await expect(preview.getByText(`Generated total: ${size * (size - 1) / 2 + size * 100}`)).toBeVisible();
          await expect(preview.getByRole('button', { name: 'Count: 0' })).toBeVisible();
        }));
        await preview.getByRole('button', { name: 'Count: 0' }).click();
      }
      measurements.buildToPreviewMs = builds;
      const analyses: unknown[] = [];
      for (let sample = 0; sample < 3; sample++) {
        await page.getByRole('button', { name: 'Analyze workload', exact: true }).click();
        const result = JSON.parse((await page.getByLabel('Workload analysis').textContent())!);
        expect(result.diagnostics).toEqual([]);
        analyses.push(result);
      }
      measurements.typescript = analyses;
      const edits: unknown[] = [];
      for (let sample = 0; sample < 3; sample++) {
        await page.getByRole('button', { name: 'Introduce workload type error', exact: true }).click();
        const result = JSON.parse((await page.getByLabel('Workload analysis').textContent())!);
        expect(result.diagnostics[0].code).toBe(2322);
        edits.push(result);
        await page.getByRole('button', { name: 'Fix workload type error', exact: true }).click();
        expect(JSON.parse((await page.getByLabel('Workload analysis').textContent())!).diagnostics).toEqual([]);
      }
      measurements.typescriptAfterEdit = edits;
      measurements.memory = 'Unavailable: page heap would omit runtime workers and WASM';
    } finally {
      const evidencePath = testInfo.outputPath('runtime-evidence.jsonl');
      await writeFile(evidencePath, await page.getByLabel('Experiment evidence').textContent() ?? '');
      await testInfo.attach('runtime-evidence', { path: evidencePath, contentType: 'text/plain' });
      const measurementsPath = testInfo.outputPath('measurements.json');
      await writeFile(measurementsPath, JSON.stringify(measurements, null, 2));
      await testInfo.attach('measurements', { path: measurementsPath, contentType: 'application/json' });
    }
  });
}
