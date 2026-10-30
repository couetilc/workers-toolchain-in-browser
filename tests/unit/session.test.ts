import { afterEach, expect, it, vi } from 'vitest';
import { openSession } from '../../src/session';
const { client, acquire } = vi.hoisted(() => ({ client: vi.fn(), acquire: vi.fn() }));
vi.mock('../../src/rpc', () => ({ rpc: client }));
vi.mock('../../src/lease', () => ({ acquireLease: acquire }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('initializes a persistent session and releases both workers and the tab lease', async () => {
  const release = vi.fn(); acquire.mockResolvedValueOnce(release);
  vi.stubGlobal('Worker', vi.fn(function() {}));
  const storage = { call: vi.fn(async (method: string) => method === 'read' ? null : undefined), close: vi.fn() };
  const compiler = { close: vi.fn() };
  client.mockReturnValueOnce(storage).mockReturnValueOnce(compiler);
  const session = await openSession();
  expect(session.workspace.snapshot().files['src/App.tsx']).toContain('Browser-built React');
  session.close(); expect(storage.close).toHaveBeenCalled(); expect(compiler.close).toHaveBeenCalled(); expect(release).toHaveBeenCalled();
});
it('releases ownership after a storage initialization error', async () => {
  const release = vi.fn(); acquire.mockResolvedValueOnce(release);
  vi.stubGlobal('Worker', vi.fn(function() {}));
  const storage = { call: vi.fn().mockRejectedValue(new Error('storage unavailable')), close: vi.fn() };
  const compiler = { close: vi.fn() };
  client.mockReturnValueOnce(storage).mockReturnValueOnce(compiler);
  await expect(openSession()).rejects.toThrow('storage unavailable');
  expect(release).toHaveBeenCalled();
});
