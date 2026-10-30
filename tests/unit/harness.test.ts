import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Boot } from '../../experiments/e01-vite-runtime/src/harness';
import { mountHarness } from '../../experiments/e01-vite-runtime/src/harness';
import { fileTree } from '../../experiments/e01-vite-runtime/src/fixture';

const { mockBoot } = vi.hoisted(() => ({ mockBoot: vi.fn() }));
vi.mock('@webcontainer/api', () => ({ WebContainer: { boot: mockBoot } }));

const files = {
  'vite.config.ts': 'export default { plugins: [] };',
  'src/App.tsx': 'export default () => <h1>Browser-built React</h1>;',
  'src/message.ts': 'export const message = "original";',
};
let dispose: () => void;
afterEach(() => { dispose?.(); document.body.replaceChildren(); vi.restoreAllMocks(); });

function fakeRuntime() {
  const events = new Map<string, (...args: any[]) => void>();
  const dev = Promise.withResolvers<number>();
  const preview = Promise.withResolvers<number>();
  const runtime = {
    mount: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, callback: (...args: any[]) => void) => {
      events.set(event, callback);
      return vi.fn(() => events.delete(event));
    }),
    teardown: vi.fn(),
    fs: {
      writeFile: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue(['index.html', 'assets']),
    },
    spawn: vi.fn(async (_command: string, args: string[]) => ({
      output: new ReadableStream<string>({ start(controller) { controller.enqueue('runtime output'); controller.close(); } }),
      exit: args[1] === 'dev' ? dev.promise : args[1] === 'preview' ? preview.promise : Promise.resolve(0),
    })),
  };
  return { runtime, events, dev, preview };
}

function setup(boot: Boot) {
  const root = document.createElement('main');
  document.body.append(root);
  dispose = mountHarness(root, boot, files);
  const click = async (id: string) => {
    const button = root.querySelector<HTMLButtonElement>(`#${id}`)!;
    await button.onclick!(new PointerEvent('click'));
  };
  return {
    root, click,
    status: () => root.querySelector('[role=status]')!.textContent,
    evidence: () => root.querySelector('pre')!.textContent,
  };
}

