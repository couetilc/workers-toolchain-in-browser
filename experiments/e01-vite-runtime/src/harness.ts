import type { WebContainer, FileSystemTree } from '@webcontainer/api';
import { fileTree } from './fixture';

type Runtime = Pick<WebContainer, 'mount' | 'spawn' | 'fs' | 'on' | 'teardown'>;
export type Boot = () => Promise<Runtime>;

export function mountHarness(root: HTMLElement, boot: Boot, files: Record<string, string>) {
  root.innerHTML = `
    <h1>Vite in the browser</h1>
    <p>This experiment runs the project toolchain inside this tab.</p>
    <nav>
      <button id="start">Start runtime</button>
      <button id="change" disabled>Change component</button>
      <button id="imported" disabled>Change import</button>
      <button id="css" disabled>Change CSS</button>
      <button id="break" disabled>Break syntax</button>
      <button id="fix" disabled>Fix syntax</button>
      <button id="build" disabled>Build defaults</button>
    </nav>
    <p role="status">Not started</p>
    <iframe title="Project preview" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
    <details><summary>Experiment evidence</summary><pre aria-label="Experiment evidence"></pre></details>`;
  const status = root.querySelector<HTMLElement>('[role=status]')!;
  const evidence = root.querySelector<HTMLElement>('pre')!;
  const frame = root.querySelector<HTMLIFrameElement>('iframe')!;
  const start = root.querySelector<HTMLButtonElement>('#start')!;
  const actions = [...root.querySelectorAll<HTMLButtonElement>('nav button')].slice(1);
  let runtime: Runtime;
  let alive = true;
  let previewPort = 5173;
  let previewUrl: string | undefined;
  const unsubscribers: (() => void)[] = [];
  const started = performance.now();
  const record = (kind: string, value: unknown) => {
    evidence.textContent += JSON.stringify({ ms: Math.round(performance.now() - started), kind, value }) + '\n';
  };
  const report = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    status.textContent = `Failed: ${message}`;
    record('failure', message);
  };
  const output = (stream: ReadableStream<string>) => stream.pipeTo(new WritableStream({
    write(chunk) { record('process-output', chunk); },
  }));
  async function run(command: string, args: string[]) {
    record('command', { command, args });
    const process = await runtime.spawn(command, args);
    // WebContainer may keep stdout open after a successful npm process exit.
    // Drain logs independently; process.exit is the command completion contract.
    void output(process.output).catch(report);
    const code = await process.exit;
    record('exit', code);
    if (code !== 0) throw new Error(`${command} ${args.join(' ')} exited ${code}`);
  }
  start.onclick = async () => {
    start.disabled = true;
    status.textContent = 'Booting browser runtime';
    record('browser', { userAgent: navigator.userAgent, isolated: crossOriginIsolated });
    try {
      runtime = await boot();
      if (!alive) { runtime.teardown(); return; }
      record('booted', true);
      unsubscribers.push(runtime.on('server-ready', (port, url) => {
        record('server-ready', { port, url });
        if (port !== previewPort) return;
        if (port === 4173) previewUrl = url;
        frame.src = url;
        status.textContent = `Ready on port ${port}`;
        actions.forEach(button => { button.disabled = false; });
      }));
      unsubscribers.push(runtime.on('error', error => report(error.message)));
      unsubscribers.push(runtime.on('preview-message', message => record('preview-error', message)));
      await runtime.mount(fileTree(files) as FileSystemTree);
      await run('node', ['-p', 'JSON.stringify(process.versions)']);
      status.textContent = 'Installing project dependencies in browser';
      await run('npm', ['ci', '--no-audit', '--no-fund']);
      await run('npm', ['ls', '--depth=0']);
      status.textContent = 'Starting Vite in browser';
      const process = await runtime.spawn('npm', ['run', 'dev']);
      void output(process.output).catch(report);
      void process.exit.then(code => {
        if (alive) report(`Vite server exited ${code}`);
      }, report);
    } catch (error) { report(error); }
  };
  async function build() {
    previewPort = 4173;
    status.textContent = 'Building project in browser';
    await run('npm', ['run', 'build']);
    record('dist', await runtime.fs.readdir('dist'));
    if (previewUrl) {
      frame.src = previewUrl;
      status.textContent = 'Ready on port 4173';
      return;
    }
    const process = await runtime.spawn('npm', ['run', 'preview']);
    void output(process.output).catch(report);
    void process.exit.then(code => {
      if (alive) report(`Preview server exited ${code}`);
    }, report);
  }
  const commands: Record<string, () => Promise<void>> = {
    change: () => runtime.fs.writeFile('src/App.tsx', files['src/App.tsx'].replace('Browser-built React', 'Edited inside browser')),
    imported: () => runtime.fs.writeFile('src/message.ts', "export const message: string = 'Updated imported value';"),
    css: () => runtime.fs.writeFile('src/style.css', 'body { color: rgb(120, 20, 40); }'),
    break: () => runtime.fs.writeFile('src/App.tsx', 'export default function App( {'),
    fix: () => runtime.fs.writeFile('src/App.tsx', files['src/App.tsx']),
    build,
  };
  for (const button of actions) {
    button.onclick = async () => {
      actions.forEach(action => { action.disabled = true; });
      try {
        await commands[button.id]();
        record('action-complete', button.id);
      } catch (error) { report(error); }
      finally { actions.forEach(action => { action.disabled = false; }); }
    };
  }
  return () => {
    alive = false;
    unsubscribers.forEach(unsubscribe => unsubscribe());
    runtime?.teardown();
    root.replaceChildren();
  };
}
