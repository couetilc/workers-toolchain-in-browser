import { createService } from '../experiments/e02-typescript/src/service';
import { libraryFiles, declarationFiles } from '../experiments/e02-typescript/src/assets';
import { serve } from './rpc';
import type { Snapshot } from './workspace';

let service: ReturnType<typeof createService> | undefined;
let snapshot: Snapshot | undefined;
let mirrored: Record<string, string> = {};
serve((method, payload) => {
  if (method === 'sync') {
    const next = payload as Snapshot;
    if (snapshot && next.revision < snapshot.revision) throw new Error('Stale snapshot');
    const files = Object.fromEntries(Object.entries(next.files).filter(([path]) => path.startsWith('src/') && /\.tsx?$/.test(path)).map(([path, contents]) => ['/' + path, contents]));
    if (!service || Object.keys(files).sort().join('\n') !== Object.keys(mirrored).sort().join('\n')) {
      service?.dispose();
      service = createService(libraryFiles, declarationFiles, files);
    } else {
      for (const [path, contents] of Object.entries(files)) if (contents !== mirrored[path]) service.update(path, contents);
    }
    mirrored = files;
    snapshot = next;
    return next.revision;
  }
  if (!service || !snapshot) throw new Error('TypeScript workspace not initialized');
  if (payload.revision !== snapshot.revision) throw new Error('Stale query');
  if (method === 'diagnostics') return service.diagnostics('/' + payload.path);
  if (method === 'query') return service.query('/' + payload.path, payload.position);
  throw new Error(`Unknown TypeScript operation: ${method}`);
}, self as unknown as Worker);