describe('browser runtime experiment', () => {
  it('mounts exact files, preserves shared directories, and accepts an empty tree', () => {
    expect(fileTree({})).toEqual({});
    expect(fileTree({ 'a/b.ts': 'one', 'a/c.ts': 'two', 'root.txt': 'three' })).toEqual({
      a: { directory: { 'b.ts': { file: { contents: 'one' } }, 'c.ts': { file: { contents: 'two' } } } },
      'root.txt': { file: { contents: 'three' } },
    });
  });

  it('runs the project in the injected runtime and exposes edits, errors, and repeat builds', async () => {
    const { runtime, events, dev, preview } = fakeRuntime();
    const view = setup(async () => runtime as unknown as Awaited<ReturnType<Boot>>);
    expect(view.status()).toBe('Not started');
    expect(view.root.querySelector<HTMLButtonElement>('#change')!.disabled).toBe(true);
    await view.click('start');
    expect(runtime.mount).toHaveBeenCalledWith(fileTree(files));
    expect(runtime.spawn.mock.calls.map(call => call[1])).toEqual([
      ['-p', 'JSON.stringify(process.versions)'], ['ci', '--no-audit', '--no-fund'], ['ls', '--depth=0'], ['run', 'dev'],
    ]);
    expect(view.status()).toBe('Starting Vite in browser');
    events.get('server-ready')!(5173, 'https://fixture.example.test');
    expect(view.root.querySelector('iframe')!.src).toBe('https://fixture.example.test/');
    expect(view.status()).toBe('Ready on port 5173');
    for (const action of ['change', 'imported', 'css', 'break', 'fix']) await view.click(action);
    expect(runtime.fs.writeFile.mock.calls).toEqual([
      ['src/App.tsx', files['src/App.tsx'].replace('Browser-built React', 'Edited inside browser')],
      ['src/message.ts', "export const message: string = 'Updated imported value';"],
      ['src/style.css', 'body { color: rgb(120, 20, 40); }'],
      ['src/App.tsx', 'export default function App( {'],
      ['src/App.tsx', files['src/App.tsx']],
    ]);
    await view.click('build');
    events.get('server-ready')!(5173, 'https://ignored.example.test');
    expect(view.status()).toBe('Building project in browser');
    events.get('server-ready')!(4173, 'https://production.example.test');
    expect(view.status()).toBe('Ready on port 4173');
    await view.click('build');
    expect(runtime.spawn.mock.calls.filter(call => call[1][1] === 'preview')).toHaveLength(1);
    expect(view.root.querySelector('iframe')!.src).toBe('https://production.example.test/');
    expect(view.evidence()).toContain('index.html');
    events.get('preview-message')!({ message: 'preview error' });
    expect(view.evidence()).toContain('preview error');
    events.get('error')!({ message: 'runtime crashed' });
    expect(view.status()).toBe('Failed: runtime crashed');
    dev.resolve(2);
    await vi.waitFor(() => expect(view.status()).toBe('Failed: Vite server exited 2'));
    preview.resolve(3);
    await vi.waitFor(() => expect(view.status()).toBe('Failed: Preview server exited 3'));
  });

  it('reports boot errors and does not expose actions for an unavailable runtime', async () => {
    const view = setup(async () => { throw new Error('boot unavailable'); });
    await view.click('start');
    expect(view.status()).toBe('Failed: boot unavailable');
    expect(view.root.querySelector<HTMLButtonElement>('#change')!.disabled).toBe(true);
  });

  it('reports nonzero command exit codes before starting Vite', async () => {
    const { runtime } = fakeRuntime();
    runtime.spawn.mockResolvedValueOnce({ output: new ReadableStream({ start(c) { c.close(); } }), exit: Promise.resolve(7) });
    const view = setup(async () => runtime as unknown as Awaited<ReturnType<Boot>>);
    await view.click('start');
    expect(view.status()).toContain('exited 7');
    expect(runtime.spawn).toHaveBeenCalledTimes(1);
  });

  it('finishes commands whose stdout remains open after exit and continues collecting output', async () => {
    const { runtime } = fakeRuntime();
    let output!: ReadableStreamDefaultController<string>;
    runtime.spawn.mockResolvedValueOnce({ output: new ReadableStream({ start(c) { output = c; } }), exit: Promise.resolve(0) });
    const view = setup(async () => runtime as unknown as Awaited<ReturnType<Boot>>);
    await view.click('start');
    expect(view.status()).toBe('Starting Vite in browser');
    output.enqueue('late process output');
    await vi.waitFor(() => expect(view.evidence()).toContain('late process output'));
    output.error(new Error('output disconnected'));
    await vi.waitFor(() => expect(view.status()).toBe('Failed: output disconnected'));
  });

  it('reports failed edits and releases the UI action lock', async () => {
    const { runtime, events } = fakeRuntime();
    const view = setup(async () => runtime as unknown as Awaited<ReturnType<Boot>>);
    await view.click('start');
    events.get('server-ready')!(5173, 'https://fixture.example.test');
    runtime.fs.writeFile.mockRejectedValueOnce('disk full');
    await view.click('change');
    expect(view.status()).toBe('Failed: disk full');
    expect(view.root.querySelector<HTMLButtonElement>('#fix')!.disabled).toBe(false);
  });

  it('disposes a runtime that finishes booting after the page has gone away', async () => {
    const pending = Promise.withResolvers<Awaited<ReturnType<Boot>>>();
    const { runtime } = fakeRuntime();
    const view = setup(() => pending.promise);
    const started = view.click('start');
    dispose();
    pending.resolve(runtime as unknown as Awaited<ReturnType<Boot>>);
    await started;
    expect(runtime.teardown).toHaveBeenCalledOnce();
    expect(runtime.mount).not.toHaveBeenCalled();
  });

  it('does not report normal process termination after disposal', async () => {
    const { runtime, dev, preview } = fakeRuntime();
    const view = setup(async () => runtime as unknown as Awaited<ReturnType<Boot>>);
    await view.click('start');
    await view.click('build');
    dispose();
    dev.resolve(0);
    preview.resolve(0);
    await Promise.all([dev.promise, preview.promise]);
    expect(runtime.teardown).toHaveBeenCalled();
    expect(view.root.childElementCount).toBe(0);
  });

  it('boots from the actual page entry and cleans up on pagehide', async () => {
    document.body.innerHTML = '<main id="app"></main>';
    mockBoot.mockRejectedValueOnce(new Error('entry boot failed'));
    await import('../../experiments/e01-vite-runtime/src/main');
    document.querySelector<HTMLButtonElement>('#start')!.click();
    await vi.waitFor(() => expect(document.querySelector('[role=status]')!.textContent).toBe('Failed: entry boot failed'));
    expect(mockBoot).toHaveBeenCalledWith({ coep: 'require-corp', workdirName: 'vite-experiment', forwardPreviewErrors: true });
    window.dispatchEvent(new Event('pagehide'));
    expect(document.querySelector('#app')!.childElementCount).toBe(0);
  });
});
