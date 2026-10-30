import { expect, it, vi } from 'vitest';
import type { AssistantMessage } from '@earendil-works/pi-ai';
import { AssistantMessageEventStream } from '@earendil-works/pi-ai/utils/event-stream';
import { createAgent, proxyStream, model, type AgentHost } from '../../src/agent';
import { openWorkspace } from '../../src/workspace';

const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
function response(content: AssistantMessage['content'], stopReason: Exclude<AssistantMessage['stopReason'], 'pending'> = 'stop') {
  const stream = new AssistantMessageEventStream();
  const message: AssistantMessage = { role: 'assistant', content, stopReason, api: model.api, provider: model.provider, model: model.id, usage, timestamp: Date.now() };
  if (stopReason === 'error') message.errorMessage = 'fixture failure';
  queueMicrotask(() => {
    stream.push({ type: 'start', partial: message });
    if (stopReason === 'error' || stopReason === 'aborted') stream.push({ type: 'error', reason: stopReason, error: message });
    else stream.push({ type: 'done', reason: stopReason, message });
  });
  return stream;
}
async function host(): Promise<AgentHost> {
  return { workspace: await openWorkspace({ read: async () => null, save: async () => {} }, { 'src/App.tsx': 'original unique', 'repeat.ts': 'twice twice' }), canEdit: vi.fn(() => true), changed: vi.fn(async () => {}), build: vi.fn(async () => 1), diagnostics: vi.fn(async () => []), persist: vi.fn(async () => {}), display: vi.fn() };
}
it('runs real Pi orchestration through all browser tools and persists its transcript', async () => {
  const env = await host();
  const steps = [ ['list_files', {}], ['read_file', { path: 'src/App.tsx' }], ['edit_file', { path: 'src/App.tsx', search: 'original', replacement: 'changed', expectedRevision: 0 }], ['diagnostics', { path: 'src/App.tsx' }], ['build', {}] ] as const;
  let index = 0;
  const engine = createAgent(env, () => {
    const step = steps[index++];
    return step ? response([{ type: 'toolCall', id: 'id-' + index, name: step[0], arguments: step[1] }], 'toolUse') : response([{ type: 'text', text: 'Finished' }]);
  }, []);
  expect(await engine.run('Change the project')).toBe('completed');
  expect(env.workspace.snapshot().files['src/App.tsx']).toBe('changed unique');
  expect(env.changed).toHaveBeenCalled(); expect(env.build).toHaveBeenCalled();
  expect(env.persist).toHaveBeenLastCalledWith('completed', engine.agent.state.messages);
  const execute = (name: string, args: unknown, signal?: AbortSignal) => engine.agent.state.tools.find(tool => tool.name === name)!.execute('manual', args, signal);
  await execute('edit_file', { path: 'src/App.tsx', search: 'changed', replacement: '$& literal $1', expectedRevision: 1 });
  expect(env.workspace.snapshot().files['src/App.tsx']).toBe('$& literal $1 unique');
  await expect(execute('read_file', { path: 'missing' })).rejects.toThrow('File not found');
  await expect(execute('edit_file', { path: 'missing', search: 'x' })).rejects.toThrow('exactly once');
  await expect(execute('edit_file', { path: 'src/App.tsx', search: '' })).rejects.toThrow('exactly once');
  await expect(execute('edit_file', { path: 'repeat.ts', search: 'twice' })).rejects.toThrow('exactly once');
  vi.mocked(env.canEdit).mockReturnValue(false);
  await expect(execute('edit_file', {})).rejects.toThrow('Unsaved human edits');
  const aborted = new AbortController(); aborted.abort();
  await expect(execute('edit_file', {}, aborted.signal)).rejects.toThrow();
});
it('records provider errors and persistence errors without claiming completion', async () => {
  const env = await host();
  const engine = createAgent(env, () => response([], 'error'), []);
  expect(await engine.run('Fail')).toBe('failed');
  const broken = await host();
  vi.mocked(broken.persist).mockImplementation(async status => { if (status === 'completed') throw new Error('disk full'); });
  const other = createAgent(broken, () => response([]), []);
  await expect(other.run('Persist')).rejects.toThrow('disk full');
  expect(broken.persist).toHaveBeenLastCalledWith('failed', other.agent.state.messages);
});
it('cancels active inference and rejects concurrent prompts', async () => {
  const env = await host();
  const started = Promise.withResolvers<void>();
  const engine = createAgent(env, (_model, _context, options) => {
    const stream = new AssistantMessageEventStream();
    options!.signal!.addEventListener('abort', () => {
      const message = { role: 'assistant', content: [], api: model.api, provider: model.provider, model: model.id, usage, timestamp: Date.now(), stopReason: 'aborted' } as AssistantMessage;
      stream.push({ type: 'error', reason: 'aborted', error: message });
    });
    started.resolve(); return stream;
  }, []);
  const pending = engine.run('Wait'); await started.promise;
  await expect(engine.run('Other')).rejects.toThrow('already running');
  engine.cancel(); expect(await pending).toBe('cancelled');
});
it('uses Pi proxy transport and exposes HTTP errors as provider failure events', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'fixture proxy failure' }), { status: 503 }));
  try {
    const stream = await proxyStream(model, { messages: [] } as any);
    expect((await stream.result()).stopReason).toBe('error');
  } finally { globalThis.fetch = original; }
});
