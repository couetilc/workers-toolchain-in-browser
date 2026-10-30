import { WebContainer } from '@webcontainer/api';
import { mountHarness } from './harness';
import './style.css';

const imported = import.meta.glob<string>('../fixture/**/*', {
  eager: true, query: '?raw', import: 'default',
});
const files = Object.fromEntries(Object.entries(imported).map(([path, contents]) => [path.slice('../fixture/'.length), contents]));
const dispose = mountHarness(document.querySelector<HTMLElement>('#app')!, () => WebContainer.boot({
  coep: 'require-corp', workdirName: 'vite-experiment', forwardPreviewErrors: true,
}), files);
window.addEventListener('pagehide', dispose, { once: true });
