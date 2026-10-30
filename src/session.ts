import { rpc } from './rpc';
import { acquireLease } from './lease';
import { openWorkspace } from './workspace';
import { initialFiles } from './initial';

export async function openSession() {
  const release = await acquireLease('browser-workspace-v1');
  const storage = rpc(new Worker(new URL('./storage.worker.ts', import.meta.url), { type: 'module' }));
  const compiler = rpc(new Worker(new URL('./typescript.worker.ts', import.meta.url), { type: 'module' }));
  const close = () => { storage.close(); compiler.close(); release(); };
  try {
    await storage.call('open', 'browser-workspace-v1');
    const workspace = await openWorkspace({
      read: () => storage.call('read', null),
      save: (expected, snapshot) => storage.call('save', { expected, snapshot }),
    }, initialFiles);
    return { workspace, compiler, storage, close };
  } catch (error) { close(); throw error; }
}
export type Session = Awaited<ReturnType<typeof openSession>>;
