import { test, expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 45_000 });
test.beforeEach(async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Initial full-workspace acceptance is Chromium');
  await page.goto('/workspace/');
  await expect(page.getByRole('status')).toHaveText('Saved · revision 0');
  await expect(page.getByLabel('Model provider')).toHaveText('Model: fixture');
});
test('real Pi uses real tools, SQLite and Vite, then reopens the completed conversation', async ({ page }) => {
  await page.getByLabel('Agent request').fill('Change the heading and verify the project');
  await page.getByRole('button', { name: 'Ask Pi', exact: true }).click();
  await expect(page.getByLabel('Agent status')).toHaveText('completed');
  await expect(page.getByRole('textbox', { name: 'File contents' })).toContainText('Changed by Pi');
  await expect(page.frameLocator('iframe[title="Project preview"]').getByRole('heading')).toHaveText('Changed by Pi');
  const conversation = page.getByLabel('Conversation');
  for (const tool of ['list_files', 'read_file', 'edit_file', 'diagnostics', 'build']) await expect(conversation).toContainText(tool);
  await page.reload();
  await expect(page.getByRole('status')).toHaveText('Saved · revision 1');
  await expect(page.getByLabel('Agent status')).toHaveText('completed');
  await expect(page.getByLabel('Conversation')).toContainText('Fixture run finished');
  await expect(page.getByRole('textbox', { name: 'File contents' })).toContainText('Changed by Pi');
});
test('tool failures and human revision conflicts do not overwrite user edits', async ({ page }) => {
  await page.getByLabel('Agent request').fill('tool error');
  await page.getByRole('button', { name: 'Ask Pi', exact: true }).click();
  await expect(page.getByLabel('Agent status')).toHaveText('completed');
  await expect(page.getByLabel('Conversation')).toContainText('File not found');
  await page.getByLabel('Agent request').fill('conflict');
  await page.getByRole('button', { name: 'Ask Pi', exact: true }).click();
  await expect(page.getByLabel('Conversation')).toContainText('"contents"');
  await page.getByRole('combobox', { name: 'File', exact: true }).selectOption('src/message.ts');
  await page.getByRole('textbox', { name: 'File contents' }).fill("export const message: string = 'Human edit';");
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved · revision 1');
  await expect(page.getByLabel('Agent status')).toHaveText('completed');
  await expect(page.getByLabel('Conversation')).toContainText('Revision conflict');
  await expect(page.getByRole('textbox', { name: 'File contents' })).toContainText('Human edit');
});
test('cancels streaming inference and persists cancellation', async ({ page }) => {
  await page.getByLabel('Agent request').fill('slow');
  await page.getByRole('button', { name: 'Ask Pi', exact: true }).click();
  await expect(page.getByLabel('Conversation')).toContainText('Waiting for fixture');
  await page.getByRole('button', { name: 'Cancel agent', exact: true }).click();
  await expect(page.getByLabel('Agent status')).toHaveText('cancelled');
  await page.reload(); await expect(page.getByLabel('Agent status')).toHaveText('cancelled');
});
test('reports streaming failures and marks a reloaded active run interrupted', async ({ page }) => {
  await page.getByLabel('Agent request').fill('stream error');
  await page.getByRole('button', { name: 'Ask Pi', exact: true }).click();
  await expect(page.getByLabel('Agent status')).toHaveText('failed');
  await page.getByLabel('Agent request').fill('slow');
  await page.getByRole('button', { name: 'Ask Pi', exact: true }).click();
  await expect(page.getByLabel('Conversation')).toContainText('Waiting for fixture');
  await page.reload(); await expect(page.getByLabel('Agent status')).toHaveText('interrupted');
  await expect(page.getByRole('textbox', { name: 'File contents' })).toContainText('Browser-built React');
});
test('visible proxy API rejects requests from unapproved origins', async ({ request }) => {
  const denied = await request.post('/api/stream', { headers: { Origin: 'https://unrelated.test', Authorization: 'Bearer local-prototype' }, data: { context: { messages: [] } } });
  expect(denied.status()).toBe(403);
  const config = await request.get('/api/config');
  expect(await config.json()).toEqual({ model: 'fixture' });
});
