import { test, expect } from '@playwright/test';

test('browser TypeScript diagnoses and navigates the TSX project without a server compiler', async ({ page }, testInfo) => {
  await page.goto('/experiments/e02-typescript/');
  const results = page.getByLabel('TypeScript results');
  await page.getByRole('button', { name: 'Analyze project', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('1 diagnostics');
  let data = JSON.parse((await results.textContent())!);
  expect(data.version).toBe('6.0.3');
  expect(data.diagnostics[0].code).toBe(2322);
  expect(data.symbol.definitions[0].fileName).toBe('/src/values.ts');
  expect(data.symbol.hover.displayParts.map((part: {text: string}) => part.text).join('')).toContain('count: string');
  expect(data.members.completions.entries.map((entry: {name: string}) => entry.name)).toEqual(['enabled', 'title']);
  await testInfo.attach('initial-typescript-results', { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
  // Once loaded, updates and analysis must work with all network access disabled.
  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Fix imported type', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('0 diagnostics');
  data = JSON.parse((await results.textContent())!);
  expect(data.symbol.hover.displayParts.map((part: {text: string}) => part.text).join('')).toContain('count: number');
  await page.getByRole('button', { name: 'Restore type error', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('1 diagnostics');
});
