import { WebContainer } from '@webcontainer/api';
import { mountApp } from './app';
import { openSession } from './session';
import { createRuntime } from './runtime';
import './style.css';

export async function startApp() {
  const root = document.querySelector<HTMLElement>('#app')!;
  const show = (selector: string, message: string) => { const element = root.querySelector<HTMLElement>(selector); if (element) element.textContent = message; };
  const runtime = createRuntime(() => WebContainer.boot({ coep: 'require-corp', workdirName: 'workspace', forwardPreviewErrors: true }),
    url => { const frame = root.querySelector<HTMLIFrameElement>('iframe'); if (frame) frame.src = url; },
    message => show('[aria-label="Runtime notice"]', message),
    message => show('[aria-label="Preview status"]', message));
  try {
    const close = await mountApp(root, openSession, runtime);
    window.addEventListener('pagehide', close, { once: true });
  } catch (error) { root.querySelector<HTMLElement>('[role=status]')!.textContent = String(error); }
}
await startApp();
