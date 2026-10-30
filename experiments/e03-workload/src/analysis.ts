import { createService } from '../../e02-typescript/src/service';
import { libraryFiles, declarationFiles } from '../../e02-typescript/src/assets';

export function mountAnalysis(root: HTMLElement, files: Record<string, string>) {
  const typescriptFiles = Object.fromEntries(Object.entries(files).filter(([path]) => /\.tsx?$/.test(path) && path.startsWith('src/')).map(([path, contents]) => ['/' + path, contents]));
  const started = performance.now();
  const service = createService(libraryFiles, declarationFiles, typescriptFiles);
  const initializedMs = performance.now() - started;
  root.innerHTML = '<h2>TypeScript workload</h2><button id="analyze-workload">Analyze workload</button><button id="type-error">Introduce workload type error</button><button id="type-fix">Fix workload type error</button><pre aria-label="Workload analysis"></pre>';
  const analyze = () => {
    const started = performance.now();
    const diagnostics = Object.keys(typescriptFiles).flatMap(file => service.diagnostics(file));
    root.querySelector('pre')!.textContent = JSON.stringify({ initializedMs, analysisMs: performance.now() - started, files: Object.keys(typescriptFiles).length, diagnostics });
  };
  root.querySelector<HTMLButtonElement>('#analyze-workload')!.onclick = analyze;
  root.querySelector<HTMLButtonElement>('#type-error')!.onclick = () => {
    service.update('/src/workload.ts', typescriptFiles['/src/workload.ts'].replace('total: number', 'total: string'));
    analyze();
  };
  root.querySelector<HTMLButtonElement>('#type-fix')!.onclick = () => {
    service.update('/src/workload.ts', typescriptFiles['/src/workload.ts']);
    analyze();
  };
  return () => { service.dispose(); root.replaceChildren(); };
}
