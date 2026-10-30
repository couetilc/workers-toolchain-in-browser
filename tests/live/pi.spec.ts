import { test, expect } from '@playwright/test';

test('free live provider edits, checks and builds through browser Pi', async ({ page }, testInfo) => {
  await page.goto('/workspace/');
  await expect(page.getByRole('status')).toHaveText('Saved · revision 0');
  await expect(page.getByLabel('Model provider')).toContainText('Model:');
  await page.getByLabel('Agent request').fill('Read src/App.tsx with read_file. Use edit_file to replace the exact text Browser-built React with Live Pi verified, using the revision returned by read_file. Do not change any other text or file. Then use diagnostics for src/App.tsx and build once. Stop and briefly report the result. Use the tools rather than describing what I should do.');
  await page.getByRole('button', { name: 'Ask Pi', exact: true }).click();
  try {
    await expect(page.getByLabel('Agent status')).toHaveText('completed', { timeout: 210_000 });
    await expect(page.getByRole('textbox', { name: 'File contents' })).toContainText('Live Pi verified');
    await expect(page.frameLocator('iframe[title="Project preview"]').getByRole('heading')).toHaveText('Live Pi verified');
    const conversation = page.getByLabel('Conversation');
    for (const name of ['read_file', 'edit_file', 'diagnostics', 'build']) await expect(conversation).toContainText(name);
    await page.reload();
    await expect(page.getByRole('status')).toHaveText('Saved · revision 1');
    await expect(page.getByLabel('Agent status')).toHaveText('completed');
    await expect(page.getByRole('textbox', { name: 'File contents' })).toContainText('Live Pi verified');
  } finally {
    await testInfo.attach('live-conversation', { body: await page.getByLabel('Conversation').innerText(), contentType: 'text/plain' });
    await page.screenshot({ path: testInfo.outputPath('live-workspace.png'), fullPage: true });
  }
});
