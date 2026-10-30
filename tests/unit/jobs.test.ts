import { expect, it, vi } from 'vitest';
import { serialJobs } from '../../src/jobs';

it('joins duplicate requests, serializes related work, and continues after failure', async () => {
  const hold = Promise.withResolvers<number>(), changes = vi.fn(), execute = vi.fn(async (task: number) => {
    if (task === 0) return hold.promise;
    if (task === 2) throw new Error('failed build');
    return task;
  });
  const jobs = serialJobs(execute, changes);
  const start = jobs.submit('start:0', 0);
  expect(jobs.submit('start:0', 0)).toBe(start);
  const build = jobs.submit('build:0', 1);
  expect(jobs.submit('build:0', 1)).toBe(build);
  expect(execute).toHaveBeenCalledTimes(1);
  hold.resolve(0); expect(await start).toBe(0); expect(await build).toBe(1);
  await expect(jobs.submit('build:1', 2)).rejects.toThrow('failed build');
  expect(await jobs.submit('retry', 3)).toBe(3);
  expect(changes.mock.calls.filter(([event]) => event.key === 'start:0').map(([event]) => event.state)).toEqual(['queued', 'running', 'succeeded']);
});
it('cancels only matching jobs, retains a running slot until settled, and bounds the queue', async () => {
  const hold = Promise.withResolvers<void>(), changes = vi.fn();
  const jobs = serialJobs(async () => hold.promise, changes);
  const start = jobs.submit('start', 'start');
  const build = expect(jobs.submit('build', 'build')).rejects.toThrow();
  const sync = jobs.submit('sync', 'sync');
  jobs.cancel(task => task === 'build'); await build;
  jobs.cancel(task => task === 'missing');
  const cancelled = expect(start).rejects.toThrow();
  jobs.cancel(task => task === 'start');
  expect(changes.mock.calls.at(-1)![0].state).toBe('cancelling');
  hold.resolve(); await cancelled; await sync;
  jobs.cancel(() => true);
  const second = serialJobs(async () => new Promise(() => {}), vi.fn());
  void second.submit('running', 0);
  for (let i = 0; i < 8; i++) void second.submit('pending'+i, i);
  await expect(second.submit('overflow', 9)).rejects.toThrow('queue is full');
});
