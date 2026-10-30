import { expect, it, vi } from 'vitest';
import { createRuntime } from '../../src/runtime';

function fake(autoReady = true) {
  const events = new Map<string, (...args: any[]) => void>();
  const exit = Promise.withResolvers<number>();
  let devOutput!: ReadableStreamDefaultController<string>;
  const runtime = {
    on: vi.fn((event, cb) => { events.set(event, cb); return vi.fn(); }), mount: vi.fn(), teardown: vi.fn(),
    fs: { writeFile: vi.fn(), rm: vi.fn(), mkdir: vi.fn() },
    spawn: vi.fn(async (_: string, args: string[]) => {
      if (args[1] === 'dev' && autoReady) queueMicrotask(() => events.get('server-ready')!(5173, 'https://preview.test'));
      return {
      kill: vi.fn(),
      output: args[1] === 'dev' ? new ReadableStream<string>({ start(c) { devOutput = c; } }) : new ReadableStream<string>({ start(c) { c.enqueue('output'); c.close(); } }),
      exit: args[1] === 'dev' ? exit.promise : Promise.resolve(0),
    }; }),
  };
  return { runtime, events, exit, failOutput: () => devOutput.error('stream failed') };
}

it('mounts once, mirrors only changed files, removes files, builds and forwards preview events', async () => {
  const { runtime, events, exit, failOutput } = fake();
  const preview = vi.fn(), error = vi.fn();
  const client = createRuntime(async () => runtime as any, preview, error);
  const first = { revision: 0, files: { 'src/a.ts': 'a', 'remove.txt': 'old' } };
  await client.start(first); await client.start(first);
  expect(runtime.mount).toHaveBeenCalledOnce();
  events.get('server-ready')!(1234, 'ignored'); expect(preview).toHaveBeenCalledTimes(1);
  events.get('server-ready')!(5173, 'https://preview.test'); expect(preview).toHaveBeenCalledWith('https://preview.test');
  events.get('error')!({ message: 'runtime error' }); expect(error).toHaveBeenCalledWith('runtime error');
  events.get('preview-message')!({ message: 'application error' }); expect(error).toHaveBeenCalledWith('Preview: application error');
  events.get('preview-message')!({ args: ['console error', 42] }); expect(error).toHaveBeenCalledWith('Preview: console error 42');
  expect(await client.build({ revision: 1, files: { 'src/a.ts': 'a', 'nested/new.ts': 'b', 'root.ts': 'c' } })).toBe(1);
  expect(runtime.fs.rm).toHaveBeenCalledWith('remove.txt');
  expect(runtime.fs.writeFile.mock.calls).toEqual([['nested/new.ts', 'b'], ['root.ts', 'c']]);
  failOutput(); await vi.waitFor(() => expect(error).toHaveBeenCalledWith('stream failed'));
  exit.resolve(3); await vi.waitFor(() => expect(error).toHaveBeenCalledWith('Preview server exited 3'));
  client.close(); await expect(client.start(first)).rejects.toThrow('Runtime closed');
});

it('cleans up a late boot and ignores normal exit after closing', async () => {
  const pending = Promise.withResolvers<any>(); const late = fake();
  const client = createRuntime(() => pending.promise, vi.fn(), vi.fn());
  const starting = expect(client.start({ revision: 0, files: {} })).rejects.toThrow('Runtime closed');
  client.close(); pending.resolve(late.runtime); await starting;
  expect(late.runtime.teardown).toHaveBeenCalledOnce();
  const running = fake(), report = vi.fn();
  const second = createRuntime(async () => running.runtime as any, vi.fn(), report);
  await second.start({ revision: 0, files: {} }); second.close(); running.exit.resolve(0);
  await running.exit.promise; expect(report).not.toHaveBeenCalled();
});

