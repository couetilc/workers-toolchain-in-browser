import { WebContainer } from '@webcontainer/api';
import { mountHarness } from '../../e01-vite-runtime/src/harness';
import { workloadFiles } from './workload';
import { mountAnalysis } from './analysis';
import '../../e01-vite-runtime/src/style.css';

const imported = import.meta.glob<string>('../../e01-vite-runtime/fixture/**/*', { eager: true, query: '?raw', import: 'default' });
const files = Object.fromEntries(Object.entries(imported).map(([path, contents]) => [path.slice('../../e01-vite-runtime/fixture/'.length), contents]));
const count = Number(new URL(location.href).searchParams.get('size'));
Object.assign(files, workloadFiles(count));
files['src/App.tsx'] = `import { total } from './workload';\n` + files['src/App.tsx'].replace('<h1>', '<p>Generated total: {total}</p><h1>');
const dispose = mountHarness(document.querySelector<HTMLElement>('#app')!, () => WebContainer.boot({
  coep: 'require-corp', workdirName: 'workload-experiment', forwardPreviewErrors: true,
}), files);
const disposeAnalysis = mountAnalysis(document.querySelector<HTMLElement>('#analysis')!, files);
window.addEventListener('pagehide', () => { dispose(); disposeAnalysis(); }, { once: true });
