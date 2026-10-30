import { createService } from './service';
import { libraryFiles, declarationFiles, projectFiles } from './assets';

export function mountTypeScript(root: HTMLElement) {
  root.innerHTML = `<h1>TypeScript in the browser</h1>
    <p>JavaScript compiler API, without an editor or LSP.</p>
    <button id="analyze">Analyze project</button>
    <button id="fix-types">Fix imported type</button>
    <button id="break-types">Restore type error</button>
    <p role="status">Not analyzed</p><pre aria-label="TypeScript results"></pre>`;
  const status = root.querySelector<HTMLElement>('[role=status]')!;
  const results = root.querySelector<HTMLElement>('pre')!;
  const started = performance.now();
  const service = createService(libraryFiles, declarationFiles, projectFiles);
  const initializedMs = performance.now() - started;
  const file = '/src/Counter.tsx';
  const source = projectFiles[file];
  function analyze() {
    const start = performance.now();
    const diagnostics = service.diagnostics(file);
    const symbol = service.query(file, source.indexOf('= count') + 3);
    const members = service.query(file, source.indexOf('settings.title') + 'settings.'.length);
    results.textContent = JSON.stringify({
      version: service.version, initializedMs, analysisMs: performance.now() - start,
      diagnostics, symbol, members,
    }, null, 2);
    status.textContent = `${diagnostics.length} diagnostics`;
  }
  root.querySelector<HTMLButtonElement>('#analyze')!.onclick = analyze;
  root.querySelector<HTMLButtonElement>('#fix-types')!.onclick = () => {
    service.update('/src/values.ts', projectFiles['/src/values.ts'].replace("string = 'one'", 'number = 1'));
    analyze();
  };
  root.querySelector<HTMLButtonElement>('#break-types')!.onclick = () => {
    service.update('/src/values.ts', projectFiles['/src/values.ts']);
    analyze();
  };
  return () => { service.dispose(); root.replaceChildren(); };
}
