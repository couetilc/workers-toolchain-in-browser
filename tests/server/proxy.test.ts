import { afterEach, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { proxyServer, toProxyEvent } from '../../src/proxy';
import { model } from '../../src/agent';

const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.map(server => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }))); servers.length = 0; });
async function start(stream: any) {
  const server = proxyServer({ model, apiKey: 'server-secret', origin: 'http://workspace.test' }, stream); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + (server.address() as any).port;
  const post = (body: string, headers: Record<string, string> = { Origin: 'http://workspace.test', Authorization: 'Bearer local-prototype' }) => fetch(url + '/api/stream', { method: 'POST', headers, body });
  return { url, post };
}
it('checks request boundaries and forwards only server-owned provider configuration', async () => {
  let observed: any;
  const { url, post } = await start(async function* (selected: any, context: any, options: any) {
    observed = { selected, context, options };
    yield { type: 'start', partial: {} }; yield { type: 'done', reason: 'stop', message: { usage: {} } };
  });
  expect((await fetch(url + '/api/config')).status).toBe(200);
  expect((await fetch(url + '/missing')).status).toBe(404);
  expect((await post('{}', {})).status).toBe(403);
  expect((await post('{}', { Origin: 'http://workspace.test', Authorization: 'bad' })).status).toBe(403);
  expect((await post('invalid')).status).toBe(400);
  expect((await post('{}')).status).toBe(400);
  expect((await post('x'.repeat(1_000_001))).status).toBe(400);
  const response = await post(JSON.stringify({ model: { baseUrl: 'https://untrusted.test' }, context: { messages: [] }, options: { headers: { Authorization: 'bad' } } }));
  expect(response.headers.get('content-type')).toBe('text/event-stream');
  expect(await response.text()).toContain('"type":"done"');
  expect(observed.selected).toEqual(model);
  expect(observed.options.apiKey).toBe('server-secret'); expect(observed.options.headers).toBeUndefined();
});
it('reports failures after streaming starts as proxy error events', async () => {
  const { post } = await start(async function* () { throw new Error('upstream unavailable'); });
  const response = await post(JSON.stringify({ context: { messages: [] } }));
  expect(await response.text()).toContain('upstream unavailable');
});
it('constructs the default provider adapter without sending a provider request', async () => {
  const { url } = await start(undefined);
  expect((await fetch(url + '/api/config')).status).toBe(200);
});
it('maps tool-call and error events to Pi proxy events', () => {
  expect(toProxyEvent({ type: 'toolcall_start', contentIndex: 0, partial: { content: [{ id: '1', name: 'read_file' }] } } as any)).toEqual({ type: 'toolcall_start', contentIndex: 0, id: '1', toolName: 'read_file' });
  expect(toProxyEvent({ type: 'error', reason: 'error', error: { usage: {}, errorMessage: 'failed' } } as any)).toEqual({ type: 'error', reason: 'error', usage: {}, errorMessage: 'failed' });
});
