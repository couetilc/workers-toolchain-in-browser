import { createAgent, proxyStream, type AgentHost } from './agent';
import type { AgentMessage, StreamFn } from '@earendil-works/pi-agent-core';

export function transcript(messages: AgentMessage[], streaming?: AgentMessage) {
  const all = streaming ? [...messages, streaming] : messages;
  return all.filter(message => message.role !== 'system').map(message => {
    const content = typeof message.content === 'string' ? message.content : message.content.map(part => {
      if ('text' in part) return part.text;
      if (part.type === 'toolCall') return `${part.name} ${JSON.stringify(part.arguments)}`;
      return '[non-text content]';
    }).join('\n');
    return `${message.role}: ${content}`;
  }).join('\n\n');
}
export function mountAgent(parent: HTMLElement, host: Omit<AgentHost, 'display'>, saved: { status: string; messages: AgentMessage[] } | null, stream: StreamFn = proxyStream) {
  parent.innerHTML = `<h2>Pi agent</h2><p aria-label="Model provider">Connecting to model proxy…</p><p aria-label="Agent status"></p><pre class="transcript" aria-label="Conversation"></pre><label>Request<textarea aria-label="Agent request" placeholder="Describe a change to this project"></textarea></label><button id="ask-agent">Ask Pi</button> <button id="cancel-agent" disabled>Cancel agent</button>`;
  const state = parent.querySelector<HTMLElement>('[aria-label="Agent status"]')!;
  const conversation = parent.querySelector<HTMLElement>('pre')!;
  const input = parent.querySelector('textarea')!;
  const ask = parent.querySelector<HTMLButtonElement>('#ask-agent')!;
  const cancel = parent.querySelector<HTMLButtonElement>('#cancel-agent')!;
  state.textContent = saved?.status ?? 'ready';
  const messages = saved?.messages ?? [];
  conversation.textContent = transcript(messages);
  const engine = createAgent({ ...host, display: (messages, streaming) => { conversation.textContent = transcript(messages, streaming); } }, stream, messages);
  void fetch('/api/config').then(response => {
    if (!response.ok) throw new Error('Model proxy unavailable');
    return response.json();
  }).then(config => { parent.querySelector('[aria-label="Model provider"]')!.textContent = 'Model: ' + config.model; })
    .catch(() => { parent.querySelector('[aria-label="Model provider"]')!.textContent = 'Model proxy unavailable — start the local proxy to use Pi'; });
  ask.onclick = async () => {
    ask.disabled = true; cancel.disabled = false; state.textContent = 'running';
    try {
      if (!input.value.trim()) throw new Error('Enter a request');
      state.textContent = await engine.run(input.value);
    } catch (error) { state.textContent = String(error); }
    finally { ask.disabled = false; cancel.disabled = true; }
  };
  cancel.onclick = () => { engine.cancel(); state.textContent = 'cancelling'; };
  return () => engine.cancel();
}
