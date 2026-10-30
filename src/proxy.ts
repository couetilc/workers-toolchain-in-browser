import { createServer } from 'node:http';
import { streamSimple } from '@earendil-works/pi-ai/api/openai-completions';
import { normalizeContext } from '@earendil-works/pi-ai/utils/transcript';
import type { AssistantMessageEvent, Model } from '@earendil-works/pi-ai';

export function proxyServer(config: { model: Model<'openai-completions'>; apiKey: string; origin: string }, stream = streamSimple) {
  return createServer(async (request, response) => {
    const json = (status: number, value: unknown) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
    if (request.url === '/api/config' && request.method === 'GET') { json(200, { model: config.model.id }); return; }
    if (request.url !== '/api/stream' || request.method !== 'POST') { json(404, { error: 'Not found' }); return; }
    if (request.headers.origin !== config.origin || request.headers.authorization !== 'Bearer local-prototype') { json(403, { error: 'Local workspace origin required' }); return; }
    const abort = new AbortController();
    response.on('close', () => abort.abort());
    try {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (Buffer.byteLength(body) > 1_000_000) throw new Error('Request too large');
      }
      const parsed = JSON.parse(body);
      if (!Array.isArray(parsed.context?.messages)) throw new Error('Missing context messages');
      const context = normalizeContext({ messages: parsed.context.messages });
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
      for await (const event of stream(config.model, context, { apiKey: config.apiKey, signal: abort.signal, maxTokens: 2048 })) {
        response.write(`data: ${JSON.stringify(toProxyEvent(event))}\n\n`);
      }
      response.end();
    } catch (error) {
      if (!response.headersSent) json(400, { error: String(error) });
      else { response.write(`data: ${JSON.stringify({ type: 'error', reason: 'error', errorMessage: String(error), usage: emptyUsage })}\n\n`); response.end(); }
    }
  });
}
const emptyUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
export function toProxyEvent(event: AssistantMessageEvent) {
  if (event.type === 'done') return { type: event.type, reason: event.reason, usage: event.message.usage };
  if (event.type === 'error') return { type: event.type, reason: event.reason, errorMessage: event.error.errorMessage, usage: event.error.usage };
  if (event.type === 'toolcall_start') {
    const call = event.partial.content[event.contentIndex] as { id: string; name: string };
    return { type: event.type, contentIndex: event.contentIndex, id: call.id, toolName: call.name };
  }
  const { partial, ...wire } = event;
  return wire;
}
