import { initSqlite } from './sqlite';
import { database } from './database';
import { serve } from './rpc';

let store: ReturnType<typeof database> | undefined;
serve(async (method, payload) => {
  if (method === 'open') {
    if (store) throw new Error('Storage already open');
    if (!/^[a-z0-9-]+$/.test(payload)) throw new Error('Invalid storage name');
    const sqlite = await initSqlite();
    const pool = await sqlite.installOpfsSAHPoolVfs({ name: payload, directory: '/' + payload, preserveOnInitFailure: true });
    store = database(new pool.OpfsSAHPoolDb('/workspace.sqlite3'));
    return sqlite.version.libVersion;
  }
  if (!store) throw new Error('Storage not open');
  if (method === 'read') return store.read();
  if (method === 'save') return store.save(payload.expected, payload.snapshot);
  if (method === 'session') return store.session();
  if (method === 'saveSession') return store.saveSession(payload.status, payload.messages);
  if (method === 'close') { store.close(); store = undefined; return; }
  throw new Error(`Unknown storage operation: ${method}`);
}, self as unknown as Worker);
