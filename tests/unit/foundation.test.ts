import { expect, it, vi } from 'vitest';
import { openWorkspace, validatePath, type Snapshot } from '../../src/workspace';
import { latestQueue } from '../../src/queue';
import { rpc, serve, type Port } from '../../src/rpc';
import { testWorker } from '../helpers/worker';
import { projectFiles } from '../../experiments/e02-typescript/src/assets';

it('commits complete immutable revisions, rejects conflicts, and recovers after storage failure', async () => {
  let saved: Snapshot | null = null;
  const storage = { read: vi.fn(async () => saved), save: vi.fn(async (_expected: number, value: Snapshot) => { saved = value; }) };
  const workspace = await openWorkspace(storage, { 'src/a.ts': 'a', 'delete.txt': 'old' });
  const external = workspace.snapshot(); external.files['src/a.ts'] = 'mutated';
  expect(workspace.snapshot().files['src/a.ts']).toBe('a');
  await expect(workspace.commit(4, {})).rejects.toThrow('Revision conflict');
  await expect(workspace.commit(0, { '../escape': 'bad' })).rejects.toThrow('Invalid workspace path');
  storage.save.mockRejectedValueOnce(new Error('disk full'));
  await expect(workspace.commit(0, { 'src/a.ts': 'not saved' })).rejects.toThrow('disk full');
  expect(workspace.snapshot().revision).toBe(0);
  const first = workspace.commit(0, { 'src/a.ts': 'updated', 'delete.txt': null });
  const conflict = expect(workspace.commit(0, { 'second.txt': 'stale' })).rejects.toThrow('Revision conflict');
  expect(await first).toEqual({ revision: 1, files: { 'src/a.ts': 'updated' } });
  await conflict;
  expect((await openWorkspace(storage, {})).snapshot()).toEqual(workspace.snapshot());
});

it.each(['/root', '../bad', 'a/../b', 'a\\b', 'a//b', 'node_modules/x', 'dist/a', './a'])('rejects path %s', path => expect(() => validatePath(path)).toThrow());
it('does not initialize invalid projects', async () => {
  await expect(openWorkspace({ read: async () => null, save: vi.fn() }, { '..': 'invalid' })).rejects.toThrow('Invalid workspace path');
});

it('bounds pending work, rejects stale results, and continues after task errors', async () => {
  const calls: number[] = [];
  const blocker = Promise.withResolvers<number>();
  const queue = latestQueue(async (value: number) => { calls.push(value); if (value === 1) return blocker.promise; if (value === 4) throw new Error('task failed'); return value * 2; });
  const first = expect(queue.submit(1)).rejects.toThrow('superseded');
  const replaced = expect(queue.submit(2)).rejects.toThrow('superseded');
  const last = queue.submit(3);
  blocker.resolve(2);
  await Promise.all([first, replaced]);
  expect(await last).toBe(6);
  expect(calls).toEqual([1, 3]);
  await expect(queue.submit(4)).rejects.toThrow('task failed');
  expect(await queue.submit(5)).toBe(10);
  queue.cancel();
});

it('cancels running and pending jobs even if the running task ignores abort', async () => {
  const blocker = Promise.withResolvers<number>();
  let signal!: AbortSignal;
  const queue = latestQueue(async (_: number, s) => { signal = s; return blocker.promise; });
  const first = expect(queue.submit(1)).rejects.toThrow('cancelled');
  const second = expect(queue.submit(2)).rejects.toThrow('cancelled');
  queue.cancel();
  expect(signal.aborted).toBe(true);
  await Promise.all([first, second]);
  blocker.resolve(1);
  await vi.waitFor(() => expect(signal.aborted).toBe(true));
});

it('rejects worker errors, unknown replies, closed requests, and synchronous transport failures', async () => {
  const port: Port = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() };
  const client = rpc(port);
  port.onmessage!(new MessageEvent('message', { data: { id: 999 } }));
  const pending = expect(client.call('test', {})).rejects.toThrow('crash');
  port.onerror!(new ErrorEvent('error', { message: 'crash' }));
  await pending;
  await expect(client.call('test', {})).rejects.toThrow('Worker closed');
  client.close();
  const failing = rpc({ ...port, postMessage() { throw new Error('cannot clone'); } });
  await expect(failing.call('test', {})).rejects.toThrow('cannot clone');
  failing.close();
});

it('serializes async worker operations and returns thrown errors without stopping the server', async () => {
  const scope = { onmessage: null, postMessage: vi.fn() } as unknown as Worker;
  const blocker = Promise.withResolvers<string>();
  const calls: string[] = [];
  serve(async method => { calls.push(method); if (method === 'fail') throw new Error('broken'); return blocker.promise; }, scope);
  scope.onmessage!(new MessageEvent('message', { data: { id: 1, method: 'wait' } }));
  scope.onmessage!(new MessageEvent('message', { data: { id: 2, method: 'fail' } }));
  await vi.waitFor(() => expect(calls).toEqual(['wait']));
  blocker.resolve('done');
  await vi.waitFor(() => expect(scope.postMessage).toHaveBeenCalledWith({ id: 2, error: 'Error: broken' }));
  expect(scope.postMessage).toHaveBeenCalledWith({ id: 1, value: 'done' });
});

it('rejects outstanding RPC calls when a real browser worker crashes', async () => {
  const worker = new Worker(new URL('../fixtures/crash-worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('error', event => event.preventDefault());
  const client = rpc(worker);
  try {
    await expect(client.call('crash', null)).rejects.toThrow('Intentional worker crash');
    await expect(client.call('after crash', null)).rejects.toThrow('Worker closed');
  } finally { client.close(); }
});

it('runs real TypeScript in a worker and enforces revision boundaries', async () => {
  const client = testWorker(new URL('../fixtures/typescript-worker.ts', import.meta.url));
  try {
    await expect(client.call('diagnostics', {})).rejects.toThrow('not initialized');
    const files = Object.fromEntries(Object.entries(projectFiles).map(([path, contents]) => [path.slice(1), contents]));
    files['package.json'] = '{}'; files['src/style.css'] = 'body{}';
    expect(await client.call('sync', { revision: 1, files })).toBe(1);
    const diagnostics = await client.call<any[]>('diagnostics', { revision: 1, path: 'src/Counter.tsx' });
    expect(diagnostics[0].code).toBe(2322);
    const query = await client.call<any>('query', { revision: 1, path: 'src/Counter.tsx', position: files['src/Counter.tsx'].indexOf('= count') + 3 });
    expect(query.definitions[0].fileName).toBe('/src/values.ts');
    await expect(client.call('sync', { revision: 0, files })).rejects.toThrow('Stale snapshot');
    await expect(client.call('query', { revision: 0 })).rejects.toThrow('Stale query');
    await expect(client.call('unknown', { revision: 1 })).rejects.toThrow('Unknown TypeScript operation');
    files['src/values.ts'] = files['src/values.ts'].replace("string = 'one'", 'number = 1');
    await client.call('sync', { revision: 2, files });
    expect(await client.call('diagnostics', { revision: 2, path: 'src/Counter.tsx' })).toEqual([]);
    files['src/added.ts'] = 'export const added = 1;';
    await client.call('sync', { revision: 3, files });
    expect(await client.call('diagnostics', { revision: 3, path: 'src/added.ts' })).toEqual([]);
    delete files['src/added.ts'];
    await client.call('sync', { revision: 4, files });
    expect(await client.call('diagnostics', { revision: 4, path: 'src/Counter.tsx' })).toEqual([]);
  } finally { client.close(); }
});