it('reports process failures and command stream failures', async () => {
  const { runtime } = fake(); const report = vi.fn();
  runtime.spawn.mockResolvedValueOnce({ kill: vi.fn(), output: new ReadableStream({ start(c) { c.error('broken output'); } }), exit: Promise.resolve(2) });
  const client = createRuntime(async () => runtime as any, vi.fn(), report);
  await expect(client.start({ revision: 0, files: {} })).rejects.toThrow('Toolchain command failed (2)');
  await vi.waitFor(() => expect(report).toHaveBeenCalledWith('broken output'));
  client.close();
});

it('waits for server readiness, reports startup phases, and retries failed startup', async () => {
  const first = fake(false), next = fake();
  const boot = vi.fn().mockResolvedValueOnce(first.runtime).mockResolvedValueOnce(next.runtime);
  const progress = vi.fn(), client = createRuntime(boot, vi.fn(), vi.fn(), progress, 20);
  await expect(client.start({ revision: 0, files: {} })).rejects.toThrow('did not become ready');
  expect(first.runtime.teardown).toHaveBeenCalled();
  // Late events from the failed attempt must not publish into its retry.
  first.events.get('error')!({ message: 'late failure' });
  first.events.get('preview-message')!({ message: 'late preview' });
  first.events.get('server-ready')!(5173, 'https://old.test');
  await client.start({ revision: 0, files: {} });
  expect(progress.mock.calls.map(([value]) => value)).toContain('Installing project dependencies…');
  expect(progress).toHaveBeenLastCalledWith('Preview ready');
  first.exit.resolve(1); client.close();
});
it('fails early exits and boot failures; closing while waiting rejects startup', async () => {
  const unavailable = createRuntime(async () => { throw new Error('boot unavailable'); }, vi.fn(), vi.fn());
  await expect(unavailable.start({ revision: 0, files: {} })).rejects.toThrow('boot unavailable');
  const exiting = fake(false);
  const client = createRuntime(async () => exiting.runtime as any, vi.fn(), vi.fn());
  const failed = expect(client.start({ revision: 0, files: {} })).rejects.toThrow('exited 4');
  await vi.waitFor(() => expect(exiting.runtime.spawn).toHaveBeenCalledTimes(2));
  exiting.exit.resolve(4); await failed;
  const waiting = fake(false);
  const closing = createRuntime(async () => waiting.runtime as any, vi.fn(), vi.fn());
  const closed = expect(closing.start({ revision: 0, files: {} })).rejects.toThrow('Runtime closed');
  await vi.waitFor(() => expect(waiting.runtime.spawn).toHaveBeenCalledTimes(2));
  closing.close(); await closed; expect(waiting.runtime.teardown).toHaveBeenCalledOnce();
});
it('kills cancelled builds and never starts an already cancelled command', async () => {
  const { runtime } = fake(), client = createRuntime(async () => runtime as any, vi.fn(), vi.fn());
  const snapshot = { revision: 0, files: {} }; await client.start(snapshot);
  const already = new AbortController(); already.abort();
  await expect(client.build(snapshot, already.signal)).rejects.toThrow();
  const ending = Promise.withResolvers<number>(), kill = vi.fn(() => ending.resolve(1));
  runtime.spawn.mockResolvedValueOnce({ output: new ReadableStream({ start(c) { c.close(); } }), exit: ending.promise, kill });
  const abort = new AbortController();
  const cancelled = expect(client.build(snapshot, abort.signal)).rejects.toThrow();
  await vi.waitFor(() => expect(runtime.spawn).toHaveBeenCalledTimes(3));
  abort.abort(); await cancelled; expect(kill).toHaveBeenCalledOnce();
  const immediate = new AbortController();
  runtime.spawn.mockImplementationOnce(async () => { immediate.abort(); return { output: new ReadableStream({ start(c) { c.close(); } }), exit: Promise.resolve(1), kill }; });
  await expect(client.build(snapshot, immediate.signal)).rejects.toThrow();
  client.close();
});
