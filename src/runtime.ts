import type { WebContainer } from '@webcontainer/api';
import { fileTree } from '../experiments/e01-vite-runtime/src/fixture';
import type { Snapshot } from './workspace';

type Runtime = Pick<WebContainer, 'mount' | 'spawn' | 'fs' | 'on' | 'teardown'>;
export function createRuntime(boot: () => Promise<Runtime>, preview: (url: string) => void, error: (message: string) => void, progress: (message: string) => void = () => {}, readinessTimeoutMs = 120_000) {
  let runtime: Runtime | undefined;
  let startup: Promise<void> | undefined;
  let mirrored: Record<string, string> = {};
  let closed = false;
  let generation = 0;
  let rejectReady: ((error: Error) => void) | undefined;
  const off: (() => void)[] = [];
  async function run(args: string[], signal?: AbortSignal) {
    signal?.throwIfAborted();
    const process = await runtime!.spawn('npm', args);
    let output = '';
    void process.output.pipeTo(new WritableStream({ write(chunk) { output = (output + chunk).slice(-4000); } })).catch(reason => error(String(reason)));
    const kill = () => process.kill();
    signal?.addEventListener('abort', kill, { once: true });
    if (signal?.aborted) kill();
    let code: number;
    try { code = await process.exit; } finally { signal?.removeEventListener('abort', kill); }
    signal?.throwIfAborted();
    if (code !== 0) throw new Error(`Toolchain command failed (${code}): ${output}`);
  }
  async function start(snapshot: Snapshot) {
    if (closed) throw new Error('Runtime closed');
    if (!startup) startup = (async () => {
      const attempt = ++generation;
      progress('Starting browser runtime…');
      runtime = await boot();
      if (closed) throw new Error('Runtime closed');
      const ready = Promise.withResolvers<void>();
      rejectReady = ready.reject;
      // A failure can arrive during mount/install, before we reach the readiness wait.
      void ready.promise.catch(() => {});
      off.push(runtime.on('server-ready', (port, url) => { if (attempt === generation && port === 5173) { preview(url); ready.resolve(); } }));
      off.push(runtime.on('error', event => { if (attempt !== generation) return; error(event.message); ready.reject(new Error(event.message)); }));
      off.push(runtime.on('preview-message', event => { if (attempt === generation) error('Preview: ' + ('message' in event ? event.message : event.args.map(String).join(' '))); }));
      await runtime.mount(fileTree(snapshot.files));
      mirrored = { ...snapshot.files };
      progress('Installing project dependencies…');
      await run(['ci', '--no-audit', '--no-fund']);
      progress('Starting preview server…');
      const process = await runtime.spawn('npm', ['run', 'dev']);
      void process.output.pipeTo(new WritableStream()).catch(reason => error(String(reason)));
      void process.exit.then(code => { if (attempt === generation && !closed) { const message = `Preview server exited ${code}`; error(message); ready.reject(new Error(message)); } });
      const timeout = setTimeout(() => ready.reject(new Error('Preview did not become ready. Try Start preview again.')), readinessTimeoutMs);
      try { await ready.promise; } finally { clearTimeout(timeout); }
      progress('Preview ready');
    })();
    try { await startup; } catch (error) {
      generation++;
      off.splice(0).forEach(unsubscribe => unsubscribe());
      runtime?.teardown(); runtime = undefined; startup = undefined;
      throw error;
    }
  }
  async function sync(snapshot: Snapshot) {
    await start(snapshot);
    for (const path of Object.keys(mirrored)) {
      if (!(path in snapshot.files)) await runtime!.fs.rm(path);
    }
    for (const [path, contents] of Object.entries(snapshot.files)) {
      if (mirrored[path] === contents) continue;
      const slash = path.lastIndexOf('/');
      if (slash !== -1) await runtime!.fs.mkdir(path.slice(0, slash), { recursive: true });
      await runtime!.fs.writeFile(path, contents);
    }
    mirrored = { ...snapshot.files };
  }
  return {
    start, sync,
    async build(snapshot: Snapshot, signal?: AbortSignal) { await sync(snapshot); await run(['run', 'build'], signal); return snapshot.revision; },
    close() { closed = true; generation++; rejectReady?.(new Error('Runtime closed')); off.splice(0).forEach(unsubscribe => unsubscribe()); runtime?.teardown(); runtime = undefined; },
  };
}
