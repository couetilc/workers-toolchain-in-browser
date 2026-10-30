import { expect, it, vi } from 'vitest';
import { initSqlite } from '../../src/sqlite';
import { database } from '../../src/database';
import { acquireLease } from '../../src/lease';
import { testWorker } from '../helpers/worker';

it('uses real SQLite transactions for revisions, rollback, storage errors, and interrupted sessions', async () => {
  const sqlite = await initSqlite();
  const db = new sqlite.oo1.DB();
  const store = database(db);
  expect(store.read()).toBeNull(); expect(store.session()).toBeNull();
  store.save(-1, { revision: 0, files: { 'a.txt': 'original' } });
  expect(() => store.save(4, { revision: 5, files: {} })).toThrow('Storage revision conflict');
  expect(() => store.save(0, { revision: 4, files: {} })).toThrow('Storage revision conflict');
  expect(() => store.save(0, { revision: 1, files: { 'a.txt': 'changed', '../invalid': 'bad' } })).toThrow('Invalid workspace path');
  expect(store.read()).toEqual({ revision: 0, files: { 'a.txt': 'original' } });
  db.exec('PRAGMA query_only=ON');
  expect(() => store.save(0, { revision: 1, files: {} })).toThrow();
  db.exec('PRAGMA query_only=OFF');
  expect(store.read()!.revision).toBe(0);
  store.save(0, { revision: 1, files: {} });
  store.saveSession('running', [{ role: 'user', text: 'do not replay' }]);
  expect(database(db).session()).toEqual({ status: 'interrupted', messages: [{ role: 'user', text: 'do not replay' }] });
  expect(() => store.saveSession('invalid', [])).toThrow();
  db.exec('PRAGMA user_version=2');
  expect(() => database(db)).toThrow('newer');
  store.close();
});

it('persists real OPFS files across worker termination and reopening', async () => {
  const name = 'test-' + crypto.randomUUID();
  const url = new URL('../fixtures/storage-worker.ts', import.meta.url);
  let client = testWorker(url);
  try {
    await expect(client.call('read', null)).rejects.toThrow('Storage not open');
    await expect(client.call('open', '../invalid')).rejects.toThrow('Invalid storage name');
    expect(await client.call('open', name)).toBe('3.54.1');
    await expect(client.call('open', name)).rejects.toThrow('already open');
    await expect(client.call('unknown', null)).rejects.toThrow('Unknown storage operation');
    expect(await client.call('read', null)).toBeNull();
    await client.call('save', { expected: -1, snapshot: { revision: 0, files: { 'hello.txt': 'persistent' } } });
    await client.call('saveSession', { status: 'running', messages: ['interrupted operation'] });
    // Abrupt termination after acknowledged writes: no graceful database close.
    client.close();
    client = testWorker(url);
    await client.call('open', name);
    expect(await client.call('read', null)).toEqual({ revision: 0, files: { 'hello.txt': 'persistent' } });
    expect(await client.call('session', null)).toEqual({ status: 'interrupted', messages: ['interrupted operation'] });
    await client.call('close', null);
  } finally { client.close(); }
});

it('rejects a second editing owner and releases ownership explicitly', async () => {
  const name = 'lease-' + crypto.randomUUID();
  const release = await acquireLease(name);
  await expect(acquireLease(name)).rejects.toThrow('another tab');
  release();
  await vi.waitFor(async () => { const again = await acquireLease(name); again(); });
  await expect(acquireLease(name, { request: () => Promise.reject(new Error('storage blocked')) } as unknown as LockManager)).rejects.toThrow('storage blocked');
});
