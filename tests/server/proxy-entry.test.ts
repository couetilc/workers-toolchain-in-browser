import { expect, it, vi } from 'vitest';

const { exists, load, server, config, listen } = vi.hoisted(() => {
  const listen = vi.fn((_port, _host, ready: () => void) => ready());
  return { exists: vi.fn(), load: vi.fn(), server: vi.fn(() => ({ listen })), config: vi.fn(() => ({ model: 'configured' })), listen };
});
vi.mock('node:fs', () => ({ existsSync: exists }));
vi.mock('node:process', () => ({ loadEnvFile: load }));
vi.mock('../../src/proxy', () => ({ proxyServer: server }));
vi.mock('../../src/provider-config', () => ({ providerConfig: config }));

it('loads optional local credentials and binds only the loopback interface', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    exists.mockReturnValue(true);
    await import('../../scripts/proxy.mjs');
    expect(load).toHaveBeenCalledWith('.env');
    expect(config).toHaveBeenCalledWith(process.env);
    expect(server).toHaveBeenCalledWith({ model: 'configured' });
    expect(listen).toHaveBeenCalledWith(4171, '127.0.0.1', expect.any(Function));
    vi.resetModules(); load.mockClear(); exists.mockReturnValue(false);
    await import('../../scripts/proxy.mjs');
    expect(load).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});
