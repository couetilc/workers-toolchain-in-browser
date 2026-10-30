import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('actual browser Vite renders, updates and builds the React project', async ({ page, request }, testInfo) => {
  const observations: unknown[] = [];
  page.on('request', req => observations.push({ kind: 'request', method: req.method(), url: req.url() }));
  page.on('requestfailed', req => observations.push({ kind: 'requestfailed', url: req.url(), failure: req.failure() }));
  page.on('console', msg => observations.push({ kind: 'console', type: msg.type(), text: msg.text() }));
  page.on('pageerror', error => observations.push({ kind: 'pageerror', message: error.message }));
  try {
    const response = await request.get('/');
    expect(response.headers()['cross-origin-opener-policy']).toBe('same-origin');
    expect(response.headers()['cross-origin-embedder-policy']).toBe('require-corp');
    await page.goto('/');
    await page.getByRole('button', { name: 'Start runtime', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Ready on port 5173');
    const preview = page.frameLocator('iframe[title="Project preview"]');
    await expect(preview.getByRole('heading')).toHaveText('Browser-built React');
    await preview.getByRole('button', { name: 'Count: 0' }).click();
    await page.getByRole('button', { name: 'Change component', exact: true }).click();
    await expect(preview.getByRole('heading')).toHaveText('Edited inside browser');
    await expect(preview.getByRole('button', { name: 'Count: 1' })).toBeVisible();
    await page.getByRole('button', { name: 'Change import', exact: true }).click();
    await expect(preview.getByText('Updated imported value')).toBeVisible();
    await page.getByRole('button', { name: 'Change CSS', exact: true }).click();
    await expect(preview.locator('body')).toHaveCSS('color', 'rgb(120, 20, 40)');
    await preview.getByRole('button', { name: 'Load module' }).click();
    await expect(preview.getByText('Dynamic import loaded')).toBeVisible();
    await page.getByRole('button', { name: 'Break syntax', exact: true }).click();
    await expect(preview.locator('vite-error-overlay')).toBeVisible();
    await page.getByRole('button', { name: 'Fix syntax', exact: true }).click();
    await expect(preview.locator('vite-error-overlay')).toHaveCount(0);
    await expect(preview.getByRole('heading')).toHaveText('Browser-built React');
    await preview.getByRole('button', { name: 'Throw error' }).click();
    await expect(page.getByLabel('Experiment evidence')).toContainText('Fixture runtime error');
    await page.getByRole('button', { name: 'Build defaults', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Ready on port 4173', { timeout: 30_000 });
    await expect(preview.getByRole('heading')).toHaveText('Browser-built React');
  } finally {
    const evidencePath = testInfo.outputPath('runtime-evidence.jsonl');
    await writeFile(evidencePath, await page.getByLabel('Experiment evidence').textContent() ?? '');
    await testInfo.attach('runtime-evidence', { path: evidencePath, contentType: 'text/plain' });
    const networkPath = testInfo.outputPath('network-and-console.json');
    await writeFile(networkPath, JSON.stringify(observations, null, 2));
    await testInfo.attach('network-and-console', { path: networkPath, contentType: 'application/json' });
  }
});
