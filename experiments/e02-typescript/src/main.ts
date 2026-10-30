import { mountTypeScript } from './view';
import '../../e01-vite-runtime/src/style.css';

const dispose = mountTypeScript(document.querySelector<HTMLElement>('#app')!);
window.addEventListener('pagehide', dispose, { once: true });
