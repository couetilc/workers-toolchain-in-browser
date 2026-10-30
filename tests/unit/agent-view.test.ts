import { afterEach, expect, it, vi } from 'vitest';
import { mountAgent, transcript } from '../../src/agent-view';
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../../src/agent', () => ({ createAgent: create, proxyStream: vi.fn() }));
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('renders saved and streaming conversation content without executing markup', () => {
  expect(transcript([{ role: 'system', content: 'hidden' }, { role: 'user', content: '<script>literal</script>' }, { role: 'assistant', content: [{ type: 'toolCall', name: 'read_file', arguments: {} }, { type: 'thinking' }] }] as any, { role: 'assistant', content: [{ type: 'text', text: 'streaming' }] } as any)).toBe('user: <script>literal</script>\n\nassistant: read_file {}\n[non-text content]\n\nassistant: streaming');
});
it('runs, streams, cancels, reports errors, and restores session status', async () => {
  document.body.innerHTML = '<section></section>'; const root = document.querySelector('section')!;
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"model":"fixture"}')));
  const pending = Promise.withResolvers<string>(); const engine = { run: vi.fn(() => pending.promise), cancel: vi.fn() };
  create.mockReturnValue(engine);
  const close = mountAgent(root, {} as any, { status: 'interrupted', messages: [] });
  await vi.waitFor(() => expect(root.textContent).toContain('Model: fixture'));
  expect(root.querySelector('[aria-label="Agent status"]')!.textContent).toBe('interrupted');
  const ask = root.querySelector<HTMLButtonElement>('#ask-agent')!, cancel = root.querySelector<HTMLButtonElement>('#cancel-agent')!;
  await ask.onclick!(new PointerEvent('click')); expect(root.textContent).toContain('Enter a request');
  root.querySelector('textarea')!.value = 'Change heading';
  const running = ask.onclick!(new PointerEvent('click'));
  expect(ask.disabled).toBe(true);
  create.mock.calls[0][0].display([], { role: 'assistant', content: [{ type: 'text', text: 'Live text' }] });
  expect(root.querySelector('pre')!.textContent).toContain('Live text');
  cancel.click(); expect(engine.cancel).toHaveBeenCalled();
  pending.resolve('cancelled'); await running; expect(ask.disabled).toBe(false);
  expect(root.querySelector('[aria-label="Agent status"]')!.textContent).toBe('cancelled');
  close();
});
it('keeps the workspace usable when the proxy is unavailable', async () => {
  document.body.innerHTML = '<section></section>'; const root = document.querySelector('section')!;
  vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })));
  create.mockReturnValue({ run: vi.fn(), cancel: vi.fn() });
  const close = mountAgent(root, {} as any, null, vi.fn());
  await vi.waitFor(() => expect(root.textContent).toContain('Model proxy unavailable'));
  expect(root.querySelector('[aria-label="Agent status"]')!.textContent).toBe('ready');
  close();
});
